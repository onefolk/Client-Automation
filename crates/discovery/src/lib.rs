use domain::SearchFilters;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderSearchStrategy {
    pub provider_id: String,
    pub query_variations: Vec<String>,
    pub limit: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchPlan {
    pub original_query: String,
    pub strategies: Vec<ProviderSearchStrategy>,
}

pub struct SearchPlanner;

impl SearchPlanner {
    /// Deterministically generates provider-specific multi-query strategies without AI
    pub fn create_plan(
        query: &str,
        filters: &SearchFilters,
        selected_providers: &[String],
    ) -> SearchPlan {
        let city = filters
            .city
            .as_deref()
            .or_else(|| filters.location.as_deref())
            .unwrap_or("Dubai");

        let country = filters.country.as_deref().unwrap_or("UAE");

        let base_query = query.trim();
        let mut variations = vec![base_query.to_string()];

        // Add contextual geographical variations if not already in query
        if !base_query.to_lowercase().contains(&city.to_lowercase()) {
            variations.push(format!("{} {}", base_query, city));
        }

        if !base_query.to_lowercase().contains(&country.to_lowercase()) {
            variations.push(format!("{} {} {}", base_query, city, country));
        }

        // Add intent-based variations
        variations.push(format!("best {}", base_query));
        variations.push(format!("top {} in {}", base_query, city));

        let providers = if selected_providers.is_empty() {
            vec!["live_public_registry".to_string()]
        } else {
            selected_providers.to_vec()
        };

        let strategies = providers
            .into_iter()
            .map(|pid| ProviderSearchStrategy {
                provider_id: pid,
                query_variations: variations.clone(),
                limit: 15,
            })
            .collect();

        SearchPlan {
            original_query: base_query.to_string(),
            strategies,
        }
    }
}
