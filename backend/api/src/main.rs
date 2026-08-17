use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderValue, Method, StatusCode},
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse, Response,
    },
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use database::Database;
use domain::{
    Business, BusinessProfile, CreateSearchRequest, Opportunity, SearchFilters, SearchResponse,
    SearchSession, SearchStatus,
};
use events::{EventBus, SystemEvent};
use futures::Stream;
use queue::JobQueue;
use serde::{Deserialize, Serialize};
use std::{convert::Infallible, net::SocketAddr, sync::Arc, time::Duration};
use tokio_stream::StreamExt;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub queue: JobQueue,
    pub event_bus: EventBus,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
            "info,api=debug,domain=debug,events=debug,tower_http=debug".into()
        }))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://onefolk:onefolk_secret_dev@localhost:5432/onefolk_intelligence".to_string());

    // Support all common Railway and cloud Redis environment variable formats
    let redis_url = std::env::var("REDIS_URL")
        .or_else(|_| std::env::var("REDISURL"))
        .or_else(|_| std::env::var("REDIS_PRIVATE_URL"))
        .or_else(|_| std::env::var("REDIS_PUBLIC_URL"))
        .unwrap_or_else(|_| "redis://localhost:6379".to_string());

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse()
        .unwrap_or(8080);

    tracing::info!("Connecting to PostgreSQL...");
    let db = Database::connect(&database_url).await.expect("Failed to connect to PostgreSQL");
    tracing::info!("Connected to PostgreSQL successfully");

    tracing::info!("Connecting to Redis at: {}", redis_url);
    
    // Connect to Redis with retry loop for cloud deployment resilience
    let mut queue_opt = None;
    let mut event_bus_opt = None;

    for attempt in 1..=5 {
        match (JobQueue::new(&redis_url).await, EventBus::new(&redis_url).await) {
            (Ok(q), Ok(eb)) => {
                q.init_stream_groups().await.ok();
                queue_opt = Some(q);
                event_bus_opt = Some(eb);
                tracing::info!("Connected to Redis queue and EventBus successfully");
                break;
            }
            (Err(e), _) | (_, Err(e)) => {
                tracing::warn!("Redis connection attempt {}/5 failed: {}. Retrying in 2s...", attempt, e);
                tokio::time::sleep(Duration::from_secs(2)).await;
            }
        }
    }

    let queue = queue_opt.expect("Failed to connect to Redis after multiple attempts. Please ensure the REDIS_URL environment variable is set to your Railway Redis connection string.");
    let event_bus = event_bus_opt.expect("Failed to connect to Redis EventBus.");

    let state = AppState {
        db,
        queue,
        event_bus,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION, header::ACCEPT]);

    let app = Router::new()
        .route("/api/health", get(health_check))
        .route("/health", get(health_check))
        // Searches
        .route("/api/searches", post(create_search).get(list_searches))
        .route("/api/searches/:id", get(get_search))
        .route("/api/searches/:id/events", get(stream_search_events))
        .route("/api/searches/:id/cancel", post(cancel_search))
        // Businesses
        .route("/api/businesses", get(list_businesses))
        .route("/api/businesses/:id", get(get_business_profile))
        .route("/api/businesses/:id/enrich", post(enrich_business))
        // Opportunities & Activities
        .route("/api/opportunities", get(list_opportunities))
        .route("/api/activities", get(list_activities))
        .layer(cors)
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("OneFolk Client Intelligence API running on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

// ==============================================================================
// Handlers
// ==============================================================================

async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "onefolk-api",
        "timestamp": Utc::now()
    }))
}

async fn create_search(
    State(state): State<AppState>,
    Json(req): Json<CreateSearchRequest>,
) -> Result<Json<SearchResponse>, (StatusCode, String)> {
    tracing::info!(query = %req.query, "Received new discovery search request");

    // 1. Create Search Session in PostgreSQL
    let session = state
        .db
        .create_search(&req.query, &req.filters, &req.providers)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 2. Enqueue Background Discovery Job in Redis Streams
    state
        .queue
        .enqueue_discovery_job(session.id, &session.query, &session.filters, &session.providers_selected)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 3. Emit search.started event to SSE Bus
    let start_event = SystemEvent::SearchStarted {
        search_id: session.id,
        query: session.query.clone(),
        started_at: session.started_at,
    };
    let _ = state.event_bus.publish_search_event(session.id, start_event).await;

    // 4. Log initial activity
    let _ = state
        .db
        .add_activity(
            None,
            Some(session.id),
            "search.created",
            "Discovery Session Initiated",
            Some(&format!("Search query: '{}'", session.query)),
            &serde_json::json!({ "query": session.query }),
        )
        .await;

    Ok(Json(SearchResponse {
        search_id: session.id,
        query: session.query,
        status: session.status,
        created_at: session.created_at,
    }))
}

async fn list_searches(
    State(state): State<AppState>,
) -> Result<Json<Vec<SearchSession>>, (StatusCode, String)> {
    let searches = state
        .db
        .list_searches(50)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(searches))
}

async fn get_search(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<SearchSession>, (StatusCode, String)> {
    let session = state
        .db
        .get_search(id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Search session not found".to_string()))?;

    Ok(Json(session))
}

async fn cancel_search(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    state
        .db
        .update_search_progress(id, SearchStatus::Cancelled, 0, 0, 0)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "status": "CANCELLED", "search_id": id })))
}

// Server-Sent Events Handler
async fn stream_search_events(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    tracing::info!(search_id = %id, "Client connected to SSE event stream");

    let event_stream = match state.event_bus.subscribe_search_events(id).await {
        Ok(stream) => stream,
        Err(e) => {
            tracing::error!(error = %e, "Failed to subscribe to Redis PubSub");
            let (tx, rx) = tokio::sync::mpsc::unbounded_channel();
            tokio_stream::wrappers::UnboundedReceiverStream::new(rx)
        }
    };

    let mapped_stream = event_stream.map(|event: SystemEvent| {
        let json_str = serde_json::to_string(&event).unwrap_or_default();
        let event_type = match &event {
            SystemEvent::SearchStarted { .. } => "search.started",
            SystemEvent::ProviderStarted { .. } => "provider.started",
            SystemEvent::ProviderProgress { .. } => "provider.progress",
            SystemEvent::BusinessDiscovered { .. } => "business.discovered",
            SystemEvent::BusinessUpdated { .. } => "business.updated",
            SystemEvent::EnrichmentStarted { .. } => "enrichment.started",
            SystemEvent::EnrichmentProgress { .. } => "enrichment.progress",
            SystemEvent::EnrichmentCompleted { .. } => "enrichment.completed",
            SystemEvent::AnalysisStarted { .. } => "analysis.started",
            SystemEvent::AnalysisCompleted { .. } => "analysis.completed",
            SystemEvent::OpportunityDetected { .. } => "opportunity.detected",
            SystemEvent::SearchCompleted { .. } => "search.completed",
            SystemEvent::SearchFailed { .. } => "search.failed",
        };

        Ok(Event::default().event(event_type).data(json_str))
    });

    Sse::new(mapped_stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("keep-alive-ping"),
    )
}

#[derive(Deserialize)]
struct ListBusinessParams {
    pub industry: Option<String>,
    pub city: Option<String>,
    pub priority: Option<String>,
    pub limit: Option<i64>,
}

async fn list_businesses(
    State(state): State<AppState>,
    Query(params): Query<ListBusinessParams>,
) -> Result<Json<Vec<Business>>, (StatusCode, String)> {
    let limit = params.limit.unwrap_or(100);
    let businesses = state
        .db
        .list_businesses(
            params.industry.as_deref(),
            params.city.as_deref(),
            params.priority.as_deref(),
            limit,
        )
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(businesses))
}

async fn get_business_profile(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<BusinessProfile>, (StatusCode, String)> {
    let profile = state
        .db
        .get_business_profile(id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Business profile not found".to_string()))?;

    Ok(Json(profile))
}

async fn enrich_business(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    state
        .queue
        .enqueue_enrichment_job(id, None, "full_enrichment")
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({
        "status": "ENRICHMENT_QUEUED",
        "business_id": id
    })))
}

async fn list_opportunities(
    State(state): State<AppState>,
) -> Result<Json<Vec<Opportunity>>, (StatusCode, String)> {
    let opps = state
        .db
        .list_opportunities(100)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(opps))
}

async fn list_activities(
    State(state): State<AppState>,
) -> Result<Json<Vec<domain::ActivityEvent>>, (StatusCode, String)> {
    let acts = state
        .db
        .list_activities(100)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(acts))
}
