use chrono::Utc;
use domain::Contact;
use regex::Regex;
use uuid::Uuid;

pub struct ContactExtractor;

impl ContactExtractor {
    pub fn extract_from_html(
        business_id: Uuid,
        html_content: &str,
        source_url: &str,
    ) -> Vec<Contact> {
        let mut contacts = Vec::new();
        let mut seen_values = std::collections::HashSet::new();

        // 1. Email Extraction
        let email_re = Regex::new(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}").unwrap();
        for cap in email_re.captures_iter(html_content) {
            let email = cap[0].to_lowercase();
            // Filter common asset false-positives
            if !email.ends_with(".png")
                && !email.ends_with(".jpg")
                && !email.ends_with(".svg")
                && !email.ends_with(".webp")
                && !email.contains("sentry")
                && !email.contains("wixpress")
                && !email.contains("schema.org")
                && !seen_values.contains(&email)
            {
                seen_values.insert(email.clone());
                let label = if email.starts_with("sales") {
                    "sales"
                } else if email.starts_with("support") || email.starts_with("help") {
                    "support"
                } else if email.starts_with("info") || email.starts_with("contact") {
                    "general"
                } else if email.starts_with("reservations") || email.starts_with("booking") {
                    "reservations"
                } else {
                    "public"
                };

                contacts.push(Contact {
                    id: Uuid::new_v4(),
                    business_id,
                    contact_type: "email".to_string(),
                    value: email,
                    label: Some(label.to_string()),
                    full_name: None,
                    title: None,
                    source_url: Some(source_url.to_string()),
                    confidence: 0.95,
                    verified: true,
                    created_at: Utc::now(),
                });
            }
        }

        // 2. Phone Extraction (tel: links)
        let tel_re = Regex::new(r#"href=["']tel:([^"']+)["']"#).unwrap();
        for cap in tel_re.captures_iter(html_content) {
            let phone = cap[1].trim().to_string();
            if !phone.is_empty() && !seen_values.contains(&phone) {
                seen_values.insert(phone.clone());
                contacts.push(Contact {
                    id: Uuid::new_v4(),
                    business_id,
                    contact_type: "phone".to_string(),
                    value: phone,
                    label: Some("direct".to_string()),
                    full_name: None,
                    title: None,
                    source_url: Some(source_url.to_string()),
                    confidence: 0.98,
                    verified: true,
                    created_at: Utc::now(),
                });
            }
        }

        // 3. Social Media Links
        let social_rules = [
            ("instagram", r#"href=["'](https?://(?:www\.)?instagram\.com/[a-zA-Z0-9_.-]+)["']"#),
            ("facebook", r#"href=["'](https?://(?:www\.)?facebook\.com/[a-zA-Z0-9_.-]+)["']"#),
            ("linkedin", r#"href=["'](https?://(?:www\.)?linkedin\.com/(?:company|in)/[a-zA-Z0-9_.-]+)["']"#),
            ("tiktok", r#"href=["'](https?://(?:www\.)?tiktok\.com/@[a-zA-Z0-9_.-]+)["']"#),
            ("youtube", r#"href=["'](https?://(?:www\.)?youtube\.com/(?:c/|@)?[a-zA-Z0-9_.-]+)["']"#),
        ];

        for (platform, rule) in social_rules {
            if let Ok(re) = Regex::new(rule) {
                for cap in re.captures_iter(html_content) {
                    let url = cap[1].trim().to_string();
                    if !seen_values.contains(&url) {
                        seen_values.insert(url.clone());
                        contacts.push(Contact {
                            id: Uuid::new_v4(),
                            business_id,
                            contact_type: format!("social_{}", platform),
                            value: url,
                            label: Some(platform.to_string()),
                            full_name: None,
                            title: None,
                            source_url: Some(source_url.to_string()),
                            confidence: 0.99,
                            verified: true,
                            created_at: Utc::now(),
                        });
                    }
                }
            }
        }

        contacts
    }
}
