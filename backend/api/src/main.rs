use axum::{
    extract::{Path, Query, State},
    http::{header, Method, StatusCode},
    response::sse::{Event, KeepAlive, Sse},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use database::Database;
use discovery::IntentParser;
use domain::{
    Business, BusinessProfile, CreateSearchRequest, OneFolkConfig, OneFolkServiceDef, Opportunity,
    OpportunityDef, ResourceDef, SearchFilters, SearchIntent, SearchResponse, SearchSession,
    SearchStatus,
};
use events::{EventBus, SystemEvent};
use futures::Stream;
use queue::JobQueue;
use serde::Deserialize;
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
    pub config: Arc<OneFolkConfig>,
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
    let config = Arc::new(OneFolkConfig::default());

    let state = AppState {
        db,
        queue,
        event_bus,
        config,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION, header::ACCEPT]);

    let app = Router::new()
        .route("/", get(root_handler))
        .route("/api/health", get(health_check))
        .route("/health", get(health_check))
        // Intent & Config Registry
        .route("/api/intent/parse", post(parse_intent_handler))
        .route("/api/config/services", get(list_services_handler))
        .route("/api/config/opportunities", get(list_opportunities_config_handler))
        .route("/api/config/resources", get(list_resources_config_handler))
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

async fn root_handler() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "service": "OneFolk Client Intelligence Engine (Rust Axum)",
        "version": "2.0.0",
        "status": "online",
        "endpoints": {
            "health": "/health",
            "searches": "/api/searches",
            "businesses": "/api/businesses",
            "opportunities": "/api/opportunities",
            "activities": "/api/activities"
        },
        "timestamp": Utc::now()
    }))
}

async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "onefolk-api",
        "timestamp": Utc::now()
    }))
}

#[derive(Debug, Deserialize)]
pub struct ParseIntentRequest {
    pub query: String,
    #[serde(default)]
    pub filters: SearchFilters,
}

async fn parse_intent_handler(
    State(state): State<AppState>,
    Json(req): Json<ParseIntentRequest>,
) -> Json<SearchIntent> {
    let intent = IntentParser::parse_with_config(&req.query, &req.filters, &state.config);
    Json(intent)
}

async fn list_services_handler(State(state): State<AppState>) -> Json<Vec<OneFolkServiceDef>> {
    Json(state.config.services.clone())
}

async fn list_opportunities_config_handler(
    State(state): State<AppState>,
) -> Json<Vec<OpportunityDef>> {
    Json(state.config.opportunities.clone())
}

async fn list_resources_config_handler(State(state): State<AppState>) -> Json<Vec<ResourceDef>> {
    Json(state.config.resources.clone())
}

async fn create_search(
    State(state): State<AppState>,
    Json(req): Json<CreateSearchRequest>,
) -> Result<Json<SearchResponse>, (StatusCode, String)> {
    tracing::info!(query = %req.query, "Received new discovery search request");

    // 1. Parse Search Intent with OneFolk Registry
    let intent = IntentParser::parse_with_config(&req.query, &req.filters, &state.config);

    // 2. Create Search Session in PostgreSQL
    let session = state
        .db
        .create_search(&req.query, &req.filters, &req.providers)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 3. Enqueue Background Discovery Job in Redis Streams
    state
        .queue
        .enqueue_discovery_job(session.id, &session.query, &session.filters, &session.providers_selected)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 4. Emit search.started and intent.parsed events to SSE Bus
    let start_event = SystemEvent::SearchStarted {
        search_id: session.id,
        query: session.query.clone(),
        started_at: session.started_at,
    };
    let _ = state.event_bus.publish_search_event(session.id, start_event).await;

    let intent_event = SystemEvent::IntentParsed {
        search_id: session.id,
        intent: intent.clone(),
    };
    let _ = state.event_bus.publish_search_event(session.id, intent_event).await;

    // 5. Log initial activity
    let _ = state
        .db
        .add_activity(
            None,
            Some(session.id),
            "search.created",
            "Discovery Session Initiated",
            Some(&format!(
                "Target: '{}' | Opportunity: '{}' | Location: '{}'",
                intent.target_entity,
                intent.opportunity_type,
                intent.location.as_deref().unwrap_or("Any")
            )),
            &serde_json::json!({
                "query": session.query,
                "target_entity": intent.target_entity,
                "opportunity_type": format!("{}", intent.opportunity_type),
                "is_vendor": intent.is_vendor_search,
            }),
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
            SystemEvent::IntentParsed { .. } => "intent.parsed",
            SystemEvent::ValidationCompleted { .. } => "validation.completed",
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
