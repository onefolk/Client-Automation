use chrono::Utc;
use database::Database;
use discovery::SearchPlanner;
use domain::{Contact, SearchStatus};
use entity_resolution::{EntityResolver, ResolutionResult};
use events::{EventBus, SystemEvent};
use opportunities::OpportunityEngine;
use providers::{MockDiscoveryProvider, ProviderRegistry};
use queue::JobQueue;
use std::{sync::Arc, time::Duration};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
            "info,worker=debug,discovery=debug,providers=debug,normalization=debug,entity_resolution=debug".into()
        }))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://onefolk:onefolk_secret_dev@localhost:5432/onefolk_intelligence".to_string());

    let redis_url = std::env::var("REDIS_URL")
        .unwrap_or_else(|_| "redis://localhost:6379".to_string());

    tracing::info!("Starting OneFolk Client Intelligence Background Worker...");
    tracing::info!("Connecting to PostgreSQL at {}", database_url);
    let db = Database::connect(&database_url).await.expect("Failed to connect to PostgreSQL");

    tracing::info!("Connecting to Redis Streams at {}", redis_url);
    let queue = JobQueue::new(&redis_url).await.expect("Failed to connect to Redis queue");
    queue.init_stream_groups().await.ok();

    let event_bus = EventBus::new(&redis_url).await.expect("Failed to connect to EventBus");

    let mut provider_registry = ProviderRegistry::new();
    provider_registry.register(Arc::new(MockDiscoveryProvider::new()));

    let consumer_name = format!("worker_{}", Uuid::new_v4().simple());
    tracing::info!(consumer = %consumer_name, "OneFolk Worker loop ready for Redis Streams jobs");

    loop {
        match queue.read_discovery_jobs(&consumer_name, 5).await {
            Ok(jobs) => {
                for (entry_id, payload) in jobs {
                    tracing::info!(
                        job_id = %payload.job_id,
                        search_id = %payload.search_id,
                        query = %payload.query,
                        "Processing discovery job"
                    );

                    let start_instant = std::time::Instant::now();

                    // Update search session status to RUNNING
                    let _ = db
                        .update_search_progress(payload.search_id, SearchStatus::Running, 0, 0, 0)
                        .await;

                    // 1. Create Search Plan
                    let plan = SearchPlanner::create_plan(
                        &payload.query,
                        &payload.filters,
                        &payload.providers,
                    );

                    let mut total_discovered = 0;
                    let mut total_saved = 0;

                    for strategy in plan.strategies {
                        if let Some(provider) = provider_registry.get(&strategy.provider_id) {
                            for variation in strategy.query_variations {
                                let _ = event_bus
                                    .publish_search_event(
                                        payload.search_id,
                                        SystemEvent::ProviderStarted {
                                            search_id: payload.search_id,
                                            provider_id: strategy.provider_id.clone(),
                                            query_variation: variation.clone(),
                                        },
                                    )
                                    .await;

                                // Artificial small delay to emulate network & demonstrate streaming UI
                                tokio::time::sleep(Duration::from_millis(400)).await;

                                match provider.search(&variation, &payload.filters, strategy.limit).await {
                                    Ok(discovered_list) => {
                                        for (rank, discovered) in discovered_list.into_iter().enumerate() {
                                            total_discovered += 1;

                                            // 2. Entity Resolution & Deduplication
                                            let res = match EntityResolver::resolve(&db, &discovered).await {
                                                Ok(r) => r,
                                                Err(e) => {
                                                    tracing::error!(error = %e, "Entity resolution error");
                                                    continue;
                                                }
                                            };

                                            let (mut business, is_new) = match res {
                                                ResolutionResult::ExistingMatch(b) => (b, false),
                                                ResolutionResult::NewEntity(b) => (b, true),
                                            };

                                            // 3. Evaluate Opportunities & Calculate Priority
                                            let (opps, priority, score) = OpportunityEngine::evaluate_business(&business);
                                            business.priority = priority;
                                            business.priority_score = score;
                                            business.status = domain::BusinessStatus::OpportunityFound;

                                            // 4. Save Master Business Entity
                                            if let Ok(saved_biz) = db.save_business(&business).await {
                                                total_saved += 1;

                                                // Link search results
                                                let _ = db
                                                    .link_search_result(
                                                        payload.search_id,
                                                        saved_biz.id,
                                                        &strategy.provider_id,
                                                        rank as i32,
                                                    )
                                                    .await;

                                                // Save Raw Source Provenance Record
                                                let _ = db
                                                    .save_source_record(
                                                        saved_biz.id,
                                                        &discovered.source,
                                                        discovered.source_url.as_deref(),
                                                        &discovered.raw_data,
                                                        discovered.confidence,
                                                    )
                                                    .await;

                                                // Save Contacts with Provenance
                                                if let Some(ref email) = discovered.email {
                                                    let contact = Contact {
                                                        id: Uuid::new_v4(),
                                                        business_id: saved_biz.id,
                                                        contact_type: "email".to_string(),
                                                        value: email.clone(),
                                                        label: Some("general".to_string()),
                                                        full_name: None,
                                                        title: None,
                                                        source_url: discovered.source_url.clone(),
                                                        confidence: discovered.confidence,
                                                        verified: false,
                                                        created_at: Utc::now(),
                                                    };
                                                    let _ = db.save_contact(&contact).await;
                                                }

                                                // Save Opportunities
                                                for opp in &opps {
                                                    let _ = db.save_opportunity(opp).await;
                                                    let _ = event_bus
                                                        .publish_search_event(
                                                            payload.search_id,
                                                            SystemEvent::OpportunityDetected {
                                                                search_id: Some(payload.search_id),
                                                                business_id: saved_biz.id,
                                                                opportunity: opp.clone(),
                                                            },
                                                        )
                                                        .await;
                                                }

                                                // Add Activity Record
                                                let _ = db
                                                    .add_activity(
                                                        Some(saved_biz.id),
                                                        Some(payload.search_id),
                                                        "business.discovered",
                                                        "Client Discovered",
                                                        Some(&format!(
                                                            "Discovered {} via {}",
                                                            saved_biz.name, discovered.source
                                                        )),
                                                        &serde_json::json!({
                                                            "source": discovered.source,
                                                            "priority": format!("{}", saved_biz.priority),
                                                        }),
                                                    )
                                                    .await;

                                                // 5. Emit Realtime SSE Event: business.discovered
                                                let _ = event_bus
                                                    .publish_search_event(
                                                        payload.search_id,
                                                        SystemEvent::BusinessDiscovered {
                                                            search_id: payload.search_id,
                                                            business: saved_biz,
                                                            is_new,
                                                        },
                                                    )
                                                    .await;
                                            }

                                            // Small micro-delay for smooth real-time visual streaming in UI
                                            tokio::time::sleep(Duration::from_millis(300)).await;
                                        }

                                        let _ = event_bus
                                            .publish_search_event(
                                                payload.search_id,
                                                SystemEvent::ProviderProgress {
                                                    search_id: payload.search_id,
                                                    provider_id: strategy.provider_id.clone(),
                                                    progress_percentage: 100,
                                                    found_count: total_discovered,
                                                },
                                            )
                                            .await;
                                    }
                                    Err(e) => {
                                        tracing::error!(
                                            provider = %strategy.provider_id,
                                            error = %e,
                                            "Provider search failed"
                                        );
                                    }
                                }
                            }
                        }
                    }

                    let duration_ms = start_instant.elapsed().as_millis() as i64;

                    // Update Search Session to COMPLETED
                    let _ = db
                        .update_search_progress(
                            payload.search_id,
                            SearchStatus::Completed,
                            total_discovered,
                            total_saved,
                            total_saved,
                        )
                        .await;

                    // Emit search.completed
                    let _ = event_bus
                        .publish_search_event(
                            payload.search_id,
                            SystemEvent::SearchCompleted {
                                search_id: payload.search_id,
                                total_discovered,
                                total_saved,
                                total_enriched: total_saved,
                                duration_ms,
                            },
                        )
                        .await;

                    // Acknowledge Redis Streams entry
                    let _ = queue.ack_discovery_job(&entry_id).await;

                    tracing::info!(
                        search_id = %payload.search_id,
                        total_saved,
                        duration_ms,
                        "Discovery job completed successfully"
                    );
                }
            }
            Err(e) => {
                tracing::warn!(error = %e, "Error reading from Redis Streams, sleeping...");
                tokio::time::sleep(Duration::from_secs(2)).await;
            }
        }
    }
}
