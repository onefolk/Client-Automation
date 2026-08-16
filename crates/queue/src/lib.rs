use chrono::{DateTime, Utc};
use domain::{SearchFilters, SearchSession};
use redis::{
    aio::ConnectionManager,
    streams::{StreamReadOptions, StreamReadReply},
    AsyncCommands, Client,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

pub const STREAM_DISCOVERY_JOBS: &str = "onefolk:jobs:discovery";
pub const STREAM_ENRICHMENT_JOBS: &str = "onefolk:jobs:enrichment";
pub const GROUP_WORKERS: &str = "onefolk_workers_group";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveryJobPayload {
    pub job_id: Uuid,
    pub search_id: Uuid,
    pub query: String,
    pub filters: SearchFilters,
    pub providers: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub retry_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnrichmentJobPayload {
    pub job_id: Uuid,
    pub business_id: Uuid,
    pub search_id: Option<Uuid>,
    pub task: String, // website, contact, social, reviews, technology, grok_analysis
    pub created_at: DateTime<Utc>,
    pub retry_count: u32,
}

#[derive(Clone)]
pub struct JobQueue {
    conn: ConnectionManager,
}

impl JobQueue {
    pub async fn new(redis_url: &str) -> Result<Self, redis::RedisError> {
        let client = Client::open(redis_url)?;
        let conn = ConnectionManager::new(client).await?;
        Ok(Self { conn })
    }

    pub async fn init_stream_groups(&self) -> Result<(), redis::RedisError> {
        let mut conn = self.conn.clone();

        // Create consumer group for discovery jobs if not exists
        let _: Result<(), redis::RedisError> = conn
            .xgroup_create_mkstream(STREAM_DISCOVERY_JOBS, GROUP_WORKERS, "$")
            .await;

        let _: Result<(), redis::RedisError> = conn
            .xgroup_create_mkstream(STREAM_ENRICHMENT_JOBS, GROUP_WORKERS, "$")
            .await;

        Ok(())
    }

    pub async fn enqueue_discovery_job(
        &self,
        search_id: Uuid,
        query: &str,
        filters: &SearchFilters,
        providers: &[String],
    ) -> Result<Uuid, redis::RedisError> {
        let job_id = Uuid::new_v4();
        let payload = DiscoveryJobPayload {
            job_id,
            search_id,
            query: query.to_string(),
            filters: filters.clone(),
            providers: providers.to_vec(),
            created_at: Utc::now(),
            retry_count: 0,
        };

        let json = serde_json::to_string(&payload).unwrap_or_default();
        let mut conn = self.conn.clone();

        let _: String = conn
            .xadd(
                STREAM_DISCOVERY_JOBS,
                "*",
                &[("payload", json.as_str()), ("job_id", job_id.to_string().as_str())],
            )
            .await?;

        tracing::info!(job_id = %job_id, search_id = %search_id, "Enqueued discovery job to Redis Streams");
        Ok(job_id)
    }

    pub async fn enqueue_enrichment_job(
        &self,
        business_id: Uuid,
        search_id: Option<Uuid>,
        task: &str,
    ) -> Result<Uuid, redis::RedisError> {
        let job_id = Uuid::new_v4();
        let payload = EnrichmentJobPayload {
            job_id,
            business_id,
            search_id,
            task: task.to_string(),
            created_at: Utc::now(),
            retry_count: 0,
        };

        let json = serde_json::to_string(&payload).unwrap_or_default();
        let mut conn = self.conn.clone();

        let _: String = conn
            .xadd(
                STREAM_ENRICHMENT_JOBS,
                "*",
                &[("payload", json.as_str()), ("job_id", job_id.to_string().as_str())],
            )
            .await?;

        Ok(job_id)
    }

    pub async fn read_discovery_jobs(
        &self,
        consumer_name: &str,
        count: usize,
    ) -> Result<Vec<(String, DiscoveryJobPayload)>, redis::RedisError> {
        let mut conn = self.conn.clone();
        let opts = StreamReadOptions::default()
            .group(GROUP_WORKERS, consumer_name)
            .count(count)
            .block(2000);

        let reply: Result<StreamReadReply, redis::RedisError> =
            conn.xread_options(&[STREAM_DISCOVERY_JOBS], &[">"], &opts).await;

        let mut jobs = Vec::new();
        if let Ok(reply) = reply {
            for stream_key in reply.keys {
                for entry in stream_key.ids {
                    let entry_id = entry.id;
                    if let Some(redis::Value::Data(bytes)) = entry.map.get("payload") {
                        if let Ok(json_str) = std::str::from_utf8(bytes) {
                            if let Ok(payload) = serde_json::from_str::<DiscoveryJobPayload>(json_str) {
                                jobs.push((entry_id, payload));
                            }
                        }
                    }
                }
            }
        }

        Ok(jobs)
    }

    pub async fn ack_discovery_job(&self, entry_id: &str) -> Result<(), redis::RedisError> {
        let mut conn = self.conn.clone();
        let _: i32 = conn.xack(STREAM_DISCOVERY_JOBS, GROUP_WORKERS, &[entry_id]).await?;
        Ok(())
    }
}
