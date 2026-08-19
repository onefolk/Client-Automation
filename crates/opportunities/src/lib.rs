use chrono::Utc;
use domain::{
    Business, ClientPriority, EvidenceSignal, EvidenceStatus, Freshness, OneFolkConfig,
    OneFolkServiceDef, Opportunity, OpportunityEvaluation, OpportunityImpact,
    SearchIntent, Technology,
};
use uuid::Uuid;

pub struct OpportunityEngine;

impl OpportunityEngine {
    /// Fully generic, data-driven opportunity evaluator and OneFolk capability matcher
    /// ZERO hardcoded industry or product special-casing!
    pub fn evaluate_business_with_config(
        business: &Business,
        intent: &SearchIntent,
        _technologies: &[Technology],
        collected_evidence: &[EvidenceSignal],
        config: &OneFolkConfig,
    ) -> (OpportunityEvaluation, Vec<Opportunity>, ClientPriority, i32) {
        let mut evidence_signals = collected_evidence.to_vec();
        let mut opportunities = Vec::new();

        // 1. Resolve Opportunity Definition from Registry
        let opp_def_opt = intent
            .opportunity_id
            .as_deref()
            .and_then(|id| config.opportunities.iter().find(|o| o.opportunity_id == id))
            .or_else(|| {
                config.opportunities.iter().find(|o| {
                    o.keywords.iter().any(|kw| {
                        intent.raw_query.to_lowercase().contains(&kw.to_lowercase())
                            || intent.opportunity_type.to_lowercase().contains(&kw.to_lowercase())
                    })
                })
            });

        // 2. Evaluate Base Evidence & Gap Analysis
        let has_website = business.has_website && business.website.is_some();
        let has_contacts = business.email.is_some() || business.phone.is_some();
        let review_count = business.review_count;
        let rating = business.rating.unwrap_or(4.0);

        // Add standard digital foundation evidence if not already present
        if !evidence_signals.iter().any(|e| e.key == "primary_domain") {
            evidence_signals.push(EvidenceSignal {
                key: "primary_domain".to_string(),
                label: "Official Digital Presence".to_string(),
                status: if has_website {
                    EvidenceStatus::Detected
                } else {
                    EvidenceStatus::NotDetected
                },
                details: business.website.clone(),
                confidence: 0.98,
                source: "crawler_inspection".to_string(),
                freshness: Freshness::Current,
                timestamp: Utc::now(),
            });
        }

        if !evidence_signals.iter().any(|e| e.key == "ssl_security") {
            evidence_signals.push(EvidenceSignal {
                key: "ssl_security".to_string(),
                label: "HTTPS SSL Certificate".to_string(),
                status: if business.has_ssl {
                    EvidenceStatus::Detected
                } else if has_website {
                    EvidenceStatus::NotDetected
                } else {
                    EvidenceStatus::Unknown
                },
                details: Some(format!("SSL status: {}", business.has_ssl)),
                confidence: 0.99,
                source: "crawler_inspection".to_string(),
                freshness: Freshness::Current,
                timestamp: Utc::now(),
            });
        }

        // 3. Generic Factor Scoring (All Weights from Config)
        let default_weights = config
            .scoring_profiles
            .get("default")
            .cloned()
            .unwrap_or_default();
        let weights = opp_def_opt
            .map(|o| &o.scoring_weights)
            .unwrap_or(&default_weights);

        let target_match_score = 90.0; // High confidence in validated candidate

        let _positive_gaps_count = evidence_signals
            .iter()
            .filter(|e| e.status == EvidenceStatus::Detected || e.status == EvidenceStatus::NotDetected)
            .count();
        let digital_gap_score = if !has_website {
            95.0
        } else if !business.has_ssl {
            80.0
        } else {
            65.0
        };

        let avg_confidence = if !evidence_signals.is_empty() {
            evidence_signals.iter().map(|e| e.confidence).sum::<f64>()
                / evidence_signals.len() as f64
        } else {
            0.85
        };
        let evidence_quality_score = avg_confidence * 100.0;

        let scale_score = ((review_count as f64 / 20.0).min(50.0) + (rating / 5.0) * 50.0).min(100.0);
        let contact_bonus = if has_contacts { 15.0 } else { 0.0 };

        let composite_score = (weights.target_match_weight * target_match_score
            + weights.digital_gap_weight * digital_gap_score
            + weights.evidence_quality_weight * evidence_quality_score
            + weights.business_scale_weight * scale_score
            + contact_bonus)
            .round() as i32;

        let final_score = composite_score.clamp(30, 98);

        // 4. Resolve Matching OneFolk Service Capability from ServiceRegistry
        let matched_service: Option<&OneFolkServiceDef> = if let Some(opp_def) = opp_def_opt {
            opp_def
                .matching_service_ids
                .first()
                .and_then(|sid| config.services.iter().find(|s| &s.service_id == sid))
        } else {
            config.services.first()
        };

        let service_name = matched_service
            .map(|s| s.name.clone())
            .unwrap_or_else(|| format!("OneFolk Growth & AI Modernization for {}", intent.target_entity));

        let service_tier = matched_service
            .map(|s| s.service_tier.clone())
            .unwrap_or_else(|| "ENTERPRISE".to_string());

        let estimated_value = matched_service
            .and_then(|s| s.estimated_value.clone())
            .or_else(|| Some("$5,000 - $15,000".to_string()));

        // 5. Dynamic Reason Formatting
        let reason = if let Some(opp_def) = opp_def_opt {
            opp_def
                .reason_template
                .replace("{entity_name}", &business.name)
                .replace("{target_entity}", &intent.target_entity)
                .replace("{opportunity_name}", &opp_def.name)
        } else {
            format!(
                "{} has high potential for {} modernization and digital revenue acceleration.",
                business.name, intent.opportunity_type
            )
        };

        let opp_category = opp_def_opt
            .map(|o| o.category.clone())
            .unwrap_or_else(|| "Digital Transformation".to_string());

        let opp_title = opp_def_opt
            .map(|o| o.name.clone())
            .unwrap_or_else(|| service_name.clone());

        let impact = if final_score >= 75 {
            OpportunityImpact::High
        } else if final_score >= 55 {
            OpportunityImpact::Medium
        } else {
            OpportunityImpact::Low
        };

        let primary_opp = Opportunity {
            id: Uuid::new_v4(),
            business_id: business.id,
            title: opp_title,
            description: reason.clone(),
            category: opp_category,
            impact,
            onefolk_service: service_name.clone(),
            service_tier: service_tier.clone(),
            confidence: avg_confidence,
            estimated_revenue_potential: estimated_value.clone(),
            evidence: evidence_signals
                .iter()
                .map(|e| format!("{}: {}", e.label, e.status))
                .collect(),
            status: "IDENTIFIED".to_string(),
            created_at: Utc::now(),
        };

        opportunities.push(primary_opp);

        let priority = if final_score >= 75 {
            ClientPriority::High
        } else if final_score >= 50 {
            ClientPriority::Medium
        } else {
            ClientPriority::Low
        };

        let evaluation = OpportunityEvaluation {
            score: final_score,
            confidence: avg_confidence,
            reason,
            evidence_signals,
            recommended_service: service_name,
            service_tier,
            estimated_value,
            matched_service_id: matched_service.map(|s| s.service_id.clone()),
        };

        (evaluation, opportunities, priority, final_score)
    }

    /// Convenience evaluator using default OneFolkConfig
    pub fn evaluate_business_with_intent(
        business: &Business,
        intent: &SearchIntent,
        technologies: &[Technology],
        _facts: &[domain::Fact],
    ) -> (OpportunityEvaluation, Vec<Opportunity>, ClientPriority, i32) {
        let config = OneFolkConfig::default();
        Self::evaluate_business_with_config(business, intent, technologies, &[], &config)
    }

    /// Backward compatibility fallback
    pub fn evaluate_business(business: &Business) -> (Vec<Opportunity>, ClientPriority, i32) {
        let dummy_intent = SearchIntent {
            raw_query: "general discovery".to_string(),
            target_entity: business.industry.clone(),
            industry: business.industry.clone(),
            category: business.sub_industry.clone(),
            location: business.city.clone(),
            opportunity_query: "Modernization".to_string(),
            opportunity_id: None,
            opportunity_type: "Digital Modernization".to_string(),
            opportunity_keywords: vec![],
            qualification_conditions: vec![],
            intent_type: domain::IntentType::ClientDiscovery,
            is_vendor_search: false,
            matched_service_ids: vec![],
        };

        let (_eval, opps, priority, score) =
            Self::evaluate_business_with_intent(business, &dummy_intent, &[], &[]);
        (opps, priority, score)
    }
}
