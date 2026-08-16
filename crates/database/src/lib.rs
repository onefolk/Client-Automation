use chrono::Utc;
use domain::{
    ActivityEvent, Analysis, Business, BusinessProfile, BusinessStatus, ClientPriority, Contact,
    DiscoveredBusiness, Fact, Opportunity, OpportunityImpact, ReviewInfo, SearchFilters,
    SearchSession, SearchStatus, SocialProfile, Technology, WebsiteInfo,
};
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct Database {
    pool: PgPool,
}

impl Database {
    pub async fn connect(database_url: &str) -> Result<Self, sqlx::Error> {
        let pool = PgPoolOptions::new()
            .max_connections(20)
            .connect(database_url)
            .await?;

        Ok(Self { pool })
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    // =========================================================================
    // Search Sessions
    // =========================================================================

    pub async fn create_search(
        &self,
        query: &str,
        filters: &SearchFilters,
        providers: &[String],
    ) -> Result<SearchSession, sqlx::Error> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        let filters_json = serde_json::to_value(filters).unwrap_or_default();
        let errors_json = serde_json::json!([]);

        let row = sqlx::query!(
            r#"
            INSERT INTO searches (
                id, query, filters, providers_selected, started_at, status,
                total_discovered, total_saved, total_enriched, errors, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id, user_id, query, filters, providers_selected, started_at, completed_at,
                      status, total_discovered, total_saved, total_enriched, errors, duration_ms,
                      created_at, updated_at
            "#,
            id,
            query,
            filters_json,
            providers,
            now,
            "PENDING",
            0,
            0,
            0,
            errors_json,
            now,
            now
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(SearchSession {
            id: row.id,
            user_id: row.user_id,
            query: row.query,
            filters: serde_json::from_value(row.filters).unwrap_or_default(),
            providers_selected: row.providers_selected,
            started_at: row.started_at,
            completed_at: row.completed_at,
            status: match row.status.as_str() {
                "RUNNING" => SearchStatus::Running,
                "COMPLETED" => SearchStatus::Completed,
                "PARTIAL" => SearchStatus::Partial,
                "FAILED" => SearchStatus::Failed,
                "CANCELLED" => SearchStatus::Cancelled,
                _ => SearchStatus::Pending,
            },
            total_discovered: row.total_discovered,
            total_saved: row.total_saved,
            total_enriched: row.total_enriched,
            errors: serde_json::from_value(row.errors).unwrap_or_default(),
            duration_ms: row.duration_ms,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
    }

    pub async fn get_search(&self, id: Uuid) -> Result<Option<SearchSession>, sqlx::Error> {
        let row = sqlx::query!(
            r#"
            SELECT id, user_id, query, filters, providers_selected, started_at, completed_at,
                   status, total_discovered, total_saved, total_enriched, errors, duration_ms,
                   created_at, updated_at
            FROM searches
            WHERE id = $1
            "#,
            id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| SearchSession {
            id: r.id,
            user_id: r.user_id,
            query: r.query,
            filters: serde_json::from_value(r.filters).unwrap_or_default(),
            providers_selected: r.providers_selected,
            started_at: r.started_at,
            completed_at: r.completed_at,
            status: match r.status.as_str() {
                "RUNNING" => SearchStatus::Running,
                "COMPLETED" => SearchStatus::Completed,
                "PARTIAL" => SearchStatus::Partial,
                "FAILED" => SearchStatus::Failed,
                "CANCELLED" => SearchStatus::Cancelled,
                _ => SearchStatus::Pending,
            },
            total_discovered: r.total_discovered,
            total_saved: r.total_saved,
            total_enriched: r.total_enriched,
            errors: serde_json::from_value(r.errors).unwrap_or_default(),
            duration_ms: r.duration_ms,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }))
    }

    pub async fn list_searches(&self, limit: i64) -> Result<Vec<SearchSession>, sqlx::Error> {
        let rows = sqlx::query!(
            r#"
            SELECT id, user_id, query, filters, providers_selected, started_at, completed_at,
                   status, total_discovered, total_saved, total_enriched, errors, duration_ms,
                   created_at, updated_at
            FROM searches
            ORDER BY created_at DESC
            LIMIT $1
            "#,
            limit
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|r| SearchSession {
                id: r.id,
                user_id: r.user_id,
                query: r.query,
                filters: serde_json::from_value(r.filters).unwrap_or_default(),
                providers_selected: r.providers_selected,
                started_at: r.started_at,
                completed_at: r.completed_at,
                status: match r.status.as_str() {
                    "RUNNING" => SearchStatus::Running,
                    "COMPLETED" => SearchStatus::Completed,
                    "PARTIAL" => SearchStatus::Partial,
                    "FAILED" => SearchStatus::Failed,
                    "CANCELLED" => SearchStatus::Cancelled,
                    _ => SearchStatus::Pending,
                },
                total_discovered: r.total_discovered,
                total_saved: r.total_saved,
                total_enriched: r.total_enriched,
                errors: serde_json::from_value(r.errors).unwrap_or_default(),
                duration_ms: r.duration_ms,
                created_at: r.created_at,
                updated_at: r.updated_at,
            })
            .collect())
    }

    pub async fn update_search_progress(
        &self,
        id: Uuid,
        status: SearchStatus,
        discovered: i32,
        saved: i32,
        enriched: i32,
    ) -> Result<(), sqlx::Error> {
        let status_str = status.to_string();
        let now = Utc::now();
        let completed_at = match status {
            SearchStatus::Completed | SearchStatus::Failed | SearchStatus::Cancelled => Some(now),
            _ => None,
        };

        sqlx::query!(
            r#"
            UPDATE searches
            SET status = $2,
                total_discovered = $3,
                total_saved = $4,
                total_enriched = $5,
                completed_at = COALESCE($6, completed_at),
                updated_at = $7
            WHERE id = $1
            "#,
            id,
            status_str,
            discovered,
            saved,
            enriched,
            completed_at,
            now
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    // =========================================================================
    // Businesses & Search Results
    // =========================================================================

    pub async fn find_business_by_domain(&self, domain: &str) -> Result<Option<Business>, sqlx::Error> {
        let row = sqlx::query!(
            r#"
            SELECT id, name, normalized_name, slug, industry, sub_industry, description,
                   address, city, state, postal_code, country, country_code, latitude, longitude,
                   phone, normalized_phone, email, website, domain,
                   rating::FLOAT8 as "rating?", review_count, has_website, has_ssl, is_mobile_friendly,
                   website_load_time_ms, status, priority, priority_score, confidence::FLOAT8 as "confidence!",
                   data_completeness, discovered_at, last_enriched_at, last_analyzed_at, created_at, updated_at
            FROM businesses
            WHERE domain = $1
            LIMIT 1
            "#,
            domain
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| self.map_business_row(r)))
    }

    pub async fn find_business_by_normalized_name_and_city(
        &self,
        name: &str,
        city: &str,
    ) -> Result<Option<Business>, sqlx::Error> {
        let row = sqlx::query!(
            r#"
            SELECT id, name, normalized_name, slug, industry, sub_industry, description,
                   address, city, state, postal_code, country, country_code, latitude, longitude,
                   phone, normalized_phone, email, website, domain,
                   rating::FLOAT8 as "rating?", review_count, has_website, has_ssl, is_mobile_friendly,
                   website_load_time_ms, status, priority, priority_score, confidence::FLOAT8 as "confidence!",
                   data_completeness, discovered_at, last_enriched_at, last_analyzed_at, created_at, updated_at
            FROM businesses
            WHERE normalized_name = $1 AND city ILIKE $2
            LIMIT 1
            "#,
            name,
            city
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| self.map_business_row(r)))
    }

    pub async fn save_business(&self, b: &Business) -> Result<Business, sqlx::Error> {
        let status_str = format!("{:?}", b.status).to_uppercase();
        let priority_str = b.priority.to_string();

        sqlx::query!(
            r#"
            INSERT INTO businesses (
                id, name, normalized_name, slug, industry, sub_industry, description,
                address, city, state, postal_code, country, country_code, latitude, longitude,
                phone, normalized_phone, email, website, domain,
                rating, review_count, has_website, has_ssl, is_mobile_friendly,
                website_load_time_ms, status, priority, priority_score, confidence,
                data_completeness, discovered_at, last_enriched_at, last_analyzed_at, created_at, updated_at
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
                $29, $30, $31, $32, $33, $34, $35, $36
            )
            ON CONFLICT (id) DO UPDATE
            SET name = EXCLUDED.name,
                normalized_name = EXCLUDED.normalized_name,
                phone = COALESCE(EXCLUDED.phone, businesses.phone),
                email = COALESCE(EXCLUDED.email, businesses.email),
                website = COALESCE(EXCLUDED.website, businesses.website),
                domain = COALESCE(EXCLUDED.domain, businesses.domain),
                rating = COALESCE(EXCLUDED.rating, businesses.rating),
                review_count = GREATEST(EXCLUDED.review_count, businesses.review_count),
                priority = EXCLUDED.priority,
                priority_score = EXCLUDED.priority_score,
                status = EXCLUDED.status,
                data_completeness = EXCLUDED.data_completeness,
                updated_at = EXCLUDED.updated_at
            "#,
            b.id,
            b.name,
            b.normalized_name,
            b.slug,
            b.industry,
            b.sub_industry,
            b.description,
            b.address,
            b.city,
            b.state,
            b.postal_code,
            b.country,
            b.country_code,
            b.latitude,
            b.longitude,
            b.phone,
            b.normalized_phone,
            b.email,
            b.website,
            b.domain,
            b.rating.map(|r| rust_decimal::Decimal::from_f64_retain(r).unwrap_or_default()),
            b.review_count,
            b.has_website,
            b.has_ssl,
            b.is_mobile_friendly,
            b.website_load_time_ms,
            status_str,
            priority_str,
            b.priority_score,
            rust_decimal::Decimal::from_f64_retain(b.confidence).unwrap_or_default(),
            b.data_completeness,
            b.discovered_at,
            b.last_enriched_at,
            b.last_analyzed_at,
            b.created_at,
            b.updated_at
        )
        .execute(&self.pool)
        .await?;

        Ok(b.clone())
    }

    pub async fn link_search_result(
        &self,
        search_id: Uuid,
        business_id: Uuid,
        provider_id: &str,
        rank_order: i32,
    ) -> Result<(), sqlx::Error> {
        sqlx::query!(
            r#"
            INSERT INTO search_results (search_id, business_id, provider_id, rank_order)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (search_id, business_id) DO NOTHING
            "#,
            search_id,
            business_id,
            provider_id,
            rank_order
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn save_source_record(
        &self,
        business_id: Uuid,
        source_code: &str,
        source_url: Option<&str>,
        raw_payload: &serde_json::Value,
        confidence: f64,
    ) -> Result<(), sqlx::Error> {
        let conf_decimal = rust_decimal::Decimal::from_f64_retain(confidence).unwrap_or_default();
        sqlx::query!(
            r#"
            INSERT INTO source_records (business_id, source_code, source_url, raw_payload, confidence)
            VALUES ($1, $2, $3, $4, $5)
            "#,
            business_id,
            source_code,
            source_url,
            raw_payload,
            conf_decimal
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn list_businesses(
        &self,
        industry: Option<&str>,
        city: Option<&str>,
        priority: Option<&str>,
        limit: i64,
    ) -> Result<Vec<Business>, sqlx::Error> {
        let rows = sqlx::query!(
            r#"
            SELECT id, name, normalized_name, slug, industry, sub_industry, description,
                   address, city, state, postal_code, country, country_code, latitude, longitude,
                   phone, normalized_phone, email, website, domain,
                   rating::FLOAT8 as "rating?", review_count, has_website, has_ssl, is_mobile_friendly,
                   website_load_time_ms, status, priority, priority_score, confidence::FLOAT8 as "confidence!",
                   data_completeness, discovered_at, last_enriched_at, last_analyzed_at, created_at, updated_at
            FROM businesses
            WHERE ($1::TEXT IS NULL OR industry ILIKE $1)
              AND ($2::TEXT IS NULL OR city ILIKE $2)
              AND ($3::TEXT IS NULL OR priority = $3)
            ORDER BY priority_score DESC, created_at DESC
            LIMIT $4
            "#,
            industry,
            city,
            priority,
            limit
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(|r| self.map_business_row(r)).collect())
    }

    pub async fn get_business_profile(&self, id: Uuid) -> Result<Option<BusinessProfile>, sqlx::Error> {
        let business_row = sqlx::query!(
            r#"
            SELECT id, name, normalized_name, slug, industry, sub_industry, description,
                   address, city, state, postal_code, country, country_code, latitude, longitude,
                   phone, normalized_phone, email, website, domain,
                   rating::FLOAT8 as "rating?", review_count, has_website, has_ssl, is_mobile_friendly,
                   website_load_time_ms, status, priority, priority_score, confidence::FLOAT8 as "confidence!",
                   data_completeness, discovered_at, last_enriched_at, last_analyzed_at, created_at, updated_at
            FROM businesses
            WHERE id = $1
            "#,
            id
        )
        .fetch_optional(&self.pool)
        .await?;

        let Some(b_row) = business_row else {
            return Ok(None);
        };

        let business = self.map_business_row(b_row);

        // Fetch contacts
        let contact_rows = sqlx::query!(
            r#"
            SELECT id, business_id, contact_type, value, label, full_name, title, source_url,
                   confidence::FLOAT8 as "confidence!", verified, created_at
            FROM contacts WHERE business_id = $1
            "#,
            id
        )
        .fetch_all(&self.pool)
        .await?;

        let contacts = contact_rows
            .into_iter()
            .map(|r| Contact {
                id: r.id,
                business_id: r.business_id,
                contact_type: r.contact_type,
                value: r.value,
                label: r.label,
                full_name: r.full_name,
                title: r.title,
                source_url: r.source_url,
                confidence: r.confidence,
                verified: r.verified.unwrap_or(false),
                created_at: r.created_at,
            })
            .collect();

        // Fetch opportunities
        let opp_rows = sqlx::query!(
            r#"
            SELECT id, business_id, title, description, category, impact, onefolk_service,
                   service_tier, confidence::FLOAT8 as "confidence!", estimated_revenue_potential,
                   evidence, status, created_at
            FROM opportunities WHERE business_id = $1
            "#,
            id
        )
        .fetch_all(&self.pool)
        .await?;

        let opportunities = opp_rows
            .into_iter()
            .map(|r| Opportunity {
                id: r.id,
                business_id: r.business_id,
                title: r.title,
                description: r.description,
                category: r.category,
                impact: match r.impact.as_str() {
                    "LOW" => OpportunityImpact::Low,
                    "MEDIUM" => OpportunityImpact::Medium,
                    _ => OpportunityImpact::High,
                },
                onefolk_service: r.onefolk_service,
                service_tier: r.service_tier.unwrap_or_else(|| "STANDARD".to_string()),
                confidence: r.confidence,
                estimated_revenue_potential: r.estimated_revenue_potential,
                evidence: serde_json::from_value(r.evidence).unwrap_or_default(),
                status: r.status,
                created_at: r.created_at,
            })
            .collect();

        // Fetch activities
        let act_rows = sqlx::query!(
            r#"
            SELECT id, business_id, search_id, event_type, title, description, metadata, created_at
            FROM activities WHERE business_id = $1 ORDER BY created_at DESC
            "#,
            id
        )
        .fetch_all(&self.pool)
        .await?;

        let activities = act_rows
            .into_iter()
            .map(|r| ActivityEvent {
                id: r.id,
                business_id: r.business_id,
                search_id: r.search_id,
                event_type: r.event_type,
                title: r.title,
                description: r.description,
                metadata: r.metadata,
                created_at: r.created_at,
            })
            .collect();

        Ok(Some(BusinessProfile {
            business,
            contacts,
            website: None,
            social_profiles: vec![],
            reviews: vec![],
            technologies: vec![],
            facts: vec![],
            analysis: None,
            opportunities,
            activities,
        }))
    }

    pub async fn add_activity(
        &self,
        business_id: Option<Uuid>,
        search_id: Option<Uuid>,
        event_type: &str,
        title: &str,
        description: Option<&str>,
        metadata: &serde_json::Value,
    ) -> Result<ActivityEvent, sqlx::Error> {
        let id = Uuid::new_v4();
        let now = Utc::now();

        sqlx::query!(
            r#"
            INSERT INTO activities (id, business_id, search_id, event_type, title, description, metadata, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            "#,
            id,
            business_id,
            search_id,
            event_type,
            title,
            description,
            metadata,
            now
        )
        .execute(&self.pool)
        .await?;

        Ok(ActivityEvent {
            id,
            business_id,
            search_id,
            event_type: event_type.to_string(),
            title: title.to_string(),
            description: description.map(|s| s.to_string()),
            metadata: metadata.clone(),
            created_at: now,
        })
    }

    pub async fn save_contact(&self, c: &Contact) -> Result<(), sqlx::Error> {
        let conf = rust_decimal::Decimal::from_f64_retain(c.confidence).unwrap_or_default();
        sqlx::query!(
            r#"
            INSERT INTO contacts (id, business_id, contact_type, value, label, full_name, title, source_url, confidence, verified, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (id) DO NOTHING
            "#,
            c.id,
            c.business_id,
            c.contact_type,
            c.value,
            c.label,
            c.full_name,
            c.title,
            c.source_url,
            conf,
            c.verified,
            c.created_at
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn save_opportunity(&self, opp: &Opportunity) -> Result<(), sqlx::Error> {
        let conf = rust_decimal::Decimal::from_f64_retain(opp.confidence).unwrap_or_default();
        let impact_str = format!("{:?}", opp.impact).to_uppercase();
        let evidence_json = serde_json::to_value(&opp.evidence).unwrap_or_default();

        sqlx::query!(
            r#"
            INSERT INTO opportunities (
                id, business_id, title, description, category, impact, onefolk_service,
                service_tier, confidence, estimated_revenue_potential, evidence, status, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (id) DO NOTHING
            "#,
            opp.id,
            opp.business_id,
            opp.title,
            opp.description,
            opp.category,
            impact_str,
            opp.onefolk_service,
            opp.service_tier,
            conf,
            opp.estimated_revenue_potential,
            evidence_json,
            opp.status,
            opp.created_at
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn list_opportunities(&self, limit: i64) -> Result<Vec<Opportunity>, sqlx::Error> {
        let rows = sqlx::query!(
            r#"
            SELECT id, business_id, title, description, category, impact, onefolk_service,
                   service_tier, confidence::FLOAT8 as "confidence!", estimated_revenue_potential,
                   evidence, status, created_at
            FROM opportunities
            ORDER BY created_at DESC
            LIMIT $1
            "#,
            limit
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|r| Opportunity {
                id: r.id,
                business_id: r.business_id,
                title: r.title,
                description: r.description,
                category: r.category,
                impact: match r.impact.as_str() {
                    "LOW" => OpportunityImpact::Low,
                    "MEDIUM" => OpportunityImpact::Medium,
                    _ => OpportunityImpact::High,
                },
                onefolk_service: r.onefolk_service,
                service_tier: r.service_tier.unwrap_or_else(|| "STANDARD".to_string()),
                confidence: r.confidence,
                estimated_revenue_potential: r.estimated_revenue_potential,
                evidence: serde_json::from_value(r.evidence).unwrap_or_default(),
                status: r.status,
                created_at: r.created_at,
            })
            .collect())
    }

    pub async fn list_activities(&self, limit: i64) -> Result<Vec<ActivityEvent>, sqlx::Error> {
        let rows = sqlx::query!(
            r#"
            SELECT id, business_id, search_id, event_type, title, description, metadata, created_at
            FROM activities
            ORDER BY created_at DESC
            LIMIT $1
            "#,
            limit
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|r| ActivityEvent {
                id: r.id,
                business_id: r.business_id,
                search_id: r.search_id,
                event_type: r.event_type,
                title: r.title,
                description: r.description,
                metadata: r.metadata,
                created_at: r.created_at,
            })
            .collect())
    }

    fn map_business_row(
        &self,
        r: sqlx_business_row::RowData,
    ) -> Business {
        Business {
            id: r.id,
            name: r.name,
            normalized_name: r.normalized_name,
            slug: r.slug,
            industry: r.industry,
            sub_industry: r.sub_industry,
            description: r.description,
            address: r.address,
            city: r.city,
            state: r.state,
            postal_code: r.postal_code,
            country: r.country,
            country_code: r.country_code,
            latitude: r.latitude,
            longitude: r.longitude,
            phone: r.phone,
            normalized_phone: r.normalized_phone,
            email: r.email,
            website: r.website,
            domain: r.domain,
            rating: r.rating,
            review_count: r.review_count.unwrap_or(0),
            has_website: r.has_website.unwrap_or(false),
            has_ssl: r.has_ssl.unwrap_or(false),
            is_mobile_friendly: r.is_mobile_friendly.unwrap_or(false),
            website_load_time_ms: r.website_load_time_ms,
            status: match r.status.as_str() {
                "DISCOVERED" => BusinessStatus::Discovered,
                "ENRICHING" => BusinessStatus::Enriching,
                "ENRICHED" => BusinessStatus::Enriched,
                "ANALYZING" => BusinessStatus::Analyzing,
                "ANALYZED" => BusinessStatus::Analyzed,
                "OPPORTUNITY_FOUND" => BusinessStatus::OpportunityFound,
                "SAVED" => BusinessStatus::Saved,
                "CONTACTED" => BusinessStatus::Contacted,
                "BLOCKED" => BusinessStatus::Blocked,
                _ => BusinessStatus::New,
            },
            priority: match r.priority.as_str() {
                "HIGH" => ClientPriority::High,
                "LOW" => ClientPriority::Low,
                _ => ClientPriority::Medium,
            },
            priority_score: r.priority_score,
            confidence: r.confidence,
            data_completeness: r.data_completeness,
            discovered_at: r.discovered_at,
            last_enriched_at: r.last_enriched_at,
            last_analyzed_at: r.last_analyzed_at,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

// Internal row mapping helper module
mod sqlx_business_row {
    use chrono::{DateTime, Utc};
    use uuid::Uuid;

    pub struct RowData {
        pub id: Uuid,
        pub name: String,
        pub normalized_name: String,
        pub slug: String,
        pub industry: String,
        pub sub_industry: Option<String>,
        pub description: Option<String>,
        pub address: Option<String>,
        pub city: Option<String>,
        pub state: Option<String>,
        pub postal_code: Option<String>,
        pub country: String,
        pub country_code: Option<String>,
        pub latitude: Option<f64>,
        pub longitude: Option<f64>,
        pub phone: Option<String>,
        pub normalized_phone: Option<String>,
        pub email: Option<String>,
        pub website: Option<String>,
        pub domain: Option<String>,
        pub rating: Option<f64>,
        pub review_count: Option<i32>,
        pub has_website: Option<bool>,
        pub has_ssl: Option<bool>,
        pub is_mobile_friendly: Option<bool>,
        pub website_load_time_ms: Option<i32>,
        pub status: String,
        pub priority: String,
        pub priority_score: i32,
        pub confidence: f64,
        pub data_completeness: i32,
        pub discovered_at: DateTime<Utc>,
        pub last_enriched_at: Option<DateTime<Utc>>,
        pub last_analyzed_at: Option<DateTime<Utc>>,
        pub created_at: DateTime<Utc>,
        pub updated_at: DateTime<Utc>,
    }
}
