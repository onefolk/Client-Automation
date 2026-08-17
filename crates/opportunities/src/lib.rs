use chrono::Utc;
use domain::{
    Business, ClientPriority, EvidenceSignal, EvidenceStatus, Fact, Opportunity,
    OpportunityEvaluation, OpportunityImpact, OpportunityType, SearchIntent, Technology,
};
use uuid::Uuid;

pub struct OpportunityEngine;

impl OpportunityEngine {
    /// Evaluates a business against the parsed search intent and detected technical/public evidence
    pub fn evaluate_business_with_intent(
        business: &Business,
        intent: &SearchIntent,
        technologies: &[Technology],
        _facts: &[Fact],
    ) -> (OpportunityEvaluation, Vec<Opportunity>, ClientPriority, i32) {
        let mut evidence_signals = Vec::new();
        let mut opportunities = Vec::new();
        let mut score = 50; // Base baseline score

        let tech_names_lower: Vec<String> =
            technologies.iter().map(|t| t.name.to_lowercase()).collect();
        let tech_cats_lower: Vec<String> =
            technologies.iter().map(|t| t.category.to_lowercase()).collect();

        // Contact Signals (Universal)
        let has_contact = business.email.is_some() || business.phone.is_some();
        if has_contact {
            score += 10;
        }

        // Reputation Momentum (Universal)
        let rating = business.rating.unwrap_or(0.0);
        let review_count = business.review_count;
        let strong_reputation = review_count >= 15 && rating >= 4.0;

        let (eval, opp) = match intent.opportunity_type {
            OpportunityType::Erp => {
                Self::evaluate_erp(business, technologies, &tech_names_lower, &tech_cats_lower, &mut evidence_signals, &mut score)
            }
            OpportunityType::Booking => {
                Self::evaluate_booking(business, technologies, &tech_names_lower, &tech_cats_lower, &mut evidence_signals, &mut score)
            }
            OpportunityType::Crm => {
                Self::evaluate_crm(business, technologies, &tech_names_lower, &tech_cats_lower, &mut evidence_signals, &mut score)
            }
            OpportunityType::Automation => {
                Self::evaluate_automation(business, technologies, &tech_names_lower, &tech_cats_lower, &mut evidence_signals, &mut score)
            }
            OpportunityType::Seo => {
                Self::evaluate_seo(business, technologies, &tech_names_lower, &tech_cats_lower, &mut evidence_signals, &mut score)
            }
            OpportunityType::Website => {
                Self::evaluate_website(business, technologies, &tech_names_lower, &tech_cats_lower, &mut evidence_signals, &mut score)
            }
            OpportunityType::Custom => {
                Self::evaluate_custom(business, technologies, &tech_names_lower, &tech_cats_lower, intent, &mut evidence_signals, &mut score)
            }
        };

        opportunities.push(opp);

        // Secondary Opportunity: High Reputation Without Retention Engine
        if strong_reputation && intent.opportunity_type != OpportunityType::Automation {
            opportunities.push(Opportunity {
                id: Uuid::new_v4(),
                business_id: business.id,
                title: "Automated VIP Client Retention & Review Monetization".to_string(),
                description: format!(
                    "High customer volume (★ {:.1} across {} reviews) ready for automated re-engagement.",
                    rating, review_count
                ),
                category: "Automation & Retention".to_string(),
                impact: OpportunityImpact::Medium,
                onefolk_service: "Omnichannel Client Retention Engine".to_string(),
                service_tier: "GROWTH".to_string(),
                confidence: 0.88,
                estimated_revenue_potential: Some("$2,500 - $6,000/mo".to_string()),
                evidence: vec![format!("{} verified public reviews with {:.1} rating", review_count, rating)],
                status: "IDENTIFIED".to_string(),
                created_at: Utc::now(),
            });
        }

        let priority = if score >= 80 {
            ClientPriority::High
        } else if score >= 60 {
            ClientPriority::Medium
        } else {
            ClientPriority::Low
        };

        (eval, opportunities, priority, score)
    }

    /// Legacy backward-compatible evaluation
    pub fn evaluate_business(business: &Business) -> (Vec<Opportunity>, ClientPriority, i32) {
        let dummy_intent = SearchIntent {
            raw_query: "general discovery".to_string(),
            target_entity: business.industry.clone(),
            industry: business.industry.clone(),
            category: business.sub_industry.clone(),
            location: business.city.clone(),
            opportunity_type: OpportunityType::Custom,
            opportunity_keywords: vec![],
            qualification_conditions: vec![],
            is_vendor_search: false,
        };

        let (_eval, opps, priority, score) =
            Self::evaluate_business_with_intent(business, &dummy_intent, &[], &[]);
        (opps, priority, score)
    }

    // --------------------------------------------------------------------------
    // Specialized Opportunity Evaluators with 3-State Evidence
    // --------------------------------------------------------------------------

    fn evaluate_erp(
        business: &Business,
        _techs: &[Technology],
        names: &[String],
        cats: &[String],
        evidence: &mut Vec<EvidenceSignal>,
        score: &mut i32,
    ) -> (OpportunityEvaluation, Opportunity) {
        let has_erp = cats.contains(&"erp".to_string()) || names.iter().any(|n| n.contains("erp") || n.contains("powerschool") || n.contains("sap") || n.contains("odoo"));
        let has_portal = cats.contains(&"portal".to_string()) || names.iter().any(|n| n.contains("portal"));
        let has_lms = cats.contains(&"lms".to_string()) || names.iter().any(|n| n.contains("canvas") || n.contains("blackboard") || n.contains("moodle"));

        if has_erp || (has_portal && has_lms) {
            evidence.push(EvidenceSignal {
                key: "erp_infrastructure".to_string(),
                label: "Enterprise ERP System".to_string(),
                status: EvidenceStatus::Detected,
                details: Some("Identified active administrative ERP stack".to_string()),
                confidence: 0.95,
                source: "technology_fingerprint".to_string(),
            });
            *score += 10;
        } else if business.has_website {
            evidence.push(EvidenceSignal {
                key: "erp_infrastructure".to_string(),
                label: "Integrated ERP / SIS System".to_string(),
                status: EvidenceStatus::NotDetected,
                details: Some("No centralized administrative ERP or student portal discovered".to_string()),
                confidence: 0.90,
                source: "crawler_inspection".to_string(),
            });
            evidence.push(EvidenceSignal {
                key: "digital_fee_portal".to_string(),
                label: "Automated Fee & Enrollment Portal".to_string(),
                status: EvidenceStatus::NotDetected,
                details: Some("Administrative workflows rely on manual or disconnected touchpoints".to_string()),
                confidence: 0.85,
                source: "crawler_inspection".to_string(),
            });
            *score += 35;
        } else {
            evidence.push(EvidenceSignal {
                key: "erp_infrastructure".to_string(),
                label: "Integrated ERP / SIS System".to_string(),
                status: EvidenceStatus::Unknown,
                details: Some("No primary web presence available to verify internal systems".to_string()),
                confidence: 0.60,
                source: "public_registry".to_string(),
            });
            *score += 25;
        }

        let reason = if !has_erp {
            format!(
                "{} lacks a modern integrated ERP / administrative portal, leading to operational friction and manual management overhead.",
                business.name
            )
        } else {
            format!(
                "{} has established administrative software; opportunity to upgrade integration and parent/client portals.",
                business.name
            )
        };

        let opp = Opportunity {
            id: Uuid::new_v4(),
            business_id: business.id,
            title: "Unified Cloud ERP & Client Portal Architecture".to_string(),
            description: reason.clone(),
            category: "Enterprise Systems & ERP".to_string(),
            impact: OpportunityImpact::High,
            onefolk_service: "Custom Cloud ERP & Digital Portal Implementation".to_string(),
            service_tier: "ENTERPRISE".to_string(),
            confidence: 0.92,
            estimated_revenue_potential: Some("$15,000 - $45,000".to_string()),
            evidence: evidence.iter().map(|e| format!("{}: {}", e.label, e.status)).collect(),
            status: "IDENTIFIED".to_string(),
            created_at: Utc::now(),
        };

        (
            OpportunityEvaluation {
                score: *score,
                confidence: 0.92,
                reason,
                evidence_signals: evidence.clone(),
                recommended_service: "Custom Cloud ERP & Digital Portal Architecture".to_string(),
                service_tier: "ENTERPRISE".to_string(),
                estimated_value: Some("$15,000 - $45,000".to_string()),
            },
            opp,
        )
    }

    fn evaluate_booking(
        business: &Business,
        _techs: &[Technology],
        _names: &[String],
        cats: &[String],
        evidence: &mut Vec<EvidenceSignal>,
        score: &mut i32,
    ) -> (OpportunityEvaluation, Opportunity) {
        let has_booking = cats.contains(&"booking".to_string()) || cats.contains(&"scheduling".to_string());

        if has_booking {
            evidence.push(EvidenceSignal {
                key: "online_booking".to_string(),
                label: "Online Booking / Scheduling Engine".to_string(),
                status: EvidenceStatus::Detected,
                details: Some("Active third-party booking integration detected".to_string()),
                confidence: 0.95,
                source: "technology_fingerprint".to_string(),
            });
            *score += 15;
        } else if business.has_website {
            evidence.push(EvidenceSignal {
                key: "online_booking".to_string(),
                label: "Direct Online Booking Flow".to_string(),
                status: EvidenceStatus::NotDetected,
                details: Some("Inquiries rely on static phone numbers or email with high drop-off rates".to_string()),
                confidence: 0.92,
                source: "crawler_inspection".to_string(),
            });
            *score += 35;
        } else {
            evidence.push(EvidenceSignal {
                key: "online_booking".to_string(),
                label: "Direct Online Booking Flow".to_string(),
                status: EvidenceStatus::Unknown,
                details: Some("No online booking endpoints found in public directories".to_string()),
                confidence: 0.65,
                source: "public_registry".to_string(),
            });
            *score += 25;
        }

        let reason = if !has_booking {
            format!(
                "{} has no direct 24/7 online reservation/scheduling funnel, losing high-intent prospective clients.",
                business.name
            )
        } else {
            format!(
                "{} utilizes external booking aggregators; opportunity to deploy custom direct zero-commission booking.",
                business.name
            )
        };

        let opp = Opportunity {
            id: Uuid::new_v4(),
            business_id: business.id,
            title: "Direct Conversion & Real-Time Booking Engine".to_string(),
            description: reason.clone(),
            category: "Booking & Conversion".to_string(),
            impact: OpportunityImpact::High,
            onefolk_service: "Custom Direct Booking Architecture".to_string(),
            service_tier: "GROWTH".to_string(),
            confidence: 0.94,
            estimated_revenue_potential: Some("$4,500 - $10,000".to_string()),
            evidence: evidence.iter().map(|e| format!("{}: {}", e.label, e.status)).collect(),
            status: "IDENTIFIED".to_string(),
            created_at: Utc::now(),
        };

        (
            OpportunityEvaluation {
                score: *score,
                confidence: 0.94,
                reason,
                evidence_signals: evidence.clone(),
                recommended_service: "Custom Direct Booking Architecture".to_string(),
                service_tier: "GROWTH".to_string(),
                estimated_value: Some("$4,500 - $10,000".to_string()),
            },
            opp,
        )
    }

    fn evaluate_crm(
        business: &Business,
        _techs: &[Technology],
        _names: &[String],
        cats: &[String],
        evidence: &mut Vec<EvidenceSignal>,
        score: &mut i32,
    ) -> (OpportunityEvaluation, Opportunity) {
        let has_crm = cats.contains(&"crm".to_string());
        let has_lead_capture = cats.contains(&"lead capture".to_string());

        if has_crm {
            evidence.push(EvidenceSignal {
                key: "crm_system".to_string(),
                label: "Active CRM Stack".to_string(),
                status: EvidenceStatus::Detected,
                details: Some("Enterprise CRM tracker active on domain".to_string()),
                confidence: 0.98,
                source: "technology_fingerprint".to_string(),
            });
            *score += 15;
        } else if business.has_website {
            evidence.push(EvidenceSignal {
                key: "crm_system".to_string(),
                label: "Automated CRM & Pipeline".to_string(),
                status: EvidenceStatus::NotDetected,
                details: Some("No automated CRM lead tracking or nurture workflow detected".to_string()),
                confidence: 0.90,
                source: "crawler_inspection".to_string(),
            });
            *score += 35;
        } else {
            evidence.push(EvidenceSignal {
                key: "crm_system".to_string(),
                label: "Automated CRM & Pipeline".to_string(),
                status: EvidenceStatus::Unknown,
                details: Some("CRM infrastructure status unknown without web audit".to_string()),
                confidence: 0.60,
                source: "public_registry".to_string(),
            });
            *score += 20;
        }

        if has_lead_capture {
            evidence.push(EvidenceSignal {
                key: "lead_form".to_string(),
                label: "Interactive Lead Funnel".to_string(),
                status: EvidenceStatus::Detected,
                details: Some("Interactive form embed identified".to_string()),
                confidence: 0.95,
                source: "technology_fingerprint".to_string(),
            });
        } else if business.has_website {
            evidence.push(EvidenceSignal {
                key: "lead_form".to_string(),
                label: "Interactive Lead Funnel".to_string(),
                status: EvidenceStatus::NotDetected,
                details: Some("Missing multi-step qualification lead capture".to_string()),
                confidence: 0.88,
                source: "crawler_inspection".to_string(),
            });
        }

        let reason = format!(
            "{} does not have automated CRM lead capture, risking lead leakage and slow response times.",
            business.name
        );

        let opp = Opportunity {
            id: Uuid::new_v4(),
            business_id: business.id,
            title: "Omnichannel CRM & Automated Lead Nurture Pipeline".to_string(),
            description: reason.clone(),
            category: "CRM & Sales Operations".to_string(),
            impact: OpportunityImpact::High,
            onefolk_service: "Omnichannel CRM & Lead Automation Pipeline".to_string(),
            service_tier: "ENTERPRISE".to_string(),
            confidence: 0.91,
            estimated_revenue_potential: Some("$5,000 - $14,000".to_string()),
            evidence: evidence.iter().map(|e| format!("{}: {}", e.label, e.status)).collect(),
            status: "IDENTIFIED".to_string(),
            created_at: Utc::now(),
        };

        (
            OpportunityEvaluation {
                score: *score,
                confidence: 0.91,
                reason,
                evidence_signals: evidence.clone(),
                recommended_service: "Omnichannel CRM & Lead Automation Pipeline".to_string(),
                service_tier: "ENTERPRISE".to_string(),
                estimated_value: Some("$5,000 - $14,000".to_string()),
            },
            opp,
        )
    }

    fn evaluate_automation(
        business: &Business,
        _techs: &[Technology],
        _names: &[String],
        cats: &[String],
        evidence: &mut Vec<EvidenceSignal>,
        score: &mut i32,
    ) -> (OpportunityEvaluation, Opportunity) {
        let has_chat = cats.contains(&"messaging".to_string()) || cats.contains(&"live chat".to_string());

        if has_chat {
            evidence.push(EvidenceSignal {
                key: "instant_messaging".to_string(),
                label: "Direct Instant Messaging Channel".to_string(),
                status: EvidenceStatus::Detected,
                details: Some("WhatsApp / Live Chat link identified".to_string()),
                confidence: 0.95,
                source: "technology_fingerprint".to_string(),
            });
            *score += 15;
        } else {
            evidence.push(EvidenceSignal {
                key: "instant_messaging".to_string(),
                label: "Automated Instant Messaging & AI Chat".to_string(),
                status: EvidenceStatus::NotDetected,
                details: Some("No instant messaging or AI customer assistant active".to_string()),
                confidence: 0.92,
                source: "crawler_inspection".to_string(),
            });
            *score += 35;
        }

        let reason = format!(
            "{} relies on manual communication workflows without AI auto-responders or instant WhatsApp lead routing.",
            business.name
        );

        let opp = Opportunity {
            id: Uuid::new_v4(),
            business_id: business.id,
            title: "AI Receptionist & WhatsApp Workflow Automation".to_string(),
            description: reason.clone(),
            category: "Operations & Automation".to_string(),
            impact: OpportunityImpact::High,
            onefolk_service: "AI Receptionist & WhatsApp Workflow Automation".to_string(),
            service_tier: "GROWTH".to_string(),
            confidence: 0.93,
            estimated_revenue_potential: Some("$3,000 - $8,500".to_string()),
            evidence: evidence.iter().map(|e| format!("{}: {}", e.label, e.status)).collect(),
            status: "IDENTIFIED".to_string(),
            created_at: Utc::now(),
        };

        (
            OpportunityEvaluation {
                score: *score,
                confidence: 0.93,
                reason,
                evidence_signals: evidence.clone(),
                recommended_service: "AI Receptionist & WhatsApp Workflow Automation".to_string(),
                service_tier: "GROWTH".to_string(),
                estimated_value: Some("$3,000 - $8,500".to_string()),
            },
            opp,
        )
    }

    fn evaluate_seo(
        business: &Business,
        _techs: &[Technology],
        _names: &[String],
        cats: &[String],
        evidence: &mut Vec<EvidenceSignal>,
        score: &mut i32,
    ) -> (OpportunityEvaluation, Opportunity) {
        let has_schema = cats.contains(&"seo".to_string());

        if has_schema {
            evidence.push(EvidenceSignal {
                key: "schema_markup".to_string(),
                label: "Schema.org Rich Snippet Markup".to_string(),
                status: EvidenceStatus::Detected,
                details: Some("Structured JSON-LD entity data active".to_string()),
                confidence: 0.95,
                source: "technology_fingerprint".to_string(),
            });
            *score += 10;
        } else if business.has_website {
            evidence.push(EvidenceSignal {
                key: "schema_markup".to_string(),
                label: "Schema.org Rich Snippet Markup".to_string(),
                status: EvidenceStatus::NotDetected,
                details: Some("Missing structured schema markup for search engines".to_string()),
                confidence: 0.92,
                source: "crawler_inspection".to_string(),
            });
            *score += 30;
        } else {
            evidence.push(EvidenceSignal {
                key: "schema_markup".to_string(),
                label: "Schema.org Rich Snippet Markup".to_string(),
                status: EvidenceStatus::Unknown,
                details: Some("Website unverified".to_string()),
                confidence: 0.50,
                source: "public_registry".to_string(),
            });
        }

        let reason = format!(
            "{} has unoptimized technical search visibility and missing structured schema markup.",
            business.name
        );

        let opp = Opportunity {
            id: Uuid::new_v4(),
            business_id: business.id,
            title: "Technical SEO & Search Visibility Architecture".to_string(),
            description: reason.clone(),
            category: "Search & Visibility".to_string(),
            impact: OpportunityImpact::Medium,
            onefolk_service: "Autonomous Technical SEO & Content Optimization".to_string(),
            service_tier: "GROWTH".to_string(),
            confidence: 0.89,
            estimated_revenue_potential: Some("$2,500 - $6,000/mo".to_string()),
            evidence: evidence.iter().map(|e| format!("{}: {}", e.label, e.status)).collect(),
            status: "IDENTIFIED".to_string(),
            created_at: Utc::now(),
        };

        (
            OpportunityEvaluation {
                score: *score,
                confidence: 0.89,
                reason,
                evidence_signals: evidence.clone(),
                recommended_service: "Autonomous Technical SEO & Content Optimization".to_string(),
                service_tier: "GROWTH".to_string(),
                estimated_value: Some("$2,500 - $6,000/mo".to_string()),
            },
            opp,
        )
    }

    fn evaluate_website(
        business: &Business,
        _techs: &[Technology],
        names: &[String],
        _cats: &[String],
        evidence: &mut Vec<EvidenceSignal>,
        score: &mut i32,
    ) -> (OpportunityEvaluation, Opportunity) {
        if !business.has_website || business.website.is_none() {
            evidence.push(EvidenceSignal {
                key: "primary_website".to_string(),
                label: "Official Digital Web Experience".to_string(),
                status: EvidenceStatus::NotDetected,
                details: Some("No active dedicated domain registered".to_string()),
                confidence: 0.98,
                source: "crawler_inspection".to_string(),
            });
            *score += 40;
        } else {
            evidence.push(EvidenceSignal {
                key: "primary_website".to_string(),
                label: "Official Web Presence".to_string(),
                status: EvidenceStatus::Detected,
                details: Some("Active domain registered".to_string()),
                confidence: 0.99,
                source: "crawler_inspection".to_string(),
            });

            if business.has_ssl {
                evidence.push(EvidenceSignal {
                    key: "ssl_security".to_string(),
                    label: "HTTPS SSL Certificate".to_string(),
                    status: EvidenceStatus::Detected,
                    details: Some("Encrypted HTTPS connection active".to_string()),
                    confidence: 0.99,
                    source: "crawler_inspection".to_string(),
                });
            } else {
                evidence.push(EvidenceSignal {
                    key: "ssl_security".to_string(),
                    label: "HTTPS SSL Certificate".to_string(),
                    status: EvidenceStatus::NotDetected,
                    details: Some("Missing SSL security certificate".to_string()),
                    confidence: 0.99,
                    source: "crawler_inspection".to_string(),
                });
                *score += 20;
            }

            let is_modern = names.iter().any(|n| n.contains("next.js") || n.contains("webflow"));
            if is_modern {
                evidence.push(EvidenceSignal {
                    key: "modern_framework".to_string(),
                    label: "Modern Fast Web Architecture".to_string(),
                    status: EvidenceStatus::Detected,
                    details: Some("High-performance modern framework detected".to_string()),
                    confidence: 0.95,
                    source: "technology_fingerprint".to_string(),
                });
            } else {
                evidence.push(EvidenceSignal {
                    key: "modern_framework".to_string(),
                    label: "Modern Fast Web Architecture".to_string(),
                    status: EvidenceStatus::NotDetected,
                    details: Some("Built on legacy CMS or template builder with slow mobile response".to_string()),
                    confidence: 0.90,
                    source: "technology_fingerprint".to_string(),
                });
                *score += 25;
            }
        }

        let reason = if !business.has_website {
            format!(
                "{} lacks an official modern website, losing direct traffic to third-party aggregator directories.",
                business.name
            )
        } else {
            format!(
                "{} has an outdated web stack with opportunities for high-converting mobile redesign and performance optimization.",
                business.name
            )
        };

        let opp = Opportunity {
            id: Uuid::new_v4(),
            business_id: business.id,
            title: "High-Performance Modern Web Architecture & Redesign".to_string(),
            description: reason.clone(),
            category: "Web & Digital Presence".to_string(),
            impact: OpportunityImpact::High,
            onefolk_service: "High-Performance Web Architecture & Conversion Redesign".to_string(),
            service_tier: "ENTERPRISE".to_string(),
            confidence: 0.96,
            estimated_revenue_potential: Some("$6,000 - $18,000".to_string()),
            evidence: evidence.iter().map(|e| format!("{}: {}", e.label, e.status)).collect(),
            status: "IDENTIFIED".to_string(),
            created_at: Utc::now(),
        };

        (
            OpportunityEvaluation {
                score: *score,
                confidence: 0.96,
                reason,
                evidence_signals: evidence.clone(),
                recommended_service: "High-Performance Web Architecture & Conversion Redesign".to_string(),
                service_tier: "ENTERPRISE".to_string(),
                estimated_value: Some("$6,000 - $18,000".to_string()),
            },
            opp,
        )
    }

    fn evaluate_custom(
        business: &Business,
        _techs: &[Technology],
        _names: &[String],
        _cats: &[String],
        intent: &SearchIntent,
        evidence: &mut Vec<EvidenceSignal>,
        score: &mut i32,
    ) -> (OpportunityEvaluation, Opportunity) {
        if business.has_website {
            evidence.push(EvidenceSignal {
                key: "digital_foundation".to_string(),
                label: "Active Digital Foundation".to_string(),
                status: EvidenceStatus::Detected,
                details: Some("Domain and digital presence identified".to_string()),
                confidence: 0.95,
                source: "crawler_inspection".to_string(),
            });
            *score += 15;
        } else {
            evidence.push(EvidenceSignal {
                key: "digital_foundation".to_string(),
                label: "Active Digital Foundation".to_string(),
                status: EvidenceStatus::NotDetected,
                details: Some("No verified digital properties found".to_string()),
                confidence: 0.90,
                source: "crawler_inspection".to_string(),
            });
            *score += 30;
        }

        let service_name = format!("Custom AI & Digital Acceleration for {}", intent.target_entity);
        let reason = format!(
            "Identified growth and digital modernization opportunities tailored for {} in {}.",
            business.name, intent.target_entity
        );

        let opp = Opportunity {
            id: Uuid::new_v4(),
            business_id: business.id,
            title: service_name.clone(),
            description: reason.clone(),
            category: "Digital Transformation".to_string(),
            impact: OpportunityImpact::High,
            onefolk_service: service_name.clone(),
            service_tier: "GROWTH".to_string(),
            confidence: 0.88,
            estimated_revenue_potential: Some("$5,000 - $15,000".to_string()),
            evidence: evidence.iter().map(|e| format!("{}: {}", e.label, e.status)).collect(),
            status: "IDENTIFIED".to_string(),
            created_at: Utc::now(),
        };

        (
            OpportunityEvaluation {
                score: *score,
                confidence: 0.88,
                reason,
                evidence_signals: evidence.clone(),
                recommended_service: service_name,
                service_tier: "GROWTH".to_string(),
                estimated_value: Some("$5,000 - $15,000".to_string()),
            },
            opp,
        )
    }
}
