use chrono::Utc;
use domain::ReviewInfo;
use uuid::Uuid;

pub struct ReviewIntelligence;

impl ReviewIntelligence {
    pub fn create_review_evidence(
        business_id: Uuid,
        source: &str,
        rating: f64,
        review_count: i32,
        snippet: Option<String>,
        source_url: Option<String>,
    ) -> ReviewInfo {
        ReviewInfo {
            id: Uuid::new_v4(),
            business_id,
            source: source.to_string(),
            rating,
            review_count,
            sentiment_score: Some(if rating >= 4.0 { 0.85 } else { 0.45 }),
            recent_snippet: snippet,
            source_url,
            collected_at: Utc::now(),
        }
    }
}
