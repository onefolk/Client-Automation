use async_trait::async_trait;
use chrono::Utc;
use domain::{DiscoveredBusiness, ProviderCategory, SearchFilters};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ProviderError {
    #[error("Rate limit exceeded for provider {0}")]
    RateLimitExceeded(String),
    #[error("Network error: {0}")]
    NetworkError(String),
    #[error("Parsing error: {0}")]
    ParsingError(String),
    #[error("Provider {0} is currently disabled or unhealthy")]
    Unavailable(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCapabilities {
    pub supports_keywords: bool,
    pub supports_location: bool,
    pub supports_categories: bool,
    pub returns_contacts: bool,
    pub returns_social: bool,
    pub returns_ratings: bool,
}

#[async_trait]
pub trait DiscoveryProvider: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    fn category(&self) -> ProviderCategory;
    fn capabilities(&self) -> ProviderCapabilities;
    async fn search(
        &self,
        query: &str,
        filters: &SearchFilters,
        limit: usize,
    ) -> Result<Vec<DiscoveredBusiness>, ProviderError>;
    async fn health_check(&self) -> bool;
}

pub struct ProviderRegistry {
    providers: HashMap<String, Arc<dyn DiscoveryProvider>>,
}

impl ProviderRegistry {
    pub fn new() -> Self {
        Self {
            providers: HashMap::new(),
        }
    }

    pub fn register(&mut self, provider: Arc<dyn DiscoveryProvider>) {
        self.providers.insert(provider.id().to_string(), provider);
    }

    pub fn get(&self, id: &str) -> Option<Arc<dyn DiscoveryProvider>> {
        self.providers.get(id).cloned()
    }

    pub fn all(&self) -> Vec<Arc<dyn DiscoveryProvider>> {
        self.providers.values().cloned().collect()
    }
}

impl Default for ProviderRegistry {
    fn default() -> Self {
        let mut registry = Self::new();
        registry.register(Arc::new(MockDiscoveryProvider::new()));
        registry
    }
}

// ==============================================================================
// Mock Discovery Provider
// ==============================================================================

pub struct MockDiscoveryProvider {
    id: String,
    name: String,
}

impl MockDiscoveryProvider {
    pub fn new() -> Self {
        Self {
            id: "mock_universal_discovery".to_string(),
            name: "Universal Business Directory (Mock Discovery)".to_string(),
        }
    }
}

#[async_trait]
impl DiscoveryProvider for MockDiscoveryProvider {
    fn id(&self) -> &str {
        &self.id
    }

    fn name(&self) -> &str {
        &self.name
    }

    fn category(&self) -> ProviderCategory {
        ProviderCategory::BusinessDirectory
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            supports_keywords: true,
            supports_location: true,
            supports_categories: true,
            returns_contacts: true,
            returns_social: true,
            returns_ratings: true,
        }
    }

    async fn health_check(&self) -> bool {
        true
    }

    async fn search(
        &self,
        query: &str,
        filters: &SearchFilters,
        limit: usize,
    ) -> Result<Vec<DiscoveredBusiness>, ProviderError> {
        let city = filters
            .city
            .clone()
            .or_else(|| filters.location.clone())
            .unwrap_or_else(|| "Dubai".to_string());

        let industry = filters
            .industry
            .clone()
            .unwrap_or_else(|| "Restaurant & Hospitality".to_string());

        let mut results = Vec::new();

        // Generate dynamic mock businesses matching the query context
        let templates = vec![
            (
                "Sakura Artisanal Dining",
                "sakuradining-uae.com",
                "+971 4 398 1245",
                "reservations@sakuradining-uae.com",
                "Downtown Boulevard, Tower 2",
                4.6,
                324,
            ),
            (
                "Origami Japanese Kitchen",
                "origamidxb.ae",
                "+971 4 551 8890",
                "contact@origamidxb.ae",
                "Jumeirah Beach Road, Villa 14",
                4.3,
                189,
            ),
            (
                "Kura Sushi Lounge",
                "kura-sushi.me",
                "+971 4 229 4411",
                "info@kura-sushi.me",
                "Dubai Marina Mall, Promenade Level",
                4.8,
                512,
            ),
            (
                "Nobu Inspired Grill LLC",
                "nobugrill-dubai.com",
                "+971 4 426 2626",
                "events@nobugrill-dubai.com",
                "Palm Jumeirah, Crescent Road",
                4.7,
                890,
            ),
            (
                "Tokyo Robata Bar",
                "tokyorobata.ae",
                "+971 4 330 9944",
                "manager@tokyorobata.ae",
                "DIFC, Gate Village Building 5",
                4.1,
                142,
            ),
            (
                "Zen Garden Teppanyaki",
                "zengarden-uae.com",
                "+971 4 702 3311",
                "hello@zengarden-uae.com",
                "Business Bay, Marasi Drive",
                3.9,
                98,
            ),
            (
                "Bespoke Bistro & Cafe",
                "bespokebistrodxb.com",
                "+971 4 883 1200",
                "info@bespokebistrodxb.com",
                "City Walk, Al Safa",
                4.4,
                260,
            ),
        ];

        let effective_limit = limit.min(templates.len());

        for (i, (name, domain, phone, email, address, rating, reviews)) in
            templates.into_iter().take(effective_limit).enumerate()
        {
            let website_url = format!("https://{}", domain);
            let raw_data = serde_json::json!({
                "provider_rank": i + 1,
                "domain": domain,
                "verified_source": true,
                "matched_query": query,
            });

            results.push(DiscoveredBusiness {
                business_name: name.to_string(),
                website: Some(website_url.clone()),
                phone: Some(phone.to_string()),
                email: Some(email.to_string()),
                address: Some(address.to_string()),
                city: Some(city.clone()),
                state: Some(city.clone()),
                country: Some(filters.country.clone().unwrap_or_else(|| "UAE".to_string())),
                category: Some(industry.clone()),
                rating: Some(rating),
                review_count: Some(reviews),
                source: "mock_universal_discovery".to_string(),
                source_url: Some(format!("https://directory.mock.ae/biz/{}", domain)),
                confidence: 0.95,
                collected_at: Utc::now(),
                raw_data,
            });
        }

        Ok(results)
    }
}
