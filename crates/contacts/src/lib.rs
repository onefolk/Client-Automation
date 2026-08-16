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

        // 1. Email Extraction
        let email_re = Regex::new(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}").unwrap();
        for cap in email_re.captures_iter(html_content) {
            let email = cap[0].to_lowercase();
            // Filter common asset false-positives
            if !email.ends_with(".png")
                && !email.ends_with(".jpg")
                && !email.ends_with(".webp")
                && !email.contains("sentry")
                && !email.contains("wixpress")
            {
                let label = if email.starts_with("sales") {
                    "sales"
                } else if email.starts_with("support") || email.starts_with("help") {
                    "support"
                } else if email.starts_with("info") || email.starts_with("contact") {
                    "general"
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
                    verified: false,
                    created_at: Utc::now(),
                });
            }
        }

        contacts
    }
}
