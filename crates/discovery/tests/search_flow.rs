use discovery::SearchPlanner;
use domain::{BusinessStatus, ClientPriority, SearchFilters};
use normalization::Normalizer;
use opportunities::OpportunityEngine;
use providers::{DiscoveryProvider, PublicRegistryProvider};

#[tokio::test]
async fn test_live_search_and_discovery_pipeline() {
    println!("\n=== LIVE SEARCH & DISCOVERY PIPELINE EXECUTION ===\n");

    // 1. User Input & Search Filters
    let raw_query = "Japanese restaurants";
    let filters = SearchFilters {
        industry: Some("Restaurant & Hospitality".to_string()),
        city: Some("Dubai".to_string()),
        country: Some("UAE".to_string()),
        has_website: Some(true),
        no_booking_system: Some(true),
        ..Default::default()
    };

    println!("[1. User Search Request]");
    println!("  Query: {}", raw_query);
    println!("  Industry: {:?}", filters.industry);
    println!("  Location: {:?}, {:?}", filters.city, filters.country);

    // 2. Search Planner Multi-Query Expansion
    let search_plan = SearchPlanner::create_plan(raw_query, &filters, &["live_public_registry".to_string()]);
    println!("\n[2. Search Planner Generated Strategies]");
    for strat in &search_plan.strategies {
        println!("  Provider: {}", strat.provider_id);
        for (idx, qv) in strat.query_variations.iter().enumerate() {
            println!("    Strategy {}: \"{}\"", idx + 1, qv);
        }
    }

    // 3. Provider Execution with Live Registry
    let provider = PublicRegistryProvider::new();
    println!("\n[3. Executing Live Provider: {} (Category: {:?})]", provider.name(), provider.category());
    let discovered_results = provider.search(raw_query, &filters, 5).await.expect("Provider search failed");
    println!("  Discovered {} live public entities\n", discovered_results.len());

    // 4. Normalization, Entity Resolution & Opportunity Analysis
    println!("[4. Verification, Normalization & Opportunity Detection]");
    for (i, b) in discovered_results.iter().enumerate() {
        let norm_name = Normalizer::normalize_business_name(&b.business_name);
        let domain = b.website.as_deref().and_then(Normalizer::extract_domain);
        let slug = Normalizer::slugify(&b.business_name);

        let live_biz = domain::Business {
            id: uuid::Uuid::new_v4(),
            name: b.business_name.clone(),
            normalized_name: norm_name.clone(),
            slug,
            industry: b.category.clone().unwrap_or_default(),
            sub_industry: None,
            description: None,
            address: b.address.clone(),
            city: b.city.clone(),
            state: b.state.clone(),
            postal_code: None,
            country: b.country.clone().unwrap_or_default(),
            country_code: Some("AE".to_string()),
            latitude: None,
            longitude: None,
            phone: b.phone.clone(),
            normalized_phone: b.phone.as_deref().map(Normalizer::normalize_phone),
            email: b.email.clone(),
            website: b.website.clone(),
            domain: domain.clone(),
            rating: b.rating,
            review_count: b.review_count.unwrap_or(0),
            has_website: b.website.is_some(),
            has_ssl: true,
            is_mobile_friendly: true,
            website_load_time_ms: Some(1850),
            status: BusinessStatus::Discovered,
            priority: ClientPriority::Medium,
            priority_score: 50,
            confidence: b.confidence,
            data_completeness: 80,
            discovered_at: chrono::Utc::now(),
            last_enriched_at: None,
            last_analyzed_at: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let (opps, priority, score) = OpportunityEngine::evaluate_business(&live_biz);

        println!("  --------------------------------------------------");
        println!("  Client #{}: {}", i + 1, b.business_name);
        println!("    Normalized Name: {}", norm_name);
        println!("    Domain: {:?}", domain);
        println!("    Contact Email: {:?}", b.email);
        println!("    Public Phone: {:?}", b.phone);
        println!("    Calculated Priority: {:?} (Score: {}/100)", priority, score);
        println!("    Detected Opportunities ({}):", opps.len());
        for opp in &opps {
            println!("      ⚡ {} [Impact: {:?}]", opp.title, opp.impact);
            println!("         Agency Service: {}", opp.onefolk_service);
            if let Some(ref rev) = opp.estimated_revenue_potential {
                println!("         Revenue Potential: {}", rev);
            }
        }
    }

    println!("\n=== LIVE SEARCH & DISCOVERY VERIFICATION COMPLETED ===\n");
}
