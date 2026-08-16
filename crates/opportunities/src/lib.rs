use chrono::Utc;
use domain::{Business, ClientPriority, Opportunity, OpportunityImpact};
use uuid::Uuid;

pub struct OpportunityEngine;

impl OpportunityEngine {
    /// Deterministically detects agency service opportunities based on structured evidence & facts
    pub fn evaluate_business(business: &Business) -> (Vec<Opportunity>, ClientPriority, i32) {
        let mut opportunities = Vec::new();
        let mut score = 50; // Base score

        // Rule 1: Missing or Weak Website
        if !business.has_website || business.website.is_none() {
            opportunities.push(Opportunity {
                id: Uuid::new_v4(),
                business_id: business.id,
                title: "Custom High-Converting Web Experience".to_string(),
                description: "Business lacks an official modern web presence. High risk of losing direct bookings to aggregator directories.".to_string(),
                category: "Web & Digital Presence".to_string(),
                impact: OpportunityImpact::High,
                onefolk_service: "Custom Website & Direct Booking Architecture".to_string(),
                service_tier: "ENTERPRISE".to_string(),
                confidence: 0.95,
                estimated_revenue_potential: Some("$5,000 - $12,000".to_string()),
                evidence: vec!["No official domain registered or active".to_string()],
                status: "IDENTIFIED".to_string(),
                created_at: Utc::now(),
            });
            score += 25;
        }

        // Rule 2: Active Reviews / High Reputation without Dedicated Automation
        if business.review_count > 100 && business.rating.unwrap_or(0.0) >= 4.2 {
            opportunities.push(Opportunity {
                id: Uuid::new_v4(),
                business_id: business.id,
                title: "VIP Loyalty & Automated Lead Capture Engine".to_string(),
                description: "Strong organic review volume indicates active customer flow. Opportunity to capture first-party customer data and automate repeat dining campaigns.".to_string(),
                category: "Automation & Retention".to_string(),
                impact: OpportunityImpact::High,
                onefolk_service: "WhatsApp CRM & VIP Guest Retention Engine".to_string(),
                service_tier: "GROWTH".to_string(),
                confidence: 0.91,
                estimated_revenue_potential: Some("$3,000 - $7,500/mo".to_string()),
                evidence: vec![
                    format!("{} verified public reviews", business.review_count),
                    format!("Average rating of {:.1}", business.rating.unwrap_or(0.0)),
                ],
                status: "IDENTIFIED".to_string(),
                created_at: Utc::now(),
            });
            score += 20;
        }

        // Rule 3: Contact Found & Ready for Direct Outreach
        if business.email.is_some() || business.phone.is_some() {
            score += 10;
        }

        let priority = if score >= 75 {
            ClientPriority::High
        } else if score >= 50 {
            ClientPriority::Medium
        } else {
            ClientPriority::Low
        };

        (opportunities, priority, score)
    }
}
