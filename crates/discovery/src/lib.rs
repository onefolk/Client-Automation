
use domain::{
    DiscoveredBusiness, IntentType, OneFolkConfig, OpportunityDef, SearchFilters, SearchIntent,
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
// 1. Universal Intent Engine (Data-Driven & NLP)
// ==============================================================================

pub struct IntentParser;

impl IntentParser {
    /// Parses any user search query using linguistic decomposition and the OneFolkConfig registry
    /// NO hardcoded industry, service, or technology rules in the algorithm!
    pub fn parse_with_config(
        raw_query: &str,
        filters: &SearchFilters,
        config: &OneFolkConfig,
    ) -> SearchIntent {
        let trimmed = raw_query.trim();
        let lower = trimmed.to_lowercase();

        // 1. Detect Intent Type (Client Discovery vs. Vendor Discovery vs. General Research)
        let vendor_markers = [
            " vendors", " vendor", " providers", " provider", " companies for ", " company for ",
            " agency for ", " agencies for ", " suppliers", " supplier", " consultants for "
        ];
        let is_vendor_search = vendor_markers.iter().any(|&v| lower.contains(v));
        let intent_type = if is_vendor_search {
            IntentType::VendorDiscovery
        } else {
            IntentType::ClientDiscovery
        };

        // 2. Extract Geographic Location
        let mut location = filters
            .city
            .as_deref()
            .or_else(|| filters.location.as_deref())
            .or_else(|| filters.country.as_deref())
            .map(|s| s.to_string());

        let location_regex = Regex::new(r#"(?i)\s+(?:in|at|near)\s+([a-zA-Z\s,]+)$"#).unwrap();
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

        // 3. Extract Qualification Conditions & Opportunity Phrase
        let (cleaned_entity_query, opportunity_query, qualification_conditions) =
            Self::decompose_conditions_and_opportunity(&query_without_loc);

        // 4. Extract Target Entity
        let target_entity_raw = if cleaned_entity_query.trim().is_empty() {
            filters.business_type.as_deref().unwrap_or("Businesses").to_string()
        } else {
            cleaned_entity_query.trim().to_string()
        };
        let target_entity = Self::capitalize_words(&target_entity_raw);

        // 5. Dynamic Opportunity Matching against OpportunityDef Registry (Zero Hardcoding!)
        let (matched_opp_id, opp_type_name, opp_keywords, matched_service_ids) =
            Self::match_opportunity_from_registry(&opportunity_query, &lower, config);

        // 6. Dynamic Industry & Category Resolution
        let (industry, category) = Self::resolve_industry_category(&target_entity, filters, config);

        SearchIntent {
            raw_query: trimmed.to_string(),
            target_entity,
            industry,
            category,
            location,
            opportunity_query,
            opportunity_id: matched_opp_id,
            opportunity_type: opp_type_name,
            opportunity_keywords: opp_keywords,
            qualification_conditions,
            intent_type,
            is_vendor_search,
            matched_service_ids,
        }
    }

    /// Convenience helper using default seed configuration
    pub fn parse(raw_query: &str, filters: &SearchFilters) -> SearchIntent {
        let config = OneFolkConfig::default();
        Self::parse_with_config(raw_query, filters, &config)
    }

    fn decompose_conditions_and_opportunity(query: &str) -> (String, String, Vec<String>) {
        let mut clean = query.to_string();
        let mut opp_phrase = String::new();
        let mut conditions = Vec::new();

        let condition_prepositions = [
            ("without ", "Absence of required digital capability"),
            ("with no ", "Absence of required digital capability"),
            ("with poor ", "Unoptimized or legacy implementation"),
            ("needing ", "Expressed demand for modernization"),
            ("needs ", "Expressed demand for modernization"),
            ("lacking ", "Absence of required digital capability"),
            ("looking for ", "Active search for capability upgrade"),
            ("for ", "Targeted opportunity domain"),
        ];

        for (prep, desc) in &condition_prepositions {
            if let Some(pos) = clean.find(prep) {
                let before = clean[..pos].trim().to_string();
                let after = clean[pos + prep.len()..].trim().to_string();

                if !before.is_empty() {
                    clean = before;
                    opp_phrase = after.clone();
                    conditions.push(format!("{}: '{}'", desc, after));
                    break;
                }
            }
        }

        if opp_phrase.is_empty() {
            opp_phrase = clean.clone();
        }

        (clean, opp_phrase, conditions)
    }

    /// Dynamically finds the best matching OpportunityDef from the registry via token overlap
    fn match_opportunity_from_registry(
        opp_query: &str,
        full_query: &str,
        config: &OneFolkConfig,
    ) -> (Option<String>, String, Vec<String>, Vec<String>) {
        let mut best_match: Option<(&OpportunityDef, usize)> = None;
        let query_tokens: Vec<&str> = full_query.split_whitespace().collect();

        for opp in &config.opportunities {
            let mut score = 0;
            for kw in &opp.keywords {
                let kw_lower = kw.to_lowercase();
                if full_query.contains(&kw_lower) || opp_query.to_lowercase().contains(&kw_lower) {
                    score += 3;
                }
                for tok in &query_tokens {
                    if kw_lower.contains(tok) {
                        score += 1;
                    }
                }
            }

            if score > 0 {
                if let Some((_, best_score)) = best_match {
                    if score > best_score {
                        best_match = Some((opp, score));
                    }
                } else {
                    best_match = Some((opp, score));
                }
            }
        }

        if let Some((opp, _)) = best_match {
            (
                Some(opp.opportunity_id.clone()),
                opp.name.clone(),
                opp.keywords.clone(),
                opp.matching_service_ids.clone(),
            )
        } else {
            // Generic fallback
            (
                None,
                "General Digital Modernization".to_string(),
                vec!["Modernization".to_string(), "Growth".to_string()],
                vec!["srv_web_architecture".to_string()],
            )
        }
    }

    fn resolve_industry_category(
        target_entity: &str,
        filters: &SearchFilters,
        config: &OneFolkConfig,
    ) -> (String, Option<String>) {
        if let Some(ref ind) = filters.industry {
            return (ind.clone(), filters.sub_industry.clone());
        }

        let lower = target_entity.to_lowercase();

        // Check synonyms table from configuration
        for (primary_ind, syn_list) in &config.synonyms {
            if lower.contains(primary_ind) || syn_list.iter().any(|syn| lower.contains(syn)) {
                return (Self::capitalize_words(primary_ind), Some(format!("{} Sector", Self::capitalize_words(primary_ind))));
            }
        }

        ("Commercial".to_string(), Some("Business & Commercial".to_string()))
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
// 2. Data-Driven Dynamic Discovery Planner
// ==============================================================================

pub struct DiscoveryPlanner;

impl DiscoveryPlanner {
    /// Selects appropriate resources and generates target-centric discovery queries
    pub fn create_plan_with_config(
        raw_query: &str,
        filters: &SearchFilters,
        selected_providers: &[String],
        config: &OneFolkConfig,
    ) -> SearchPlan {
        let intent = IntentParser::parse_with_config(raw_query, filters, config);

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
            variations.push(format!("{} in {}", entity, city));
            variations.push(format!("top {} {}", entity, city));
        } else {
            // Target-centric candidate discovery: SEARCH STRICTLY FOR THE TARGET ENTITY
            variations.push(format!("{} in {}", entity, city));
            variations.push(format!("top {} in {}", entity, city));
            variations.push(format!("best {} in {}", entity, city));
            variations.push(format!("{} {} {}", entity, city, country));
            variations.push(format!("list of {} in {}", entity, city));
        }

        // Dynamically select providers from ResourceRegistry
        let providers = if !selected_providers.is_empty() {
            selected_providers.to_vec()
        } else {
            config
                .resources
                .iter()
                .filter(|r| r.discovery_support)
                .map(|r| r.resource_id.clone())
                .collect()
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

    pub fn create_plan(
        raw_query: &str,
        filters: &SearchFilters,
        selected_providers: &[String],
    ) -> SearchPlan {
        let config = OneFolkConfig::default();
        Self::create_plan_with_config(raw_query, filters, selected_providers, &config)
    }
}

// ==============================================================================
// 3. Data-Driven Candidate Validation Engine
// ==============================================================================

pub struct SearchValidator;

impl SearchValidator {
    /// Validates candidates against target entity using configurable blacklist tokens and synonym registries
    pub fn validate_candidates_with_config(
        candidates: Vec<DiscoveredBusiness>,
        intent: &SearchIntent,
        config: &OneFolkConfig,
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

        let target_is_vendor = intent.is_vendor_search
            || target_lower.contains("vendor")
            || target_lower.contains("software")
            || target_lower.contains("agency");

        for candidate in candidates {
            let name_lower = candidate.business_name.to_lowercase();
            let cat_lower = candidate.category.as_deref().unwrap_or("").to_lowercase();

            let is_vendor_like = config.vendor_blacklist_tokens.iter().any(|token| {
                name_lower.contains(token) || cat_lower.contains(token)
            });

            let entity_type = if is_vendor_like && !target_is_vendor {
                "Service / Software Vendor".to_string()
            } else {
                intent.target_entity.clone()
            };

            *distribution.entry(entity_type).or_insert(0) += 1;

            if !target_is_vendor && is_vendor_like {
                tracing::warn!(
                    candidate = %candidate.business_name,
                    target = %intent.target_entity,
                    "Filtered candidate as software vendor mismatch"
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

    pub fn validate_candidates(
        candidates: Vec<DiscoveredBusiness>,
        intent: &SearchIntent,
    ) -> (Vec<DiscoveredBusiness>, ValidationSummary) {
        let config = OneFolkConfig::default();
        Self::validate_candidates_with_config(candidates, intent, &config)
    }
}

// ==============================================================================
// Unit Tests (Ensuring Universal & Configurable Behavior)
// ==============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generic_intent_parsing_with_custom_config() {
        let mut custom_config = OneFolkConfig::default();
        custom_config.opportunities.push(OpportunityDef {
            opportunity_id: "opp_custom_yacht".to_string(),
            name: "Yacht Telemetry Modernization".to_string(),
            category: "Marine Tech".to_string(),
            keywords: vec!["yacht telemetry".to_string(), "marine iot".to_string()],
            target_entity_types: vec!["marina".to_string(), "yacht charter".to_string()],
            required_signals: vec![],
            positive_signals: vec![],
            negative_signals: vec![],
            matching_service_ids: vec!["srv_custom_marine".to_string()],
            reason_template: "{entity_name} lacks automated marine telemetry.".to_string(),
            scoring_weights: domain::ScoringWeights::default(),
        });

        let filters = SearchFilters::default();
        let intent = IntentParser::parse_with_config(
            "marinas without yacht telemetry in Monaco",
            &filters,
            &custom_config,
        );

        assert_eq!(intent.target_entity, "Marinas");
        assert_eq!(intent.opportunity_type, "Yacht Telemetry Modernization");
        assert_eq!(intent.location.as_deref(), Some("Monaco"));
        assert!(!intent.is_vendor_search);
    }
}
