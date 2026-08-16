use chrono::Utc;
use contacts::ContactExtractor;
use crawler::HttpCrawler;
use database::Database;
use domain::{Business, Contact, Fact, Technology};
use opportunities::OpportunityEngine;
use technology::TechDetector;
use uuid::Uuid;

pub struct EnrichmentPipeline;

impl EnrichmentPipeline {
    /// Executes Level 1 Progressive Enrichment: Homepage Crawl, Contact Extraction, Technology Detection, Fact Store & Opportunities
    pub async fn process_business_level_1(
        db: &Database,
        crawler: &HttpCrawler,
        business: &mut Business,
    ) -> Result<(Vec<Contact>, Vec<Technology>, Vec<Fact>), sqlx::Error> {
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

        // 4. Re-Evaluate Opportunities & Priority
        let (opps, priority, score) = OpportunityEngine::evaluate_business(business);
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
            "enrichment.level1_completed",
            "Level 1 Enrichment Completed",
            Some(&format!(
                "Extracted {} contacts, {} technologies, and evaluated {} priority.",
                extracted_contacts.len(),
                detected_techs.len(),
                business.priority
            )),
            &serde_json::json!({
                "contacts_count": extracted_contacts.len(),
                "tech_count": detected_techs.len(),
                "priority": format!("{}", business.priority),
                "score": business.priority_score,
            }),
        )
        .await?;

        Ok((extracted_contacts, detected_techs, facts))
    }
}
