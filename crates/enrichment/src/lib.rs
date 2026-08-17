use chrono::Utc;
use contacts::ContactExtractor;
use crawler::HttpCrawler;
use database::Database;
use domain::{Business, Contact, Fact, OpportunityEvaluation, SearchIntent, Technology};
use opportunities::OpportunityEngine;
use technology::TechDetector;
use uuid::Uuid;

pub struct EnrichmentPipeline;

impl EnrichmentPipeline {
    /// Executes Level 1 Progressive Enrichment with SearchIntent awareness
    pub async fn process_business_with_intent(
        db: &Database,
        crawler: &HttpCrawler,
        business: &mut Business,
        intent: &SearchIntent,
    ) -> Result<(Vec<Contact>, Vec<Technology>, Vec<Fact>, OpportunityEvaluation), sqlx::Error> {
        let mut extracted_contacts = Vec::new();
        let mut detected_techs = Vec::new();
        let mut facts = Vec::new();

        if let Some(ref website_url) = business.website {
            if let Ok(crawled_page) = crawler.fetch_page(website_url).await {
                let is_reachable = crawled_page.status_code >= 200 && crawled_page.status_code < 400;
                business.has_website = is_reachable;
                business.has_ssl = website_url.starts_with("https://");

                // 1. Extract Contacts
                extracted_contacts = ContactExtractor::extract_from_html(
                    business.id,
                    &crawled_page.raw_html,
                    website_url,
                );

                for contact in &extracted_contacts {
                    let _ = db.save_contact(contact).await;
                }

                // 2. Detect Technologies
                detected_techs = TechDetector::detect_technologies(business.id, &crawled_page.raw_html);

                // 3. Build & Save Level 1 Facts
                let fact_website = Fact {
                    id: Uuid::new_v4(),
                    business_id: business.id,
                    category: "website".to_string(),
                    key: "crawl_summary".to_string(),
                    value: serde_json::json!({
                        "status_code": crawled_page.status_code,
                        "title": crawled_page.title,
                        "meta_description": crawled_page.meta_description,
                        "is_reachable": is_reachable,
                        "has_ssl": business.has_ssl,
                    }),
                    source: "http_crawler_l1".to_string(),
                    source_url: Some(website_url.clone()),
                    confidence: 0.99,
                    verified: true,
                    created_at: Utc::now(),
                };
                facts.push(fact_website);

                let fact_tech = Fact {
                    id: Uuid::new_v4(),
                    business_id: business.id,
                    category: "technology".to_string(),
                    key: "detected_stack".to_string(),
                    value: serde_json::json!({
                        "count": detected_techs.len(),
                        "technologies": detected_techs.iter().map(|t| &t.name).collect::<Vec<_>>(),
                    }),
                    source: "tech_fingerprinter_l1".to_string(),
                    source_url: Some(website_url.clone()),
                    confidence: 0.98,
                    verified: true,
                    created_at: Utc::now(),
                };
                facts.push(fact_tech);
            }
        }

        // 4. Evaluate Dynamic Intent Opportunities & Priority
        let (eval, opps, priority, score) =
            OpportunityEngine::evaluate_business_with_intent(business, intent, &detected_techs, &facts);
        business.priority = priority;
        business.priority_score = score;
        business.status = domain::BusinessStatus::OpportunityFound;
        business.last_enriched_at = Some(Utc::now());

        // Persist updated business
        db.save_business(business).await?;

        // Save generated opportunities
        for opp in opps {
            db.save_opportunity(&opp).await?;
        }

        // Add activity record
        db.add_activity(
            Some(business.id),
            None,
            "enrichment.intent_evaluated",
            "Client Opportunity Evaluated",
            Some(&format!(
                "Evaluated opportunity for {}: Score {} ({:?}) - {}",
                intent.target_entity, business.priority_score, business.priority, eval.reason
            )),
            &serde_json::json!({
                "opportunity_type": format!("{}", intent.opportunity_type),
                "target_entity": intent.target_entity,
                "score": business.priority_score,
                "priority": format!("{}", business.priority),
                "recommended_service": eval.recommended_service,
            }),
        )
        .await?;

        Ok((extracted_contacts, detected_techs, facts, eval))
    }

    /// Backward compatible Level 1 Progressive Enrichment
    pub async fn process_business_level_1(
        db: &Database,
        crawler: &HttpCrawler,
        business: &mut Business,
    ) -> Result<(Vec<Contact>, Vec<Technology>, Vec<Fact>), sqlx::Error> {
        let dummy_intent = SearchIntent {
            raw_query: "general discovery".to_string(),
            target_entity: business.industry.clone(),
            industry: business.industry.clone(),
            category: business.sub_industry.clone(),
            location: business.city.clone(),
            opportunity_type: domain::OpportunityType::Custom,
            opportunity_keywords: vec![],
            qualification_conditions: vec![],
            is_vendor_search: false,
        };

        let (contacts, techs, facts, _) =
            Self::process_business_with_intent(db, crawler, business, &dummy_intent).await?;
        Ok((contacts, techs, facts))
    }
}
