use chrono::{DateTime, Utc};
use domain::{
    ActivityEvent, Business, BusinessProfile, BusinessStatus, ClientPriority, Contact,
    Opportunity, OpportunityImpact, SearchFilters, SearchSession, SearchStatus,
};
use sqlx::{postgres::PgPoolOptions, PgPool, Row};
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

        let row = sqlx::query(
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
        )
        .bind(id)
        .bind(query)
        .bind(filters_json)
        .bind(providers)
        .bind(now)
        .bind("PENDING")
        .bind(0i32)
        .bind(0i32)
        .bind(0i32)
        .bind(errors_json)
        .bind(now)
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        Ok(self.map_search_session_row(&row))
    }

    pub async fn get_search(&self, id: Uuid) -> Result<Option<SearchSession>, sqlx::Error> {
        let row = sqlx::query(
            r#"
            SELECT id, user_id, query, filters, providers_selected, started_at, completed_at,
                   status, total_discovered, total_saved, total_enriched, errors, duration_ms,
                   created_at, updated_at
            FROM searches
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.as_ref().map(|r| self.map_search_session_row(r)))
    }

    pub async fn list_searches(&self, limit: i64) -> Result<Vec<SearchSession>, sqlx::Error> {
        let rows = sqlx::query(
            r#"
            SELECT id, user_id, query, filters, providers_selected, started_at, completed_at,
                   status, total_discovered, total_saved, total_enriched, errors, duration_ms,
                   created_at, updated_at
            FROM searches
            ORDER BY created_at DESC
            LIMIT $1
            "#,
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.iter().map(|r| self.map_search_session_row(r)).collect())
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

        sqlx::query(
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
        )
        .bind(id)
        .bind(status_str)
        .bind(discovered)
        .bind(saved)
        .bind(enriched)
        .bind(completed_at)
        .bind(now)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    // =========================================================================
    // Businesses & Search Results
    // =========================================================================

    pub async fn find_business_by_domain(&self, domain: &str) -> Result<Option<Business>, sqlx::Error> {
        let row = sqlx::query(
            r#"
            SELECT id, name, normalized_name, slug, industry, sub_industry, description,
                   address, city, state, postal_code, country, country_code, latitude, longitude,
                   phone, normalized_phone, email, website, domain,
                   rating, review_count, has_website, has_ssl, is_mobile_friendly,
                   website_load_time_ms, status, priority, priority_score, confidence,
                   data_completeness, discovered_at, last_enriched_at, last_analyzed_at, created_at, updated_at
            FROM businesses
            WHERE domain = $1
            LIMIT 1
            "#,
        )
        .bind(domain)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.as_ref().map(|r| self.map_business_row(r)))
    }

    pub async fn find_business_by_normalized_name_and_city(
        &self,
        name: &str,
        city: &str,
    ) -> Result<Option<Business>, sqlx::Error> {
        let row = sqlx::query(
            r#"
            SELECT id, name, normalized_name, slug, industry, sub_industry, description,
                   address, city, state, postal_code, country, country_code, latitude, longitude,
                   phone, normalized_phone, email, website, domain,
                   rating, review_count, has_website, has_ssl, is_mobile_friendly,
                   website_load_time_ms, status, priority, priority_score, confidence,
                   data_completeness, discovered_at, last_enriched_at, last_analyzed_at, created_at, updated_at
            FROM businesses
            WHERE normalized_name = $1 AND city ILIKE $2
            LIMIT 1
            "#,
        )
        .bind(name)
        .bind(city)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.as_ref().map(|r| self.map_business_row(r)))
    }

    pub async fn save_business(&self, b: &Business) -> Result<Business, sqlx::Error> {
        let status_str = format!("{:?}", b.status).to_uppercase();
        let priority_str = b.priority.to_string();

        sqlx::query(
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
        )
        .bind(b.id)
        .bind(&b.name)
        .bind(&b.normalized_name)
        .bind(&b.slug)
        .bind(&b.industry)
        .bind(&b.sub_industry)
        .bind(&b.description)
        .bind(&b.address)
        .bind(&b.city)
        .bind(&b.state)
        .bind(&b.postal_code)
        .bind(&b.country)
        .bind(&b.country_code)
        .bind(b.latitude)
        .bind(b.longitude)
        .bind(&b.phone)
        .bind(&b.normalized_phone)
        .bind(&b.email)
        .bind(&b.website)
        .bind(&b.domain)
        .bind(b.rating)
        .bind(b.review_count)
        .bind(b.has_website)
        .bind(b.has_ssl)
        .bind(b.is_mobile_friendly)
        .bind(b.website_load_time_ms)
        .bind(status_str)
        .bind(priority_str)
        .bind(b.priority_score)
        .bind(b.confidence)
        .bind(b.data_completeness)
        .bind(b.discovered_at)
        .bind(b.last_enriched_at)
        .bind(b.last_analyzed_at)
        .bind(b.created_at)
        .bind(b.updated_at)
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
        sqlx::query(
            r#"
            INSERT INTO search_results (search_id, business_id, provider_id, rank_order)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (search_id, business_id) DO NOTHING
            "#,
        )
        .bind(search_id)
        .bind(business_id)
        .bind(provider_id)
        .bind(rank_order)
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
        sqlx::query(
            r#"
            INSERT INTO source_records (business_id, source_code, source_url, raw_payload, confidence)
            VALUES ($1, $2, $3, $4, $5)
            "#,
        )
        .bind(business_id)
        .bind(source_code)
        .bind(source_url)
        .bind(raw_payload)
        .bind(confidence)
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
        let rows = sqlx::query(
            r#"
            SELECT id, name, normalized_name, slug, industry, sub_industry, description,
                   address, city, state, postal_code, country, country_code, latitude, longitude,
                   phone, normalized_phone, email, website, domain,
                   rating, review_count, has_website, has_ssl, is_mobile_friendly,
                   website_load_time_ms, status, priority, priority_score, confidence,
                   data_completeness, discovered_at, last_enriched_at, last_analyzed_at, created_at, updated_at
            FROM businesses
            WHERE ($1::TEXT IS NULL OR industry ILIKE $1)
              AND ($2::TEXT IS NULL OR city ILIKE $2)
              AND ($3::TEXT IS NULL OR priority = $3)
            ORDER BY priority_score DESC, created_at DESC
            LIMIT $4
            "#,
        )
        .bind(industry)
        .bind(city)
        .bind(priority)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.iter().map(|r| self.map_business_row(r)).collect())
    }

    pub async fn get_business_profile(&self, id: Uuid) -> Result<Option<BusinessProfile>, sqlx::Error> {
        let business_row = sqlx::query(
            r#"
            SELECT id, name, normalized_name, slug, industry, sub_industry, description,
                   address, city, state, postal_code, country, country_code, latitude, longitude,
                   phone, normalized_phone, email, website, domain,
                   rating, review_count, has_website, has_ssl, is_mobile_friendly,
                   website_load_time_ms, status, priority, priority_score, confidence,
                   data_completeness, discovered_at, last_enriched_at, last_analyzed_at, created_at, updated_at
            FROM businesses
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        let Some(b_row) = business_row else {
            return Ok(None);
        };

        let business = self.map_business_row(&b_row);

        // Fetch contacts
        let contact_rows = sqlx::query(
            r#"
            SELECT id, business_id, contact_type, value, label, full_name, title, source_url,
                   confidence, verified, created_at
            FROM contacts WHERE business_id = $1
            "#,
        )
        .bind(id)
        .fetch_all(&self.pool)
        .await?;

        let contacts = contact_rows
            .into_iter()
            .map(|r| Contact {
                id: r.get("id"),
                business_id: r.get("business_id"),
                contact_type: r.get("contact_type"),
                value: r.get("value"),
                label: r.get("label"),
                full_name: r.get("full_name"),
                title: r.get("title"),
                source_url: r.get("source_url"),
                confidence: r.get("confidence"),
                verified: r.get::<Option<bool>, _>("verified").unwrap_or(false),
                created_at: r.get("created_at"),
            })
            .collect();

        // Fetch opportunities
        let opp_rows = sqlx::query(
            r#"
            SELECT id, business_id, title, description, category, impact, onefolk_service,
                service_tier, confidence, estimated_revenue_potential,
                evidence, status, created_at
            FROM opportunities WHERE business_id = $1
            "#,
        )
        .bind(id)
        .fetch_all(&self.pool)
        .await?;

        let opportunities = opp_rows
            .into_iter()
            .map(|r| {
                let impact_str: String = r.get("impact");
                let evidence_val: serde_json::Value = r.get("evidence");
                Opportunity {
                    id: r.get("id"),
                    business_id: r.get("business_id"),
                    title: r.get("title"),
                    description: r.get("description"),
                    category: r.get("category"),
                    impact: match impact_str.as_str() {
                        "LOW" => OpportunityImpact::Low,
                        "MEDIUM" => OpportunityImpact::Medium,
                        _ => OpportunityImpact::High,
                    },
                    onefolk_service: r.get("onefolk_service"),
                    service_tier: r.get::<Option<String>, _>("service_tier").unwrap_or_else(|| "STANDARD".to_string()),
                    confidence: r.get("confidence"),
                    estimated_revenue_potential: r.get("estimated_revenue_potential"),
                    evidence: serde_json::from_value(evidence_val).unwrap_or_default(),
                    status: r.get("status"),
                    created_at: r.get("created_at"),
                }
            })
            .collect();

        // Fetch activities
        let act_rows = sqlx::query(
            r#"
            SELECT id, business_id, search_id, event_type, title, description, metadata, created_at
            FROM activities WHERE business_id = $1 ORDER BY created_at DESC
            "#,
        )
        .bind(id)
        .fetch_all(&self.pool)
        .await?;

        let activities = act_rows
            .into_iter()
            .map(|r| ActivityEvent {
                id: r.get("id"),
                business_id: r.get("business_id"),
                search_id: r.get("search_id"),
                event_type: r.get("event_type"),
                title: r.get("title"),
                description: r.get("description"),
                metadata: r.get("metadata"),
                created_at: r.get("created_at"),
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

        sqlx::query(
            r#"
            INSERT INTO activities (id, business_id, search_id, event_type, title, description, metadata, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            "#,
        )
        .bind(id)
        .bind(business_id)
        .bind(search_id)
        .bind(event_type)
        .bind(title)
        .bind(description)
        .bind(metadata)
        .bind(now)
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
        sqlx::query(
            r#"
            INSERT INTO contacts (id, business_id, contact_type, value, label, full_name, title, source_url, confidence, verified, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (id) DO NOTHING
            "#,
        )
        .bind(c.id)
        .bind(c.business_id)
        .bind(&c.contact_type)
        .bind(&c.value)
        .bind(&c.label)
        .bind(&c.full_name)
        .bind(&c.title)
        .bind(&c.source_url)
        .bind(c.confidence)
        .bind(c.verified)
        .bind(c.created_at)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn save_opportunity(&self, opp: &Opportunity) -> Result<(), sqlx::Error> {
        let impact_str = format!("{:?}", opp.impact).to_uppercase();
        let evidence_json = serde_json::to_value(&opp.evidence).unwrap_or_default();

        sqlx::query(
            r#"
            INSERT INTO opportunities (
                id, business_id, title, description, category, impact, onefolk_service,
                service_tier, confidence, estimated_revenue_potential, evidence, status, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (id) DO NOTHING
            "#,
        )
        .bind(opp.id)
        .bind(opp.business_id)
        .bind(&opp.title)
        .bind(&opp.description)
        .bind(&opp.category)
        .bind(impact_str)
        .bind(&opp.onefolk_service)
        .bind(&opp.service_tier)
        .bind(opp.confidence)
        .bind(&opp.estimated_revenue_potential)
        .bind(evidence_json)
        .bind(&opp.status)
        .bind(opp.created_at)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn list_opportunities(&self, limit: i64) -> Result<Vec<Opportunity>, sqlx::Error> {
        let rows = sqlx::query(
            r#"
            SELECT id, business_id, title, description, category, impact, onefolk_service,
                service_tier, confidence, estimated_revenue_potential,
                evidence, status, created_at
            FROM opportunities
            ORDER BY created_at DESC
            LIMIT $1
            "#,
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|r| {
                let impact_str: String = r.get("impact");
                let evidence_val: serde_json::Value = r.get("evidence");
                Opportunity {
                    id: r.get("id"),
                    business_id: r.get("business_id"),
                    title: r.get("title"),
                    description: r.get("description"),
                    category: r.get("category"),
                    impact: match impact_str.as_str() {
                        "LOW" => OpportunityImpact::Low,
                        "MEDIUM" => OpportunityImpact::Medium,
                        _ => OpportunityImpact::High,
                    },
                    onefolk_service: r.get("onefolk_service"),
                    service_tier: r.get::<Option<String>, _>("service_tier").unwrap_or_else(|| "STANDARD".to_string()),
                    confidence: r.get("confidence"),
                    estimated_revenue_potential: r.get("estimated_revenue_potential"),
                    evidence: serde_json::from_value(evidence_val).unwrap_or_default(),
                    status: r.get("status"),
                    created_at: r.get("created_at"),
                }
            })
            .collect())
    }

    pub async fn list_activities(&self, limit: i64) -> Result<Vec<ActivityEvent>, sqlx::Error> {
        let rows = sqlx::query(
            r#"
            SELECT id, business_id, search_id, event_type, title, description, metadata, created_at
            FROM activities
            ORDER BY created_at DESC
            LIMIT $1
            "#,
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|r| ActivityEvent {
                id: r.get("id"),
                business_id: r.get("business_id"),
                search_id: r.get("search_id"),
                event_type: r.get("event_type"),
                title: r.get("title"),
                description: r.get("description"),
                metadata: r.get("metadata"),
                created_at: r.get("created_at"),
            })
            .collect())
    }

    fn map_search_session_row(&self, r: &sqlx::postgres::PgRow) -> SearchSession {
        let filters_val: serde_json::Value = r.get("filters");
        let errors_val: serde_json::Value = r.get("errors");
        let status_str: String = r.get("status");

        SearchSession {
            id: r.get("id"),
            user_id: r.get("user_id"),
            query: r.get("query"),
            filters: serde_json::from_value(filters_val).unwrap_or_default(),
            providers_selected: r.get("providers_selected"),
            started_at: r.get("started_at"),
            completed_at: r.get("completed_at"),
            status: match status_str.as_str() {
                "RUNNING" => SearchStatus::Running,
                "COMPLETED" => SearchStatus::Completed,
                "PARTIAL" => SearchStatus::Partial,
                "FAILED" => SearchStatus::Failed,
                "CANCELLED" => SearchStatus::Cancelled,
                _ => SearchStatus::Pending,
            },
            total_discovered: r.get("total_discovered"),
            total_saved: r.get("total_saved"),
            total_enriched: r.get("total_enriched"),
            errors: serde_json::from_value(errors_val).unwrap_or_default(),
            duration_ms: r.get("duration_ms"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
        }
    }

    fn map_business_row(&self, r: &sqlx::postgres::PgRow) -> Business {
        let status_str: String = r.get("status");
        let priority_str: String = r.get("priority");

        Business {
            id: r.get("id"),
            name: r.get("name"),
            normalized_name: r.get("normalized_name"),
            slug: r.get("slug"),
            industry: r.get("industry"),
            sub_industry: r.get("sub_industry"),
            description: r.get("description"),
            address: r.get("address"),
            city: r.get("city"),
            state: r.get("state"),
            postal_code: r.get("postal_code"),
            country: r.get("country"),
            country_code: r.get("country_code"),
            latitude: r.get("latitude"),
            longitude: r.get("longitude"),
            phone: r.get("phone"),
            normalized_phone: r.get("normalized_phone"),
            email: r.get("email"),
            website: r.get("website"),
            domain: r.get("domain"),
            rating: r.get("rating"),
            review_count: r.get::<Option<i32>, _>("review_count").unwrap_or(0),
            has_website: r.get::<Option<bool>, _>("has_website").unwrap_or(false),
            has_ssl: r.get::<Option<bool>, _>("has_ssl").unwrap_or(false),
            is_mobile_friendly: r.get::<Option<bool>, _>("is_mobile_friendly").unwrap_or(false),
            website_load_time_ms: r.get("website_load_time_ms"),
            status: match status_str.as_str() {
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
            priority: match priority_str.as_str() {
                "HIGH" => ClientPriority::High,
                "LOW" => ClientPriority::Low,
                _ => ClientPriority::Medium,
            },
            priority_score: r.get("priority_score"),
            confidence: r.get("confidence"),
            data_completeness: r.get("data_completeness"),
            discovered_at: r.get("discovered_at"),
            last_enriched_at: r.get("last_enriched_at"),
            last_analyzed_at: r.get("last_analyzed_at"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
        }
    }
}
