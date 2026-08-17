use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ==============================================================================
// Enums
// ==============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SearchStatus {
    Pending,
    Running,
    Completed,
    Partial,
    Failed,
    Cancelled,
}

impl std::fmt::Display for SearchStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "PENDING"),
            Self::Running => write!(f, "RUNNING"),
            Self::Completed => write!(f, "COMPLETED"),
            Self::Partial => write!(f, "PARTIAL"),
            Self::Failed => write!(f, "FAILED"),
            Self::Cancelled => write!(f, "CANCELLED"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum BusinessStatus {
    New,
    Discovered,
    Enriching,
    Enriched,
    Analyzing,
    Analyzed,
    OpportunityFound,
    Saved,
    Contacted,
    Blocked,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ClientPriority {
    High,
    Medium,
    Low,
}

impl std::fmt::Display for ClientPriority {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::High => write!(f, "HIGH"),
            Self::Medium => write!(f, "MEDIUM"),
            Self::Low => write!(f, "LOW"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OpportunityImpact {
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderCategory {
    WebSearch,
    LocalSearch,
    Maps,
    BusinessDirectory,
    IndustryDirectory,
    OfficialRegistry,
    SocialDiscovery,
    ReviewSource,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EvidenceStatus {
    Detected,
    NotDetected,
    Unknown,
}

impl std::fmt::Display for EvidenceStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Detected => write!(f, "DETECTED"),
            Self::NotDetected => write!(f, "NOT_DETECTED"),
            Self::Unknown => write!(f, "UNKNOWN"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceSignal {
    pub key: String,
    pub label: String,
    pub status: EvidenceStatus,
    pub details: Option<String>,
    pub confidence: f64,
    pub source: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OpportunityType {
    Erp,
    Website,
    Crm,
    Booking,
    Automation,
    Seo,
    Custom,
}

impl std::fmt::Display for OpportunityType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Erp => write!(f, "ERP"),
            Self::Website => write!(f, "WEBSITE"),
            Self::Crm => write!(f, "CRM"),
            Self::Booking => write!(f, "BOOKING"),
            Self::Automation => write!(f, "AUTOMATION"),
            Self::Seo => write!(f, "SEO"),
            Self::Custom => write!(f, "CUSTOM"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchIntent {
    pub raw_query: String,
    pub target_entity: String,
    pub industry: String,
    pub category: Option<String>,
    pub location: Option<String>,
    pub opportunity_type: OpportunityType,
    pub opportunity_keywords: Vec<String>,
    pub qualification_conditions: Vec<String>,
    pub is_vendor_search: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpportunityEvaluation {
    pub score: i32,
    pub confidence: f64,
    pub reason: String,
    pub evidence_signals: Vec<EvidenceSignal>,
    pub recommended_service: String,
    pub service_tier: String,
    pub estimated_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationSummary {
    pub target_entity: String,
    pub total_candidates: usize,
    pub valid_candidates: usize,
    pub match_ratio: f64,
    pub detected_entity_distribution: std::collections::HashMap<String, usize>,
    pub regenerated: bool,
}

// ==============================================================================
// Search Session & Filters
// ==============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SearchFilters {
    // Basic filters
    pub industry: Option<String>,
    pub sub_industry: Option<String>,
    pub country: Option<String>,
    pub state: Option<String>,
    pub city: Option<String>,
    pub location: Option<String>,
    pub keywords: Vec<String>,
    pub business_type: Option<String>,

    // Business filters
    pub business_size: Option<String>,
    pub min_rating: Option<f64>,
    pub min_reviews: Option<i32>,
    pub business_status: Option<String>,

    // Digital filters
    pub has_website: Option<bool>,
    pub has_email: Option<bool>,
    pub has_phone: Option<bool>,
    pub has_instagram: Option<bool>,
    pub has_facebook: Option<bool>,
    pub has_linkedin: Option<bool>,
    pub has_google_business: Option<bool>,

    // Opportunity filters
    pub outdated_website: Option<bool>,
    pub weak_website: Option<bool>,
    pub no_booking_system: Option<bool>,
    pub no_lead_form: Option<bool>,
    pub no_clear_cta: Option<bool>,
    pub weak_social_presence: Option<bool>,
    pub weak_seo: Option<bool>,
    pub low_digital_maturity: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchSession {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub query: String,
    pub filters: SearchFilters,
    pub providers_selected: Vec<String>,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub status: SearchStatus,
    pub total_discovered: i32,
    pub total_saved: i32,
    pub total_enriched: i32,
    pub errors: Vec<String>,
    pub duration_ms: Option<i64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSearchRequest {
    pub query: String,
    #[serde(default)]
    pub filters: SearchFilters,
    #[serde(default)]
    pub providers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResponse {
    pub search_id: Uuid,
    pub query: String,
    pub status: SearchStatus,
    pub created_at: DateTime<Utc>,
}

// ==============================================================================
// Master Business Entity & Sub-records
// ==============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Business {
    pub id: Uuid,
    pub name: String,
    pub normalized_name: String,
    pub slug: String,
    pub industry: String,
    pub sub_industry: Option<String>,
    pub description: Option<String>,

    // Location
    pub address: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub postal_code: Option<String>,
    pub country: String,
    pub country_code: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,

    // Contact
    pub phone: Option<String>,
    pub normalized_phone: Option<String>,
    pub email: Option<String>,
    pub website: Option<String>,
    pub domain: Option<String>,

    // Reputation
    pub rating: Option<f64>,
    pub review_count: i32,

    // Digital Presence Flags
    pub has_website: bool,
    pub has_ssl: bool,
    pub is_mobile_friendly: bool,
    pub website_load_time_ms: Option<i32>,

    // Status & Priority
    pub status: BusinessStatus,
    pub priority: ClientPriority,
    pub priority_score: i32,
    pub confidence: f64,
    pub data_completeness: i32,

    // Timestamps
    pub discovered_at: DateTime<Utc>,
    pub last_enriched_at: Option<DateTime<Utc>>,
    pub last_analyzed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredBusiness {
    pub business_name: String,
    pub website: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub country: Option<String>,
    pub category: Option<String>,
    pub rating: Option<f64>,
    pub review_count: Option<i32>,
    pub source: String,
    pub source_url: Option<String>,
    pub confidence: f64,
    pub collected_at: DateTime<Utc>,
    pub raw_data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Contact {
    pub id: Uuid,
    pub business_id: Uuid,
    pub contact_type: String, // email, phone, whatsapp, linkedin, form
    pub value: String,
    pub label: Option<String>, // general, sales, support, founder, etc.
    pub full_name: Option<String>,
    pub title: Option<String>,
    pub source_url: Option<String>,
    pub confidence: f64,
    pub verified: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebsiteInfo {
    pub id: Uuid,
    pub business_id: Uuid,
    pub url: String,
    pub is_reachable: bool,
    pub status_code: Option<i32>,
    pub has_ssl: bool,
    pub title: Option<String>,
    pub meta_description: Option<String>,
    pub pages_crawled: Vec<String>,
    pub technologies: Vec<String>,
    pub performance_score: Option<i32>,
    pub last_crawled_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SocialProfile {
    pub id: Uuid,
    pub business_id: Uuid,
    pub platform: String, // instagram, facebook, linkedin, youtube, tiktok, x
    pub url: String,
    pub handle: Option<String>,
    pub follower_count: Option<i32>,
    pub post_count: Option<i32>,
    pub is_active: bool,
    pub last_posted_at: Option<DateTime<Utc>>,
    pub bio: Option<String>,
    pub source_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewInfo {
    pub id: Uuid,
    pub business_id: Uuid,
    pub source: String,
    pub rating: f64,
    pub review_count: i32,
    pub sentiment_score: Option<f64>,
    pub recent_snippet: Option<String>,
    pub source_url: Option<String>,
    pub collected_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Technology {
    pub id: Uuid,
    pub business_id: Uuid,
    pub category: String, // cms, analytics, booking, payment, chat, crm, hosting
    pub name: String,
    pub version: Option<String>,
    pub confidence: f64,
    pub evidence: Option<String>,
}

// ==============================================================================
// Facts & Provenance
// ==============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Fact {
    pub id: Uuid,
    pub business_id: Uuid,
    pub category: String, // website, social, contact, technology, reputation, marketing
    pub key: String,
    pub value: serde_json::Value,
    pub source: String,
    pub source_url: Option<String>,
    pub confidence: f64,
    pub verified: bool,
    pub created_at: DateTime<Utc>,
}

// ==============================================================================
// AI Analysis & Opportunities
// ==============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Analysis {
    pub id: Uuid,
    pub business_id: Uuid,
    pub model: String,
    pub digital_presence_score: i32,
    pub website_score: i32,
    pub social_score: i32,
    pub seo_score: i32,
    pub lead_capture_score: i32,
    pub reputation_score: i32,
    pub marketing_maturity: String,
    pub strengths: Vec<String>,
    pub weaknesses: Vec<String>,
    pub opportunities: Vec<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Opportunity {
    pub id: Uuid,
    pub business_id: Uuid,
    pub title: String,
    pub description: String,
    pub category: String,
    pub impact: OpportunityImpact,
    pub onefolk_service: String,
    pub service_tier: String,
    pub confidence: f64,
    pub estimated_revenue_potential: Option<String>,
    pub evidence: Vec<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

// ==============================================================================
// Activity Timeline
// ==============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityEvent {
    pub id: Uuid,
    pub business_id: Option<Uuid>,
    pub search_id: Option<Uuid>,
    pub event_type: String,
    pub title: String,
    pub description: Option<String>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

// ==============================================================================
// Business Intelligence Full Profile DTO
// ==============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BusinessProfile {
    #[serde(flatten)]
    pub business: Business,
    pub contacts: Vec<Contact>,
    pub website: Option<WebsiteInfo>,
    pub social_profiles: Vec<SocialProfile>,
    pub reviews: Vec<ReviewInfo>,
    pub technologies: Vec<Technology>,
    pub facts: Vec<Fact>,
    pub analysis: Option<Analysis>,
    pub opportunities: Vec<Opportunity>,
    pub activities: Vec<ActivityEvent>,
}
