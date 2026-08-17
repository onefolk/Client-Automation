use chrono::{DateTime, Utc};
use domain::{Business, Opportunity, SearchIntent, ValidationSummary};
use futures::StreamExt;
use redis::{aio::ConnectionManager, AsyncCommands, Client};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::broadcast;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum SystemEvent {
    #[serde(rename = "search.started")]
    SearchStarted {
        search_id: Uuid,
        query: String,
        started_at: DateTime<Utc>,
    },
    #[serde(rename = "intent.parsed")]
    IntentParsed {
        search_id: Uuid,
        intent: SearchIntent,
    },
    #[serde(rename = "validation.completed")]
    ValidationCompleted {
        search_id: Uuid,
        validation: ValidationSummary,
    },
    #[serde(rename = "provider.started")]
    ProviderStarted {
        search_id: Uuid,
        provider_id: String,
        query_variation: String,
    },
    #[serde(rename = "provider.progress")]
    ProviderProgress {
        search_id: Uuid,
        provider_id: String,
        progress_percentage: i32,
        found_count: i32,
    },
    #[serde(rename = "business.discovered")]
    BusinessDiscovered {
        search_id: Uuid,
        business: Business,
        is_new: bool,
    },
    #[serde(rename = "business.updated")]
    BusinessUpdated {
        business_id: Uuid,
        business: Business,
    },
    #[serde(rename = "enrichment.started")]
    EnrichmentStarted {
        search_id: Uuid,
        business_id: Uuid,
        task: String,
    },
    #[serde(rename = "enrichment.progress")]
    EnrichmentProgress {
        business_id: Uuid,
        stage: String,
        details: String,
    },
    #[serde(rename = "enrichment.completed")]
    EnrichmentCompleted {
        business_id: Uuid,
        stage: String,
    },
    #[serde(rename = "analysis.started")]
    AnalysisStarted {
        business_id: Uuid,
    },
    #[serde(rename = "analysis.completed")]
    AnalysisCompleted {
        business_id: Uuid,
        digital_score: i32,
    },
    #[serde(rename = "opportunity.detected")]
    OpportunityDetected {
        search_id: Option<Uuid>,
        business_id: Uuid,
        opportunity: Opportunity,
    },
    #[serde(rename = "search.completed")]
    SearchCompleted {
        search_id: Uuid,
        total_discovered: i32,
        total_saved: i32,
        total_enriched: i32,
        duration_ms: i64,
    },
    #[serde(rename = "search.failed")]
    SearchFailed {
        search_id: Uuid,
        error: String,
    },
}

#[derive(Clone)]
pub struct EventBus {
    redis_conn: ConnectionManager,
    redis_url: String,
    local_broadcaster: Arc<broadcast::Sender<SystemEvent>>,
}

impl EventBus {
    pub async fn new(redis_url: &str) -> Result<Self, redis::RedisError> {
        let client = Client::open(redis_url)?;
        let redis_conn = ConnectionManager::new(client).await?;
        let (local_broadcaster, _) = broadcast::channel(1000);

        Ok(Self {
            redis_conn,
            redis_url: redis_url.to_string(),
            local_broadcaster: Arc::new(local_broadcaster),
        })
    }

    pub async fn publish_search_event(&self, search_id: Uuid, event: SystemEvent) -> Result<(), redis::RedisError> {
        // Emit to local broadcast
        let _ = self.local_broadcaster.send(event.clone());

        // Emit to Redis PubSub channel
        let channel = format!("onefolk:events:search:{}", search_id);
        let json = serde_json::to_string(&event).unwrap_or_default();
        let mut conn = self.redis_conn.clone();
        let _: i32 = conn.publish(channel, json).await?;

        Ok(())
    }

    pub fn subscribe_local(&self) -> broadcast::Receiver<SystemEvent> {
        self.local_broadcaster.subscribe()
    }

    pub async fn subscribe_search_events(
        &self,
        search_id: Uuid,
    ) -> Result<tokio_stream::wrappers::UnboundedReceiverStream<SystemEvent>, redis::RedisError> {
        let (tx, rx) = tokio::sync::mpsc::unbounded_channel();
        let client = Client::open(self.redis_url.clone())?;
        let mut pubsub = client.get_async_pubsub().await?;
        let channel = format!("onefolk:events:search:{}", search_id);

        pubsub.subscribe(channel.clone()).await?;

        // Also subscribe to local broadcaster for in-process fast path
        let mut local_rx = self.local_broadcaster.subscribe();
        let tx_clone = tx.clone();

        tokio::spawn(async move {
            while let Ok(event) = local_rx.recv().await {
                // Match search_id
                let matches = match &event {
                    SystemEvent::SearchStarted { search_id: sid, .. }
                    | SystemEvent::ProviderStarted { search_id: sid, .. }
                    | SystemEvent::ProviderProgress { search_id: sid, .. }
                    | SystemEvent::BusinessDiscovered { search_id: sid, .. }
                    | SystemEvent::EnrichmentStarted { search_id: sid, .. }
                    | SystemEvent::OpportunityDetected { search_id: Some(sid), .. }
                    | SystemEvent::SearchCompleted { search_id: sid, .. }
                    | SystemEvent::SearchFailed { search_id: sid, .. } => *sid == search_id,
                    _ => true,
                };

                if matches && tx_clone.send(event).is_err() {
                    break;
                }
            }
        });

        tokio::spawn(async move {
            let mut stream = pubsub.on_message();
            while let Some(msg) = stream.next().await {
                let payload: String = msg.get_payload().unwrap_or_default();
                if let Ok(event) = serde_json::from_str::<SystemEvent>(&payload) {
                    if tx.send(event).is_err() {
                        break;
                    }
                }
            }
        });

        Ok(tokio_stream::wrappers::UnboundedReceiverStream::new(rx))
    }
}
