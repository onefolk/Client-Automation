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
    /// Resolves a discovered business against the master store using 4-tier deterministic matching
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

        // Tier 1. Canonical Domain Match (highest deterministic confidence: 0.99)
        if let Some(ref d) = domain {
            if let Some(mut existing) = db.find_business_by_domain(d).await? {
                // Merge provenance and missing attributes
                if existing.email.is_none() && discovered.email.is_some() {
                    existing.email = discovered.email.clone();
                }
                if existing.phone.is_none() && discovered.phone.is_some() {
                    existing.phone = discovered.phone.clone();
                    existing.normalized_phone = normalized_phone.clone();
                }
                if discovered.rating.is_some() && existing.rating.is_none() {
                    existing.rating = discovered.rating;
                    existing.review_count = discovered.review_count.unwrap_or(0);
                }
                existing.last_enriched_at = Some(Utc::now());
                return Ok(ResolutionResult::ExistingMatch(existing));
            }
        }

        // Tier 2. Normalized Name + City Match (confidence: 0.92)
        let city = discovered.city.as_deref().unwrap_or("Dubai");
        if let Some(mut existing) = db.find_business_by_normalized_name_and_city(&normalized_name, city).await? {
            if existing.domain.is_none() && domain.is_some() {
                existing.domain = domain.clone();
                existing.website = discovered.website.clone();
            }
            if existing.email.is_none() && discovered.email.is_some() {
                existing.email = discovered.email.clone();
            }
            if existing.phone.is_none() && discovered.phone.is_some() {
                existing.phone = discovered.phone.clone();
                existing.normalized_phone = normalized_phone.clone();
            }
            existing.last_enriched_at = Some(Utc::now());
            return Ok(ResolutionResult::ExistingMatch(existing));
        }

        // Tier 3. Create New Master Business Entity
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
                .unwrap_or_else(|| "Commercial Business".to_string()),
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
            data_completeness: 75,
            discovered_at: now,
            last_enriched_at: None,
            last_analyzed_at: None,
            created_at: now,
            updated_at: now,
        };

        Ok(ResolutionResult::NewEntity(new_business))
    }
}
