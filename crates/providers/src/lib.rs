use async_trait::async_trait;
use chrono::Utc;
use domain::{DiscoveredBusiness, ProviderCategory, SearchFilters};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
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
        registry.register(Arc::new(PublicRegistryProvider::new()));
        registry.register(Arc::new(LiveWebSearchProvider::new()));
        registry
    }
}

// ==============================================================================
// 1. Live Public Registry Provider (Real-time OpenStreetMap / Municipal Index)
// ==============================================================================

pub struct PublicRegistryProvider {
    id: String,
    name: String,
    client: Client,
}

impl PublicRegistryProvider {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .user_agent("OneFolkClientIntelligence/1.0 (+https://onefolk.ai)")
            .build()
            .unwrap_or_default();

        Self {
            id: "live_public_registry".to_string(),
            name: "Live Public Registry (OpenStreetMap/Public Index)".to_string(),
            client,
        }
    }
}

#[async_trait]
impl DiscoveryProvider for PublicRegistryProvider {
    fn id(&self) -> &str {
        &self.id
    }

    fn name(&self) -> &str {
        &self.name
    }

    fn category(&self) -> ProviderCategory {
        ProviderCategory::OfficialRegistry
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

        let country = filters.country.clone().unwrap_or_else(|| "UAE".to_string());
        let industry = filters.industry.clone().unwrap_or_else(|| "Commercial".to_string());

        let search_endpoint = format!(
            "https://nominatim.openstreetmap.org/search?q={}+{}&format=json&addressdetails=1&extratags=1&limit={}",
            urlencoding::encode(query),
            urlencoding::encode(&city),
            limit
        );

        let resp = self
            .client
            .get(&search_endpoint)
            .send()
            .await
            .map_err(|e| ProviderError::NetworkError(e.to_string()))?;

        let json_array = resp
            .json::<Vec<serde_json::Value>>()
            .await
            .map_err(|e| ProviderError::ParsingError(e.to_string()))?;

        let mut results = Vec::new();

        for item in json_array {
            let display_name = item["display_name"].as_str().unwrap_or_default();
            let name = item["name"]
                .as_str()
                .or_else(|| display_name.split(',').next())
                .unwrap_or("Commercial Entity");

            let clean_name = name.trim().to_string();
            if clean_name.is_empty() {
                continue;
            }

            let extratags = item.get("extratags");
            let live_website = extratags
                .and_then(|t| t["website"].as_str().or_else(|| t["contact:website"].as_str()).or_else(|| t["url"].as_str()))
                .map(|s| s.to_string());

            let live_phone = extratags
                .and_then(|t| t["phone"].as_str().or_else(|| t["contact:phone"].as_str()))
                .map(|s| s.to_string());

            let raw_payload = item.clone();

            results.push(DiscoveredBusiness {
                business_name: clean_name.clone(),
                website: live_website,
                phone: live_phone,
                email: None,
                address: Some(display_name.to_string()),
                city: Some(city.clone()),
                state: Some(city.clone()),
                country: Some(country.clone()),
                category: Some(industry.clone()),
                rating: None,
                review_count: None,
                source: "live_public_registry".to_string(),
                source_url: Some(format!(
                    "https://openstreetmap.org/{}/{}",
                    item["osm_type"].as_str().unwrap_or("node"),
                    item["osm_id"].as_i64().unwrap_or(0)
                )),
                confidence: 0.98,
                collected_at: Utc::now(),
                raw_data: raw_payload,
            });
        }

        Ok(results)
    }
}

// ==============================================================================
// 2. Live Web Search Provider (DuckDuckGo / Public Search Ingestion)
// ==============================================================================

pub struct LiveWebSearchProvider {
    id: String,
    name: String,
    client: Client,
}

impl LiveWebSearchProvider {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
            .build()
            .unwrap_or_default();

        Self {
            id: "live_web_search".to_string(),
            name: "Live Public Web Search".to_string(),
            client,
        }
    }
}

#[async_trait]
impl DiscoveryProvider for LiveWebSearchProvider {
    fn id(&self) -> &str {
        &self.id
    }

    fn name(&self) -> &str {
        &self.name
    }

    fn category(&self) -> ProviderCategory {
        ProviderCategory::WebSearch
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            supports_keywords: true,
            supports_location: true,
            supports_categories: true,
            returns_contacts: true,
            returns_social: true,
            returns_ratings: false,
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

        let target_query = format!("{} in {}", query, city);
        let endpoint = format!(
            "https://html.duckduckgo.com/html/?q={}",
            urlencoding::encode(&target_query)
        );

        let resp = self
            .client
            .get(&endpoint)
            .send()
            .await
            .map_err(|e| ProviderError::NetworkError(e.to_string()))?;

        let html = resp
            .text()
            .await
            .map_err(|e| ProviderError::ParsingError(e.to_string()))?;

        let mut results = Vec::new();
        // Parse result links and titles from live DuckDuckGo HTML
        let link_regex = regex::Regex::new(r#"<a class="result__url" href="([^"]+)">([^<]+)</a>"#).unwrap();
        let title_regex = regex::Regex::new(r#"<a class="result__snippet"[^>]*>([^<]+)</a>"#).unwrap();

        let captures: Vec<_> = link_regex.captures_iter(&html).take(limit).collect();
        let snippet_captures: Vec<_> = title_regex.captures_iter(&html).take(limit).collect();

        for (i, cap) in captures.into_iter().enumerate() {
            let raw_url = cap.get(1).map(|m| m.as_str()).unwrap_or("");
            let clean_url = if raw_url.starts_with("//duckduckgo.com/l/?uddg=") {
                raw_url.strip_prefix("//duckduckgo.com/l/?uddg=").unwrap_or(raw_url).split('&').next().unwrap_or(raw_url)
            } else {
                raw_url
            };

            let decoded_url = urlencoding::decode(clean_url).unwrap_or_else(|_| clean_url.into()).to_string();
            let domain = decoded_url.replace("https://", "").replace("http://", "").split('/').next().unwrap_or("").to_string();

            let title = snippet_captures.get(i).and_then(|c| c.get(1)).map(|m| m.as_str()).unwrap_or(&domain);

            if !domain.is_empty() && !domain.contains("duckduckgo.com") {
                results.push(DiscoveredBusiness {
                    business_name: domain.clone(),
                    website: Some(format!("https://{}", domain)),
                    phone: None,
                    email: None,
                    address: Some(title.to_string()),
                    city: Some(city.clone()),
                    state: Some(city.clone()),
                    country: filters.country.clone(),
                    category: filters.industry.clone(),
                    rating: None,
                    review_count: None,
                    source: "live_web_search".to_string(),
                    source_url: Some(decoded_url),
                    confidence: 0.90,
                    collected_at: Utc::now(),
                    raw_data: serde_json::json!({ "domain": domain, "snippet": title }),
                });
            }
        }

        Ok(results)
    }
}
