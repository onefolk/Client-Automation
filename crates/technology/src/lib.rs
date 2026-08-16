use domain::Technology;
use uuid::Uuid;

pub struct TechDetector;

impl TechDetector {
    pub fn detect_technologies(business_id: Uuid, html: &str) -> Vec<Technology> {
        let mut techs = Vec::new();
        let lower = html.to_lowercase();

        // CMS
        if lower.contains("wp-content") || lower.contains("wp-includes") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "CMS".to_string(),
                name: "WordPress".to_string(),
                version: None,
                confidence: 0.98,
                evidence: Some("wp-content directory structure detected".to_string()),
            });
        }

        if lower.contains("cdn.shopify.com") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "Ecommerce".to_string(),
                name: "Shopify".to_string(),
                version: None,
                confidence: 0.99,
                evidence: Some("Shopify CDN assets detected".to_string()),
            });
        }

        if lower.contains("__next") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "Framework".to_string(),
                name: "Next.js".to_string(),
                version: None,
                confidence: 0.99,
                evidence: Some("__next hydration container found".to_string()),
            });
        }

        // Analytics
        if lower.contains("googletagmanager.com") || lower.contains("gtag(") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "Analytics".to_string(),
                name: "Google Analytics 4 / GTM".to_string(),
                version: None,
                confidence: 0.95,
                evidence: Some("gtag / Google Tag Manager script loaded".to_string()),
            });
        }

        // Booking & Reservations
        if lower.contains("opentable") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "Booking".to_string(),
                name: "OpenTable".to_string(),
                version: None,
                confidence: 0.95,
                evidence: Some("OpenTable widget detected".to_string()),
            });
        } else if lower.contains("sevenrooms") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "Booking".to_string(),
                name: "SevenRooms".to_string(),
                version: None,
                confidence: 0.97,
                evidence: Some("SevenRooms reservation script found".to_string()),
            });
        }

        techs
    }
}
