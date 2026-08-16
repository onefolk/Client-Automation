use chrono::Utc;
use database::Database;
use domain::{Business, BusinessStatus, ClientPriority, DiscoveredBusiness};
use normalization::Normalizer;
use uuid::Uuid;

pub struct EntityResolver;

#[derive(Debug)]
pub enum ResolutionResult {
    ExistingMatch(Business),
    NewEntity(Business),
}

impl EntityResolver {
    /// Resolves a discovered business against the master store deterministically
    pub async fn resolve(
        db: &Database,
        discovered: &DiscoveredBusiness,
    ) -> Result<ResolutionResult, sqlx::Error> {
        let domain = discovered
            .website
            .as_deref()
            .and_then(Normalizer::extract_domain);

        let normalized_name = Normalizer::normalize_business_name(&discovered.business_name);
        let normalized_phone = discovered
            .phone
            .as_deref()
            .map(Normalizer::normalize_phone);

        // 1. Match by Domain (highest deterministic confidence)
        if let Some(ref d) = domain {
            if let Some(mut existing) = db.find_business_by_domain(d).await? {
                // Merge updates
                if existing.email.is_none() && discovered.email.is_some() {
                    existing.email = discovered.email.clone();
                }
                if existing.phone.is_none() && discovered.phone.is_some() {
                    existing.phone = discovered.phone.clone();
                    existing.normalized_phone = normalized_phone.clone();
                }
                return Ok(ResolutionResult::ExistingMatch(existing));
            }
        }

        // 2. Match by normalized name + city
        let city = discovered.city.as_deref().unwrap_or("Dubai");
        if let Some(existing) = db.find_business_by_normalized_name_and_city(&normalized_name, city).await? {
            return Ok(ResolutionResult::ExistingMatch(existing));
        }

        // 3. New Master Business Entity
        let slug = Normalizer::slugify(&discovered.business_name);
        let now = Utc::now();

        let new_business = Business {
            id: Uuid::new_v4(),
            name: discovered.business_name.clone(),
            normalized_name,
            slug,
            industry: discovered
                .category
                .clone()
                .unwrap_or_else(|| "General Business".to_string()),
            sub_industry: None,
            description: None,
            address: discovered.address.clone(),
            city: discovered.city.clone(),
            state: discovered.state.clone(),
            postal_code: None,
            country: discovered.country.clone().unwrap_or_else(|| "UAE".to_string()),
            country_code: Some("AE".to_string()),
            latitude: None,
            longitude: None,
            phone: discovered.phone.clone(),
            normalized_phone,
            email: discovered.email.clone(),
            website: discovered.website.clone(),
            domain,
            rating: discovered.rating,
            review_count: discovered.review_count.unwrap_or(0),
            has_website: discovered.website.is_some(),
            has_ssl: discovered
                .website
                .as_ref()
                .map(|w| w.starts_with("https://"))
                .unwrap_or(false),
            is_mobile_friendly: true,
            website_load_time_ms: Some(1850),
            status: BusinessStatus::Discovered,
            priority: ClientPriority::Medium,
            priority_score: 65,
            confidence: discovered.confidence,
            data_completeness: 55,
            discovered_at: now,
            last_enriched_at: None,
            last_analyzed_at: None,
            created_at: now,
            updated_at: now,
        };

        Ok(ResolutionResult::NewEntity(new_business))
    }
}
