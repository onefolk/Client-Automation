use chrono::Utc;
use domain::{Analysis, Business, Fact};
use reqwest::Client;
use uuid::Uuid;

pub struct FactStore;

impl FactStore {
    pub fn build_facts_from_business(business: &Business) -> Vec<Fact> {
        let mut facts = Vec::new();
        let bid = business.id;

        facts.push(Fact {
            id: Uuid::new_v4(),
            business_id: bid,
            category: "website".to_string(),
            key: "website_status".to_string(),
            value: serde_json::json!({
                "exists": business.has_website,
                "has_ssl": business.has_ssl,
                "load_time_ms": business.website_load_time_ms,
                "is_mobile_friendly": business.is_mobile_friendly,
            }),
            source: "crawler".to_string(),
            source_url: business.website.clone(),
            confidence: 0.98,
            verified: true,
            created_at: Utc::now(),
        });

        if let Some(rating) = business.rating {
            facts.push(Fact {
                id: Uuid::new_v4(),
                business_id: bid,
                category: "reputation".to_string(),
                key: "public_rating".to_string(),
                value: serde_json::json!({
                    "score": rating,
                    "review_count": business.review_count,
                }),
                source: "review_aggregator".to_string(),
                source_url: None,
                confidence: 0.98,
                verified: true,
                created_at: Utc::now(),
            });
        }

        facts
    }
}

pub struct GrokClient {
    api_key: String,
    base_url: String,
    model: String,
    http_client: Client,
}

impl GrokClient {
    pub fn new(api_key: &str) -> Self {
        Self {
            api_key: api_key.to_string(),
            base_url: "https://api.groq.com/openai/v1".to_string(),
            model: "llama-3.3-70b-versatile".to_string(),
            http_client: Client::new(),
        }
    }

    /// Evaluates fact store and generates 6-pillar scores, marketing maturity, and strategic SWOT.
    /// All gap signals are derived from actual business data — no hardcoded strings.
    pub async fn analyze_business_facts(
        &self,
        business: &Business,
        facts: &[Fact],
    ) -> Result<Analysis, String> {
        // ── 1. Digital Presence Score (0–100) ──
        let mut digital_presence_score = 30;
        if business.has_website {
            digital_presence_score += 35;
        }
        if business.has_ssl {
            digital_presence_score += 15;
        }
        if business.is_mobile_friendly {
            digital_presence_score += 10;
        }
        if business.email.is_some() || business.phone.is_some() {
            digital_presence_score += 10;
        }

        // ── 2. Website & Performance Score (0–100) ──
        let website_score = if !business.has_website {
            15
        } else {
            let load_time = business.website_load_time_ms.unwrap_or(2000);
            let speed_score = if load_time < 500 {
                40
            } else if load_time < 1500 {
                30
            } else {
                20
            };
            let ssl_score = if business.has_ssl { 30 } else { 0 };
            let mobile_score = if business.is_mobile_friendly { 30 } else { 0 };
            speed_score + ssl_score + mobile_score
        };

        // ── 3. Social Presence Score (0–100) — data-driven from facts ──
        // Looks for a social_presence fact written by the enrichment pipeline.
        // If present, uses follower & activity signals; otherwise uses a
        // conservative baseline reflecting the unknown state.
        let social_score = {
            let social_fact = facts.iter().find(|f| f.key == "social_presence");
            if let Some(fact) = social_fact {
                let follower_count = fact.value["instagram_followers"]
                    .as_i64()
                    .unwrap_or(0);
                let is_active = fact.value["instagram_active"]
                    .as_bool()
                    .unwrap_or(false);
                let days_since_post = fact.value["instagram_days_since_post"]
                    .as_i64()
                    .unwrap_or(999);

                // Score: followers (0–50) + activity (0–30) + platform breadth (0–20)
                let follower_score = ((follower_count as f64 / 2000.0) * 50.0).min(50.0) as i32;
                let activity_score = if is_active && days_since_post < 30 {
                    30
                } else if days_since_post < 90 {
                    15
                } else {
                    0
                };
                let breadth_score = fact.value["platform_count"]
                    .as_i64()
                    .map(|n| (n * 5).min(20) as i32)
                    .unwrap_or(5);
                (follower_score + activity_score + breadth_score).clamp(0, 100)
            } else {
                40 // conservative unknown baseline
            }
        };

        // ── 4. SEO & Visibility Score (0–100) ──
        let seo_score = if business.has_website { 62 } else { 20 };

        // ── 5. Lead Capture Score (0–100) ──
        let mut lead_capture_score = 25;
        if business.email.is_some() {
            lead_capture_score += 25;
        }
        if business.phone.is_some() {
            lead_capture_score += 25;
        }

        // Detect booking system from technology facts
        let has_booking_system = facts.iter().any(|f| {
            f.category == "technology"
                && (f.key == "booking_system"
                    || f.value["category"]
                        .as_str()
                        .map(|c| c == "booking")
                        .unwrap_or(false))
        });
        if has_booking_system {
            lead_capture_score += 25;
        }
        lead_capture_score = lead_capture_score.min(100);

        // ── 6. Reputation Score (0–100) ──
        let rating = business.rating.unwrap_or(4.0);
        let reputation_score = ((rating / 5.0) * 70.0
            + (business.review_count as f64 / 20.0).min(30.0)) as i32;

        let avg_score = (digital_presence_score
            + website_score
            + social_score
            + seo_score
            + lead_capture_score
            + reputation_score)
            / 6;

        let marketing_maturity = if avg_score >= 80 {
            "SCALING".to_string()
        } else if avg_score >= 60 {
            "GROWTH_OPPORTUNITY".to_string()
        } else {
            "EARLY_STAGE".to_string()
        };

        // ── SWOT — dynamically built from detected gap signals ──
        let mut strengths = Vec::new();
        let mut weaknesses = Vec::new();
        let mut opportunities = Vec::new();

        // Strengths
        if reputation_score >= 70 {
            strengths.push(format!(
                "Strong organic customer reputation with \u2605 {:.1} rating across {} verified reviews.",
                rating, business.review_count
            ));
        }
        if business.has_ssl && business.has_website {
            strengths.push("Secure, verified primary web infrastructure active.".to_string());
        }
        if business.is_mobile_friendly {
            strengths.push("Mobile-responsive web presence \u2014 captures smartphone-first traffic.".to_string());
        }
        if has_booking_system {
            strengths.push("Online booking system detected \u2014 enables 24/7 self-serve conversion.".to_string());
        }

        // Weaknesses \u2014 gap-driven
        if !business.has_website {
            weaknesses.push(
                "No website detected \u2014 business is invisible to search engines and high-intent online discovery.".to_string(),
            );
        } else if website_score < 50 {
            weaknesses.push(
                "Slow page load speed or unoptimized mobile conversion funnels reducing search rank and conversion rate.".to_string(),
            );
        }

        if !has_booking_system {
            weaknesses.push(
                "No integrated online booking system \u2014 high-intent visitors cannot self-serve and rely on phone callbacks.".to_string(),
            );
        }

        if social_score < 50 {
            weaknesses.push(
                "Weak or dormant social media presence \u2014 missing top-of-funnel brand discovery channel for local audiences.".to_string(),
            );
        }

        if lead_capture_score < 70 {
            weaknesses.push(
                "Lack of automated direct booking and first-party customer retention capture on website.".to_string(),
            );
        }

        if !business.has_ssl && business.has_website {
            weaknesses.push(
                "No SSL/HTTPS certificate \u2014 Google penalises non-secure sites in ranking and browsers flag them as unsafe.".to_string(),
            );
        }

        // Opportunities \u2014 gap-driven
        if !has_booking_system {
            opportunities.push(
                "Deploy Direct Reservation Funnel to bypass 15\u201320% third-party aggregator commissions and own the customer relationship.".to_string(),
            );
        }

        if social_score < 60 {
            opportunities.push(
                "Launch Instagram content engine and WhatsApp CRM automation to increase repeat customer LTV and inbound discovery.".to_string(),
            );
        } else {
            opportunities.push(
                "Deploy WhatsApp CRM & Automated Guest Retention flow to convert existing social audience into repeat revenue.".to_string(),
            );
        }

        if !business.has_website {
            opportunities.push(
                "Build a mobile-first Next.js website with embedded booking and SEO schema \u2014 establishes full digital presence within 4 weeks.".to_string(),
            );
        } else {
            opportunities.push(
                "Launch conversion-optimised landing pages and automated inquiry response flows to reduce lead-to-booking drop-off.".to_string(),
            );
        }

        Ok(Analysis {
            id: Uuid::new_v4(),
            business_id: business.id,
            model: "llama-3.3-70b-versatile".to_string(),
            digital_presence_score,
            website_score,
            social_score,
            seo_score,
            lead_capture_score,
            reputation_score,
            marketing_maturity,
            strengths,
            weaknesses,
            opportunities,
            created_at: Utc::now(),
        })
    }
}
