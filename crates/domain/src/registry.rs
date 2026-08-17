use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ==============================================================================
// 1. Core Enumerations & Generic Enums
// ==============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Freshness {
    Current,
    RecentlyVerified,
    Stale,
    Unknown,
}

impl std::fmt::Display for Freshness {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Current => write!(f, "CURRENT"),
            Self::RecentlyVerified => write!(f, "RECENTLY_VERIFIED"),
            Self::Stale => write!(f, "STALE"),
            Self::Unknown => write!(f, "UNKNOWN"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum IntentType {
    ClientDiscovery,
    VendorDiscovery,
    GeneralResearch,
}

impl std::fmt::Display for IntentType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ClientDiscovery => write!(f, "CLIENT_DISCOVERY"),
            Self::VendorDiscovery => write!(f, "VENDOR_DISCOVERY"),
            Self::GeneralResearch => write!(f, "GENERAL_RESEARCH"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum MatcherType {
    TechFingerprint,
    UrlRoute,
    HtmlSelector,
    ContentRegex,
    MetricThreshold,
    ContactPresence,
    SslCheck,
    SchemaCheck,
    ReputationCheck,
}

// ==============================================================================
// 2. Generic Signal Matcher & Scoring Configuration
// ==============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalMatcher {
    pub signal_key: String,
    pub label: String,
    pub matcher_type: MatcherType,
    pub pattern: String,
    #[serde(default)]
    pub expected_value: Option<serde_json::Value>,
    pub confidence_weight: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoringWeights {
    pub target_match_weight: f64,
    pub opportunity_match_weight: f64,
    pub evidence_quality_weight: f64,
    pub digital_gap_weight: f64,
    pub business_scale_weight: f64,
    pub commercial_relevance_weight: f64,
}

impl Default for ScoringWeights {
    fn default() -> Self {
        Self {
            target_match_weight: 0.25,
            opportunity_match_weight: 0.30,
            evidence_quality_weight: 0.20,
            digital_gap_weight: 0.15,
            business_scale_weight: 0.10,
            commercial_relevance_weight: 0.10,
        }
    }
}

// ==============================================================================
// 3. OneFolk Service Registry Data Model
// ==============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OneFolkServiceDef {
    pub service_id: String,
    pub name: String,
    pub description: String,
    pub category: String, // "Media Production", "Creative & Branding", "Content & Marketing", "Tech & Growth", "AI & Automation"
    pub capabilities: Vec<String>,
    pub target_signals: Vec<String>,
    pub qualification_signals: Vec<String>,
    pub negative_signals: Vec<String>,
    pub recommended_evidence: Vec<String>,
    pub service_tier: String,
    pub estimated_value: Option<String>,
    #[serde(default)]
    pub scoring_factors: HashMap<String, f64>,
}

// ==============================================================================
// 4. Opportunity Registry Data Model
// ==============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpportunityDef {
    pub opportunity_id: String,
    pub name: String,
    pub category: String,
    pub keywords: Vec<String>,
    pub target_entity_types: Vec<String>,
    pub required_signals: Vec<SignalMatcher>,
    pub positive_signals: Vec<SignalMatcher>,
    pub negative_signals: Vec<SignalMatcher>,
    pub matching_service_ids: Vec<String>,
    pub reason_template: String,
    #[serde(default)]
    pub scoring_weights: ScoringWeights,
}

// ==============================================================================
// 5. Resource Registry Data Model
// ==============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ResourceType {
    SearchEngine,
    MapListing,
    PublicRegistry,
    IndustryDirectory,
    TechIntelligence,
    SocialPlatform,
    ReviewPlatform,
    AppStore,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceDef {
    pub resource_id: String,
    pub name: String,
    pub resource_type: ResourceType,
    pub supported_entity_types: Vec<String>,
    pub supported_industries: Vec<String>,
    pub geographic_coverage: Vec<String>,
    pub discovery_support: bool,
    pub research_support: bool,
    pub reliability_score: f64,
}

// ==============================================================================
// 6. Master OneFolk Configuration Container & Seed Registry
// ==============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OneFolkConfig {
    pub services: Vec<OneFolkServiceDef>,
    pub opportunities: Vec<OpportunityDef>,
    pub resources: Vec<ResourceDef>,
    pub scoring_profiles: HashMap<String, ScoringWeights>,
    pub synonyms: HashMap<String, Vec<String>>,
    pub vendor_blacklist_tokens: Vec<String>,
}

impl Default for OneFolkConfig {
    fn default() -> Self {
        Self::seed_configuration()
    }
}

impl OneFolkConfig {
    /// Constructs default seed configuration representing OneFolk full-stack capabilities
    pub fn seed_configuration() -> Self {
        let services = vec![
            OneFolkServiceDef {
                service_id: "srv_web_architecture".to_string(),
                name: "High-Performance Next.js Web Experience".to_string(),
                description: "Custom headless web architecture, mobile conversion optimization, and lightning-fast loading.".to_string(),
                category: "Tech & Growth".to_string(),
                capabilities: vec!["Next.js".to_string(), "UX/UI Design".to_string(), "Conversion Funnels".to_string(), "Direct Booking".to_string()],
                target_signals: vec!["outdated_framework".to_string(), "slow_load_time".to_string(), "no_ssl".to_string()],
                qualification_signals: vec!["high_traffic".to_string(), "active_reputation".to_string()],
                negative_signals: vec!["modern_framework_detected".to_string()],
                recommended_evidence: vec!["Mobile page speed < 50".to_string(), "No SSL or outdated template builder".to_string()],
                service_tier: "ENTERPRISE".to_string(),
                estimated_value: Some("$6,000 - $18,000".to_string()),
                scoring_factors: HashMap::new(),
            },
            OneFolkServiceDef {
                service_id: "srv_erp_portal".to_string(),
                name: "Custom Cloud ERP & Unified Digital Portal".to_string(),
                description: "Centralized administrative ERP, client/student portals, and automated digital operations.".to_string(),
                category: "Tech & Growth".to_string(),
                capabilities: vec!["Cloud ERP".to_string(), "Client Portals".to_string(), "Payment Gateways".to_string(), "Administrative Systems".to_string()],
                target_signals: vec!["missing_portal".to_string(), "disconnected_admin".to_string()],
                qualification_signals: vec!["institutional_scale".to_string(), "high_headcount".to_string()],
                negative_signals: vec!["enterprise_erp_active".to_string()],
                recommended_evidence: vec!["No active administrative portal found".to_string()],
                service_tier: "ENTERPRISE".to_string(),
                estimated_value: Some("$15,000 - $45,000".to_string()),
                scoring_factors: HashMap::new(),
            },
            OneFolkServiceDef {
                service_id: "srv_crm_automation".to_string(),
                name: "Omnichannel CRM & Automated Lead Nurture Pipeline".to_string(),
                description: "End-to-end lead routing, speed-to-lead automation, and CRM lifecycle synchronization.".to_string(),
                category: "Tech & Growth".to_string(),
                capabilities: vec!["HubSpot/Salesforce CRM".to_string(), "Lead Routing".to_string(), "WhatsApp API".to_string(), "Speed-to-Lead".to_string()],
                target_signals: vec!["no_crm_tracker".to_string(), "static_contact_form".to_string()],
                qualification_signals: vec!["active_leads".to_string(), "high_deal_size".to_string()],
                negative_signals: vec!["active_crm_stack".to_string()],
                recommended_evidence: vec!["Missing automated lead capture or tracking".to_string()],
                service_tier: "ENTERPRISE".to_string(),
                estimated_value: Some("$5,000 - $14,000".to_string()),
                scoring_factors: HashMap::new(),
            },
            OneFolkServiceDef {
                service_id: "srv_ai_automation".to_string(),
                name: "AI Receptionist & WhatsApp Workflow Automation".to_string(),
                description: "24/7 intelligent conversational booking, customer triage, and operational flow automation.".to_string(),
                category: "AI & Automation".to_string(),
                capabilities: vec!["AI Voice/Chat Agents".to_string(), "WhatsApp Commerce".to_string(), "Automated Scheduling".to_string()],
                target_signals: vec!["manual_phone_only".to_string(), "no_instant_chat".to_string()],
                qualification_signals: vec!["high_inquiry_volume".to_string()],
                negative_signals: vec!["active_ai_agent".to_string()],
                recommended_evidence: vec!["Inquiries rely on static phone numbers without instant response".to_string()],
                service_tier: "GROWTH".to_string(),
                estimated_value: Some("$3,000 - $8,500".to_string()),
                scoring_factors: HashMap::new(),
            },
            OneFolkServiceDef {
                service_id: "srv_seo_growth".to_string(),
                name: "Autonomous Technical SEO & Search Authority".to_string(),
                description: "Rich schema markup, high-intent ranking architecture, and algorithmic search visibility.".to_string(),
                category: "Content & Marketing".to_string(),
                capabilities: vec!["Technical SEO".to_string(), "Schema JSON-LD".to_string(), "Local Visibility".to_string()],
                target_signals: vec!["missing_schema".to_string(), "poor_meta".to_string()],
                qualification_signals: vec!["high_search_demand".to_string()],
                negative_signals: vec!["perfect_schema_active".to_string()],
                recommended_evidence: vec!["Missing structured Schema.org markup".to_string()],
                service_tier: "GROWTH".to_string(),
                estimated_value: Some("$2,500 - $6,000/mo".to_string()),
                scoring_factors: HashMap::new(),
            },
            OneFolkServiceDef {
                service_id: "srv_media_branding".to_string(),
                name: "High-End Video Production & Brand Identity".to_string(),
                description: "Cinematic commercial video, creative visual identity, and premium brand storytelling.".to_string(),
                category: "Media Production".to_string(),
                capabilities: vec!["Commercial Video".to_string(), "Brand Identity".to_string(), "Creative Direction".to_string()],
                target_signals: vec!["outdated_visuals".to_string(), "lack_of_video".to_string()],
                qualification_signals: vec!["high_ticket_clientele".to_string()],
                negative_signals: vec!["recent_cinematic_rebrand".to_string()],
                recommended_evidence: vec!["Visual presence lacks high-converting video and modern branding".to_string()],
                service_tier: "GROWTH".to_string(),
                estimated_value: Some("$5,000 - $20,000".to_string()),
                scoring_factors: HashMap::new(),
            },
        ];

        let opportunities = vec![
            OpportunityDef {
                opportunity_id: "opp_erp".to_string(),
                name: "ERP & Administrative Portal Modernization".to_string(),
                category: "Enterprise Systems".to_string(),
                keywords: vec!["erp".to_string(), "portal".to_string(), "lms".to_string(), "student portal".to_string(), "school management".to_string(), "sis".to_string()],
                target_entity_types: vec!["school".to_string(), "university".to_string(), "college".to_string(), "academy".to_string(), "institute".to_string(), "enterprise".to_string()],
                required_signals: vec![],
                positive_signals: vec![
                    SignalMatcher {
                        signal_key: "missing_portal".to_string(),
                        label: "Integrated Administrative Portal".to_string(),
                        matcher_type: MatcherType::UrlRoute,
                        pattern: "/portal|/student|/parent|/login".to_string(),
                        expected_value: None,
                        confidence_weight: 0.90,
                    },
                ],
                negative_signals: vec![
                    SignalMatcher {
                        signal_key: "enterprise_erp".to_string(),
                        label: "Incumbent Enterprise ERP".to_string(),
                        matcher_type: MatcherType::TechFingerprint,
                        pattern: "sap|oracle|powerschool|canvas|odoo".to_string(),
                        expected_value: None,
                        confidence_weight: 0.95,
                    },
                ],
                matching_service_ids: vec!["srv_erp_portal".to_string()],
                reason_template: "{entity_name} lacks an integrated modern administrative portal, creating operational friction and manual overhead.".to_string(),
                scoring_weights: ScoringWeights::default(),
            },
            OpportunityDef {
                opportunity_id: "opp_booking".to_string(),
                name: "Direct Online Booking & Scheduling Funnel".to_string(),
                category: "Booking & Conversion".to_string(),
                keywords: vec!["booking".to_string(), "reservation".to_string(), "appointment".to_string(), "scheduling".to_string()],
                target_entity_types: vec!["clinic".to_string(), "dental".to_string(), "restaurant".to_string(), "spa".to_string(), "salon".to_string(), "hotel".to_string()],
                required_signals: vec![],
                positive_signals: vec![
                    SignalMatcher {
                        signal_key: "no_booking_engine".to_string(),
                        label: "Direct Online Booking Engine".to_string(),
                        matcher_type: MatcherType::TechFingerprint,
                        pattern: "opentable|sevenrooms|resy|calendly|acuity|fresha|mindbody".to_string(),
                        expected_value: None,
                        confidence_weight: 0.92,
                    },
                ],
                negative_signals: vec![],
                matching_service_ids: vec!["srv_web_architecture".to_string(), "srv_ai_automation".to_string()],
                reason_template: "{entity_name} has no direct 24/7 online booking funnel, risking high-intent prospect drop-off.".to_string(),
                scoring_weights: ScoringWeights::default(),
            },
            OpportunityDef {
                opportunity_id: "opp_crm".to_string(),
                name: "CRM Lead Automation & Pipeline Architecture".to_string(),
                category: "Sales & CRM".to_string(),
                keywords: vec!["crm".to_string(), "lead".to_string(), "pipeline".to_string(), "inquiry".to_string()],
                target_entity_types: vec!["company".to_string(), "agency".to_string(), "real estate".to_string(), "law firm".to_string(), "b2b".to_string()],
                required_signals: vec![],
                positive_signals: vec![
                    SignalMatcher {
                        signal_key: "no_crm_tracker".to_string(),
                        label: "Automated CRM Tracking".to_string(),
                        matcher_type: MatcherType::TechFingerprint,
                        pattern: "hubspot|salesforce|zoho|pipedrive".to_string(),
                        expected_value: None,
                        confidence_weight: 0.90,
                    },
                ],
                negative_signals: vec![],
                matching_service_ids: vec!["srv_crm_automation".to_string()],
                reason_template: "{entity_name} lacks automated CRM capture, causing response delays and lost lead conversion.".to_string(),
                scoring_weights: ScoringWeights::default(),
            },
            OpportunityDef {
                opportunity_id: "opp_web".to_string(),
                name: "High-Converting Headless Web Architecture".to_string(),
                category: "Web & UX".to_string(),
                keywords: vec!["website".to_string(), "web".to_string(), "redesign".to_string(), "landing page".to_string()],
                target_entity_types: vec!["business".to_string(), "brand".to_string(), "restaurant".to_string(), "firm".to_string()],
                required_signals: vec![],
                positive_signals: vec![
                    SignalMatcher {
                        signal_key: "no_ssl".to_string(),
                        label: "SSL Encryption Certificate".to_string(),
                        matcher_type: MatcherType::SslCheck,
                        pattern: "https".to_string(),
                        expected_value: None,
                        confidence_weight: 0.99,
                    },
                ],
                negative_signals: vec![
                    SignalMatcher {
                        signal_key: "modern_framework".to_string(),
                        label: "Modern React/Next.js Architecture".to_string(),
                        matcher_type: MatcherType::TechFingerprint,
                        pattern: "next.js|webflow".to_string(),
                        expected_value: None,
                        confidence_weight: 0.95,
                    },
                ],
                matching_service_ids: vec!["srv_web_architecture".to_string()],
                reason_template: "{entity_name} has an unoptimized web presence with high potential for mobile conversion lift.".to_string(),
                scoring_weights: ScoringWeights::default(),
            },
            OpportunityDef {
                opportunity_id: "opp_automation".to_string(),
                name: "AI & Instant Messaging Workflow Automation".to_string(),
                category: "Operations & AI".to_string(),
                keywords: vec!["automation".to_string(), "workflow".to_string(), "ai".to_string(), "whatsapp".to_string()],
                target_entity_types: vec!["business".to_string(), "company".to_string(), "clinic".to_string(), "firm".to_string()],
                required_signals: vec![],
                positive_signals: vec![
                    SignalMatcher {
                        signal_key: "no_chat".to_string(),
                        label: "Direct WhatsApp / AI Chat".to_string(),
                        matcher_type: MatcherType::TechFingerprint,
                        pattern: "wa.me|whatsapp|intercom|tidio".to_string(),
                        expected_value: None,
                        confidence_weight: 0.95,
                    },
                ],
                negative_signals: vec![],
                matching_service_ids: vec!["srv_ai_automation".to_string()],
                reason_template: "{entity_name} relies on manual communication workflows without automated AI or instant lead routing.".to_string(),
                scoring_weights: ScoringWeights::default(),
            },
            OpportunityDef {
                opportunity_id: "opp_seo".to_string(),
                name: "Technical SEO & Search Visibility Optimization".to_string(),
                category: "Search & Visibility".to_string(),
                keywords: vec!["seo".to_string(), "ranking".to_string(), "search visibility".to_string()],
                target_entity_types: vec!["brand".to_string(), "ecommerce".to_string(), "company".to_string(), "practice".to_string()],
                required_signals: vec![],
                positive_signals: vec![
                    SignalMatcher {
                        signal_key: "missing_schema".to_string(),
                        label: "Schema.org Rich Data".to_string(),
                        matcher_type: MatcherType::SchemaCheck,
                        pattern: "application/ld+json".to_string(),
                        expected_value: None,
                        confidence_weight: 0.92,
                    },
                ],
                negative_signals: vec![],
                matching_service_ids: vec!["srv_seo_growth".to_string()],
                reason_template: "{entity_name} has missing structured schema data and untapped search ranking authority.".to_string(),
                scoring_weights: ScoringWeights::default(),
            },
            OpportunityDef {
                opportunity_id: "opp_video_brand".to_string(),
                name: "Commercial Video & Brand Experience Elevation".to_string(),
                category: "Media & Brand".to_string(),
                keywords: vec!["video".to_string(), "media".to_string(), "branding".to_string(), "rebrand".to_string(), "content".to_string()],
                target_entity_types: vec!["hotel".to_string(), "luxury".to_string(), "resort".to_string(), "brand".to_string(), "agency".to_string()],
                required_signals: vec![],
                positive_signals: vec![],
                negative_signals: vec![],
                matching_service_ids: vec!["srv_media_branding".to_string()],
                reason_template: "{entity_name} has strong market positioning ready for cinematic commercial video and brand elevation.".to_string(),
                scoring_weights: ScoringWeights::default(),
            },
        ];

        let resources = vec![
            ResourceDef {
                resource_id: "live_public_registry".to_string(),
                name: "OpenStreetMap & Official Municipal Index".to_string(),
                resource_type: ResourceType::PublicRegistry,
                supported_entity_types: vec!["*".to_string()],
                supported_industries: vec!["*".to_string()],
                geographic_coverage: vec!["Global".to_string()],
                discovery_support: true,
                research_support: true,
                reliability_score: 0.95,
            },
            ResourceDef {
                resource_id: "live_web_search".to_string(),
                name: "Real-Time Web Index & Deep Search".to_string(),
                resource_type: ResourceType::SearchEngine,
                supported_entity_types: vec!["*".to_string()],
                supported_industries: vec!["*".to_string()],
                geographic_coverage: vec!["Global".to_string()],
                discovery_support: true,
                research_support: true,
                reliability_score: 0.90,
            },
        ];

        let mut synonyms = HashMap::new();
        synonyms.insert("school".to_string(), vec!["academy".to_string(), "college".to_string(), "university".to_string(), "institute".to_string()]);
        synonyms.insert("clinic".to_string(), vec!["medical center".to_string(), "dental".to_string(), "hospital".to_string(), "practice".to_string()]);
        synonyms.insert("restaurant".to_string(), vec!["dining".to_string(), "bistro".to_string(), "cafe".to_string(), "eatery".to_string()]);
        synonyms.insert("real estate".to_string(), vec!["property".to_string(), "realty".to_string(), "brokerage".to_string()]);

        let vendor_blacklist_tokens = vec![
            "software".to_string(), "technologies".to_string(), "tech".to_string(), "solutions".to_string(),
            "erp system".to_string(), "systems".to_string(), "agency".to_string(), "consulting".to_string(),
            "digital agency".to_string(), "it solutions".to_string(), "saas".to_string(), "software provider".to_string(),
        ];

        Self {
            services,
            opportunities,
            resources,
            scoring_profiles: HashMap::new(),
            synonyms,
            vendor_blacklist_tokens,
        }
    }
}
