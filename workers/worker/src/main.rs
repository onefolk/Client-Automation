use chrono::Utc;
use crawler::HttpCrawler;
use database::Database;
use discovery::{DiscoveryPlanner, SearchValidator};
use domain::{Contact, OneFolkConfig, SearchStatus};
use enrichment::EnrichmentPipeline;
use entity_resolution::{EntityResolver, ResolutionResult};
use events::{EventBus, SystemEvent};
use providers::{LiveWebSearchProvider, ProviderRegistry, PublicRegistryProvider};
use queue::JobQueue;
use std::{sync::Arc, time::Duration};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
            "info,worker=debug,discovery=debug,providers=debug,normalization=debug,entity_resolution=debug,opportunities=debug,enrichment=debug".into()
        }))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://onefolk:onefolk_secret_dev@localhost:5432/onefolk_intelligence".to_string());

    let redis_url = std::env::var("REDIS_URL")
        .unwrap_or_else(|_| "redis://localhost:6379".to_string());

    tracing::info!("Starting Universal OneFolk Client Opportunity Discovery Worker...");
    tracing::info!("Connecting to PostgreSQL at {}", database_url);
    let db = Database::connect(&database_url).await.expect("Failed to connect to PostgreSQL");

    tracing::info!("Connecting to Redis Streams at {}", redis_url);
    let queue = JobQueue::new(&redis_url).await.expect("Failed to connect to Redis queue");
    queue.init_stream_groups().await.ok();

    let event_bus = EventBus::new(&redis_url).await.expect("Failed to connect to EventBus");
    let crawler = HttpCrawler::new();
    let config = OneFolkConfig::default();

    let mut provider_registry = ProviderRegistry::new();
    provider_registry.register(Arc::new(PublicRegistryProvider::new()));
    provider_registry.register(Arc::new(LiveWebSearchProvider::new()));

    let consumer_name = format!("worker_{}", Uuid::new_v4().simple());
    tracing::info!(consumer = %consumer_name, "Universal Discovery Worker loop ready for Redis Streams jobs");

    loop {
        match queue.read_discovery_jobs(&consumer_name, 5).await {
            Ok(jobs) => {
                for (entry_id, payload) in jobs {
                    tracing::info!(
                        job_id = %payload.job_id,
                        search_id = %payload.search_id,
                        query = %payload.query,
                        "Processing universal discovery job"
                    );

                    let start_instant = std::time::Instant::now();

                    // Update search session status to RUNNING
                    let _ = db
                        .update_search_progress(payload.search_id, SearchStatus::Running, 0, 0, 0)
                        .await;

                    // 1. Universal Linguistic Intent Parsing & Target-Centric Planning (Data-Driven)
                    let plan = DiscoveryPlanner::create_plan_with_config(
                        &payload.query,
                        &payload.filters,
                        &payload.providers,
                        &config,
                    );

                    tracing::info!(
                        target_entity = %plan.intent.target_entity,
                        opportunity_type = %plan.intent.opportunity_type,
                        intent_type = %plan.intent.intent_type,
                        "Parsed user search intent"
                    );

                    // Broadcast IntentParsed event
                    let _ = event_bus
                        .publish_search_event(
                            payload.search_id,
                            SystemEvent::IntentParsed {
                                search_id: payload.search_id,
                                intent: plan.intent.clone(),
                            },
                        )
                        .await;

                    let mut total_discovered = 0;
                    let mut total_saved = 0;
                    let mut total_enriched = 0;

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

                                match provider.search(&variation, &payload.filters, strategy.limit).await {
                                    Ok(discovered_list) => {
                                        // 2. Candidate Validation & Dynamic Noise Suppression
                                        let (valid_candidates, val_summary) =
                                            SearchValidator::validate_candidates_with_config(
                                                discovered_list,
                                                &plan.intent,
                                                &config,
                                            );

                                        let _ = event_bus
                                            .publish_search_event(
                                                payload.search_id,
                                                SystemEvent::ValidationCompleted {
                                                    search_id: payload.search_id,
                                                    validation: val_summary,
                                                },
                                            )
                                            .await;

                                        for (rank, discovered) in valid_candidates.into_iter().enumerate() {
                                            total_discovered += 1;

                                            // 3. Entity Resolution & Deduplication
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

                                            // 4. Intent-Aware Progressive Research & Evidence Extraction
                                            let enrich_res = EnrichmentPipeline::process_business_with_config(
                                                &db,
                                                &crawler,
                                                &mut business,
                                                &plan.intent,
                                                &config,
                                            )
                                            .await;

                                            if let Ok((_contacts, _techs, _facts, _eval)) = enrich_res {
                                                total_enriched += 1;
                                            }

                                            // 5. Save Master Business Entity
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

                                                // Emit Realtime SSE Event: business.discovered
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
                            total_enriched,
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
                                total_enriched,
                                duration_ms,
                            },
                        )
                        .await;

                    // Acknowledge Redis Streams entry
                    let _ = queue.ack_discovery_job(&entry_id).await;

                    tracing::info!(
                        search_id = %payload.search_id,
                        total_saved,
                        total_enriched,
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
