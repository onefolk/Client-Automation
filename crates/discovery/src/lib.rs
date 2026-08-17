use domain::{
    DiscoveredBusiness, EvidenceStatus, OpportunityType, SearchFilters, SearchIntent,
    ValidationSummary,
};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderSearchStrategy {
    pub provider_id: String,
    pub query_variations: Vec<String>,
    pub limit: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchPlan {
    pub original_query: String,
    pub intent: SearchIntent,
    pub strategies: Vec<ProviderSearchStrategy>,
}

// ==============================================================================
// 1. Universal Intent Parser
// ==============================================================================

pub struct IntentParser;

impl IntentParser {
    /// Parses natural language query into structured SearchIntent
    /// Decouples Target Entity from Opportunity/Service/Problem
    pub fn parse(raw_query: &str, filters: &SearchFilters) -> SearchIntent {
        let trimmed = raw_query.trim();
        let lower = trimmed.to_lowercase();

        // 1. Detect Vendor Intent vs Buyer Client Intent
        let vendor_indicators = [
            " vendors", " vendor", " providers", " provider", " companies for ", " company for ",
            " agency for ", " agencies for ", " suppliers", " supplier", " consultants for "
        ];
        let is_vendor_search = vendor_indicators.iter().any(|&v| lower.contains(v));

        // 2. Extract Location
        let mut location = filters
            .city
            .as_deref()
            .or_else(|| filters.location.as_deref())
            .or_else(|| filters.country.as_deref())
            .map(|s| s.to_string());

        let location_regex = Regex::new(r#"(?i)\s+in\s+([a-zA-Z\s,]+)$"#).unwrap();
        let query_without_loc = if let Some(caps) = location_regex.captures(&lower) {
            if let Some(loc_match) = caps.get(1) {
                let parsed_loc = loc_match.as_str().trim().to_string();
                if location.is_none() || location.as_deref() == Some("Dubai") {
                    location = Some(Self::capitalize_words(&parsed_loc));
                }
            }
            location_regex.replace(&lower, "").to_string()
        } else {
            lower.clone()
        };

        // 3. Detect Opportunity Type and Keywords
        let (opportunity_type, opp_keywords, qualification_conditions) =
            Self::detect_opportunity(&query_without_loc);

        // 4. Extract Target Entity & Industry
        let (target_entity, industry, category) = if is_vendor_search {
            let entity = Self::capitalize_words(&query_without_loc);
            let ind = filters.industry.clone().unwrap_or_else(|| "Technology & Software".to_string());
            (entity, ind, Some("Vendors & Service Providers".to_string()))
        } else {
            Self::extract_target_entity(&query_without_loc, &opportunity_type, filters)
        };

        SearchIntent {
            raw_query: trimmed.to_string(),
            target_entity,
            industry,
            category,
            location,
            opportunity_type,
            opportunity_keywords: opp_keywords,
            qualification_conditions,
            is_vendor_search,
        }
    }

    fn detect_opportunity(cleaned_query: &str) -> (OpportunityType, Vec<String>, Vec<String>) {
        let q = cleaned_query;
        let mut conditions = Vec::new();

        // Check for specific opportunity patterns
        if q.contains("erp") || q.contains("student portal") || q.contains("school management") || q.contains("lms") {
            if q.contains("without erp") || q.contains("needing erp") || q.contains("no erp") {
                conditions.push("Lacks integrated ERP or modern administrative portal".to_string());
            } else {
                conditions.push("Evaluate ERP / digital management systems".to_string());
            }
            return (
                OpportunityType::Erp,
                vec!["ERP".to_string(), "Student Portal".to_string(), "Fee Management".to_string(), "LMS".to_string()],
                conditions,
            );
        }

        if q.contains("booking") || q.contains("reservation") || q.contains("appointment") || q.contains("scheduling") {
            if q.contains("without") || q.contains("no ") || q.contains("needing") {
                conditions.push("Lacks direct online booking / scheduling engine".to_string());
            } else {
                conditions.push("Check online booking & reservation capabilities".to_string());
            }
            return (
                OpportunityType::Booking,
                vec!["Online Booking".to_string(), "Instant Scheduling".to_string(), "Calendar Sync".to_string()],
                conditions,
            );
        }

        if q.contains("crm") || q.contains("lead") || q.contains("pipeline") || q.contains("inquiry") {
            if q.contains("without crm") || q.contains("needing crm") || q.contains("no crm") || q.contains("lead automation") {
                conditions.push("No automated CRM capture or lead nurture pipeline".to_string());
            } else {
                conditions.push("Evaluate CRM adoption and lead capture funnels".to_string());
            }
            return (
                OpportunityType::Crm,
                vec!["CRM".to_string(), "Lead Capture".to_string(), "Sales Pipeline".to_string(), "WhatsApp CRM".to_string()],
                conditions,
            );
        }

        if q.contains("automation") || q.contains("automate") || q.contains("workflow") || q.contains("whatsapp flow") {
            conditions.push("Manual operational processes and disconnected systems".to_string());
            return (
                OpportunityType::Automation,
                vec!["Workflow Automation".to_string(), "WhatsApp API".to_string(), "Auto Responders".to_string()],
                conditions,
            );
        }

        if q.contains("seo") || q.contains("ranking") || q.contains("search visibility") || q.contains("google search") {
            conditions.push("Underperforming organic search traffic and technical SEO gaps".to_string());
            return (
                OpportunityType::Seo,
                vec!["Technical SEO".to_string(), "Keyword Rankings".to_string(), "Schema Markup".to_string()],
                conditions,
            );
        }

        if q.contains("website") || q.contains("web") || q.contains("redesign") || q.contains("mobile") || q.contains("landing page") {
            if q.contains("needing") || q.contains("without") || q.contains("poor") || q.contains("outdated") {
                conditions.push("Outdated or missing custom mobile web experience".to_string());
            } else {
                conditions.push("Analyze website UX, mobile speed, and conversion design".to_string());
            }
            return (
                OpportunityType::Website,
                vec!["Custom Web Design".to_string(), "Mobile Optimization".to_string(), "Conversion Architecture".to_string()],
                conditions,
            );
        }

        // Generic / Custom Opportunity
        (
            OpportunityType::Custom,
            vec!["Digital Transformation".to_string(), "Client Acquisition".to_string(), "Operations".to_string()],
            vec!["Analyze general digital maturity, tech stack, and growth bottlenecks".to_string()],
        )
    }

    fn extract_target_entity(
        query: &str,
        opp_type: &OpportunityType,
        filters: &SearchFilters,
    ) -> (String, String, Option<String>) {
        let mut clean = query.to_string();

        // Strip condition prepositions
        let condition_patterns = [
            "needing ", "needs ", "without ", "with poor ", "with no ", "lacking ", "looking for ",
            "for ", "with "
        ];
        for pat in &condition_patterns {
            if let Some(pos) = clean.find(pat) {
                // If entity is before preposition (e.g. "schools needing ERP")
                let before = clean[..pos].trim();
                let after = clean[pos + pat.len()..].trim();

                if !before.is_empty() && !Self::is_pure_opportunity_word(before) {
                    clean = before.to_string();
                    break;
                } else if !after.is_empty() && !Self::is_pure_opportunity_word(after) {
                    clean = after.to_string();
                    break;
                }
            }
        }

        // Strip opportunity keywords if prepended (e.g. "ERP schools" -> "schools")
        let opp_words = ["erp ", "crm ", "seo ", "website ", "booking ", "automation "];
        for word in &opp_words {
            if clean.starts_with(word) {
                clean = clean.strip_prefix(word).unwrap_or(&clean).trim().to_string();
            }
        }

        let entity_raw = if clean.trim().is_empty() {
            filters.business_type.as_deref().unwrap_or("Businesses").to_string()
        } else {
            clean.trim().to_string()
        };

        let target_entity = Self::capitalize_words(&entity_raw);
        let (industry, category) = Self::infer_industry(&target_entity, filters);

        (target_entity, industry, category)
    }

    fn is_pure_opportunity_word(w: &str) -> bool {
        let trimmed = w.trim().to_lowercase();
        matches!(
            trimmed.as_str(),
            "erp" | "crm" | "seo" | "website" | "web" | "booking" | "automation" | "lead automation" | "online booking"
        )
    }

    fn infer_industry(target_entity: &str, filters: &SearchFilters) -> (String, Option<String>) {
        if let Some(ref ind) = filters.industry {
            return (ind.clone(), filters.sub_industry.clone());
        }

        let lower = target_entity.to_lowercase();
        if lower.contains("school") || lower.contains("university") || lower.contains("college") || lower.contains("academy") || lower.contains("kindergarten") || lower.contains("education") {
            ("Education".to_string(), Some("K-12 & Higher Education".to_string()))
        } else if lower.contains("clinic") || lower.contains("dental") || lower.contains("hospital") || lower.contains("healthcare") || lower.contains("doctor") || lower.contains("medical") {
            ("Healthcare".to_string(), Some("Medical & Dental Practices".to_string()))
        } else if lower.contains("restaurant") || lower.contains("cafe") || lower.contains("dining") || lower.contains("bistro") || lower.contains("bakery") || lower.contains("bar") {
            ("Hospitality".to_string(), Some("Food & Beverage".to_string()))
        } else if lower.contains("hotel") || lower.contains("resort") || lower.contains("spa") || lower.contains("wellness") {
            ("Hospitality".to_string(), Some("Hotels & Wellness".to_string()))
        } else if lower.contains("real estate") || lower.contains("property") || lower.contains("realtor") || lower.contains("brokerage") {
            ("Real Estate".to_string(), Some("Commercial & Residential Real Estate".to_string()))
        } else if lower.contains("law") || lower.contains("legal") || lower.contains("attorney") || lower.contains("solicitor") {
            ("Legal".to_string(), Some("Law Firms & Legal Practices".to_string()))
        } else if lower.contains("ecommerce") || lower.contains("brand") || lower.contains("retail") || lower.contains("store") || lower.contains("shop") {
            ("Retail & Ecommerce".to_string(), Some("Consumer Brands & Retail".to_string()))
        } else if lower.contains("gym") || lower.contains("fitness") || lower.contains("crossfit") || lower.contains("studio") {
            ("Fitness & Wellness".to_string(), Some("Gyms & Fitness Centers".to_string()))
        } else if lower.contains("accounting") || lower.contains("cpa") || lower.contains("finance") || lower.contains("tax") {
            ("Financial Services".to_string(), Some("Accounting & Tax Advisory".to_string()))
        } else if lower.contains("construction") || lower.contains("contractor") || lower.contains("builder") {
            ("Construction".to_string(), Some("Contractors & Builders".to_string()))
        } else {
            ("Commercial".to_string(), Some("General Business Services".to_string()))
        }
    }

    fn capitalize_words(s: &str) -> String {
        s.split_whitespace()
            .map(|word| {
                let mut chars = word.chars();
                match chars.next() {
                    None => String::new(),
                    Some(f) => f.to_uppercase().collect::<String>() + chars.as_str(),
                }
            })
            .collect::<Vec<_>>()
            .join(" ")
    }
}

// ==============================================================================
// 2. Target-Entity-Centric Discovery Planner
// ==============================================================================

pub struct DiscoveryPlanner;

impl DiscoveryPlanner {
    /// Constructs targeted entity discovery queries strictly from Target Entity, Industry, and Location
    /// NEVER injects opportunity keywords to avoid vendor pollution
    pub fn create_plan(
        raw_query: &str,
        filters: &SearchFilters,
        selected_providers: &[String],
    ) -> SearchPlan {
        let intent = IntentParser::parse(raw_query, filters);

        let city = intent
            .location
            .clone()
            .or_else(|| filters.city.clone())
            .or_else(|| filters.location.clone())
            .unwrap_or_else(|| "Dubai".to_string());

        let country = filters.country.clone().unwrap_or_else(|| "UAE".to_string());

        let mut variations = Vec::new();
        let entity = &intent.target_entity;

        if intent.is_vendor_search {
            // Vendor search: search for providers directly
            variations.push(format!("{} in {}", entity, city));
            variations.push(format!("top {} {}", entity, city));
        } else {
            // Client discovery: SEARCH ONLY FOR THE TARGET ENTITY
            variations.push(format!("{} in {}", entity, city));
            variations.push(format!("top {} in {}", entity, city));
            variations.push(format!("best {} in {}", entity, city));
            variations.push(format!("{} {} {}", entity, city, country));
            variations.push(format!("list of {} in {}", entity, city));
        }

        let providers = if selected_providers.is_empty() {
            vec!["live_public_registry".to_string(), "live_web_search".to_string()]
        } else {
            selected_providers.to_vec()
        };

        let strategies = providers
            .into_iter()
            .map(|pid| ProviderSearchStrategy {
                provider_id: pid,
                query_variations: variations.clone(),
                limit: 15,
            })
            .collect();

        SearchPlan {
            original_query: raw_query.trim().to_string(),
            intent,
            strategies,
        }
    }
}

// ==============================================================================
// 3. Search Validator
// ==============================================================================

pub struct SearchValidator;

impl SearchValidator {
    /// Validates candidates against target entity and filters out false vendor results
    pub fn validate_candidates(
        candidates: Vec<DiscoveredBusiness>,
        intent: &SearchIntent,
    ) -> (Vec<DiscoveredBusiness>, ValidationSummary) {
        if candidates.is_empty() {
            return (
                candidates,
                ValidationSummary {
                    target_entity: intent.target_entity.clone(),
                    total_candidates: 0,
                    valid_candidates: 0,
                    match_ratio: 1.0,
                    detected_entity_distribution: HashMap::new(),
                    regenerated: false,
                },
            );
        }

        let mut valid_candidates = Vec::new();
        let mut distribution = HashMap::new();
        let target_lower = intent.target_entity.to_lowercase();

        let vendor_blacklist_tokens = [
            "software", "technologies", "tech", "solutions", "erp system", "systems",
            "agency", "consulting", "services pvt", "digital agency", "it solutions",
            "saas", "software provider"
        ];

        let target_is_vendor = intent.is_vendor_search
            || target_lower.contains("vendor")
            || target_lower.contains("software")
            || target_lower.contains("agency");

        for candidate in candidates {
            let name_lower = candidate.business_name.to_lowercase();
            let cat_lower = candidate.category.as_deref().unwrap_or("").to_lowercase();

            let is_vendor_like = vendor_blacklist_tokens.iter().any(|&token| {
                name_lower.contains(token) || cat_lower.contains(token)
            });

            let entity_type = if is_vendor_like && !target_is_vendor {
                "Service / Software Vendor".to_string()
            } else {
                intent.target_entity.clone()
            };

            *distribution.entry(entity_type.clone()).or_insert(0) += 1;

            // If we are searching for clients (e.g. schools, clinics), reject entities that are software vendors
            if !target_is_vendor && is_vendor_like {
                tracing::warn!(
                    candidate = %candidate.business_name,
                    target = %intent.target_entity,
                    "Filtered out candidate as software vendor mismatch"
                );
                continue;
            }

            valid_candidates.push(candidate);
        }

        let total = distribution.values().sum::<usize>();
        let valid_count = valid_candidates.len();
        let match_ratio = if total > 0 {
            valid_count as f64 / total as f64
        } else {
            1.0
        };

        let summary = ValidationSummary {
            target_entity: intent.target_entity.clone(),
            total_candidates: total,
            valid_candidates: valid_count,
            match_ratio,
            detected_entity_distribution: distribution,
            regenerated: match_ratio < 0.4 && total >= 5,
        };

        (valid_candidates, summary)
    }
}

// ==============================================================================
// Unit Tests
// ==============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_intent_parsing_erp_schools() {
        let filters = SearchFilters::default();
        let intent = IntentParser::parse("ERP schools in Dubai", &filters);
        assert_eq!(intent.target_entity, "Schools");
        assert_eq!(intent.opportunity_type, OpportunityType::Erp);
        assert_eq!(intent.location.as_deref(), Some("Dubai"));
        assert!(!intent.is_vendor_search);
    }

    #[test]
    fn test_intent_parsing_clinics_booking() {
        let filters = SearchFilters::default();
        let intent = IntentParser::parse("clinics without online booking in London", &filters);
        assert_eq!(intent.target_entity, "Clinics");
        assert_eq!(intent.opportunity_type, OpportunityType::Booking);
        assert_eq!(intent.location.as_deref(), Some("London"));
        assert!(!intent.is_vendor_search);
    }

    #[test]
    fn test_intent_parsing_vendor_intent() {
        let filters = SearchFilters::default();
        let intent = IntentParser::parse("school ERP vendors in Dubai", &filters);
        assert!(intent.is_vendor_search);
    }

    #[test]
    fn test_discovery_planner_no_opportunity_pollution() {
        let filters = SearchFilters::default();
        let plan = DiscoveryPlanner::create_plan("ERP schools in Dubai", &filters, &["live_web_search".to_string()]);
        assert_eq!(plan.intent.target_entity, "Schools");
        for strat in plan.strategies {
            for variation in strat.query_variations {
                // Ensure opportunity keyword "ERP" is NOT in the entity discovery query!
                assert!(!variation.to_lowercase().contains("erp"));
                assert!(variation.to_lowercase().contains("schools"));
            }
        }
    }
}
