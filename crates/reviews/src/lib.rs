use chrono::Utc;
use domain::ReviewInfo;
use uuid::Uuid;

pub struct ReviewIntelligence;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ReputationAnalysis {
    pub reputation_score: i32,
    pub sentiment: String,
    pub trust_tier: String,
    pub review_volume_health: String,
}

impl ReviewIntelligence {
    pub fn create_review_evidence(
        business_id: Uuid,
        source: &str,
        rating: f64,
        review_count: i32,
        snippet: Option<String>,
        source_url: Option<String>,
    ) -> ReviewInfo {
        let sentiment_score = if rating >= 4.5 {
            0.92
        } else if rating >= 4.0 {
            0.78
        } else if rating >= 3.5 {
            0.55
        } else {
            0.25
        };

        ReviewInfo {
            id: Uuid::new_v4(),
            business_id,
            source: source.to_string(),
            rating,
            review_count,
            sentiment_score: Some(sentiment_score),
            recent_snippet: snippet,
            source_url,
            collected_at: Utc::now(),
        }
    }

    /// Computes overall reputation score (0-100) and sentiment categorization based on ratings and volume
    pub fn calculate_reputation(rating: Option<f64>, review_count: i32) -> ReputationAnalysis {
        let r = rating.unwrap_or(4.0);
        let base_score = (r / 5.0) * 70.0;
        
        let volume_bonus = if review_count > 300 {
            30.0
        } else if review_count > 100 {
            20.0
        } else if review_count > 30 {
            10.0
        } else {
            5.0
        };

        let reputation_score = (base_score + volume_bonus).min(100.0).max(10.0) as i32;

        let sentiment = if r >= 4.4 {
            "OVERWHELMINGLY_POSITIVE".to_string()
        } else if r >= 3.8 {
            "GENERALLY_POSITIVE".to_string()
        } else {
            "NEEDS_IMPROVEMENT".to_string()
        };

        let trust_tier = if reputation_score >= 85 {
            "AUTHORITY".to_string()
        } else if reputation_score >= 65 {
            "ESTABLISHED".to_string()
        } else {
            "EMERGING".to_string()
        };

        let review_volume_health = if review_count >= 200 {
            "STRONG_FOOTFALL".to_string()
        } else if review_count >= 50 {
            "MODERATE_FOOTFALL".to_string()
        } else {
            "LOW_SAMPLE_SIZE".to_string()
        };

        ReputationAnalysis {
            reputation_score,
            sentiment,
            trust_tier,
            review_volume_health,
        }
    }
}
