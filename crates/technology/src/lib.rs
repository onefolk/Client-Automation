use domain::Technology;
use uuid::Uuid;

pub struct TechDetector;

impl TechDetector {
    pub fn detect_technologies(business_id: Uuid, html: &str) -> Vec<Technology> {
        let mut techs = Vec::new();
        let lower = html.to_lowercase();

        // 1. CMS & Website Builders
        if lower.contains("wp-content") || lower.contains("wp-includes") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "CMS".to_string(),
                name: "WordPress".to_string(),
                version: None,
                confidence: 0.99,
                evidence: Some("wp-content directory structure detected".to_string()),
            });
        }
        if lower.contains("cdn.shopify.com") || lower.contains("shopify.theme") {
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
        if lower.contains("webflow.com") || lower.contains("w-nav") || lower.contains("data-wf-page") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "CMS".to_string(),
                name: "Webflow".to_string(),
                version: None,
                confidence: 0.99,
                evidence: Some("Webflow engine tags found".to_string()),
            });
        }
        if lower.contains("wix.com") || lower.contains("wixsite.com") || lower.contains("santa-editor") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "CMS".to_string(),
                name: "Wix".to_string(),
                version: None,
                confidence: 0.99,
                evidence: Some("Wix platform scripts detected".to_string()),
            });
        }
        if lower.contains("squarespace") || lower.contains("static1.squarespace.com") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "CMS".to_string(),
                name: "Squarespace".to_string(),
                version: None,
                confidence: 0.99,
                evidence: Some("Squarespace core scripts detected".to_string()),
            });
        }
        if lower.contains("__next") || lower.contains("/_next/") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "Framework".to_string(),
                name: "Next.js (React)".to_string(),
                version: None,
                confidence: 0.99,
                evidence: Some("__next hydration container found".to_string()),
            });
        }

        // 2. Analytics & Marketing Pixels
        if lower.contains("googletagmanager.com") || lower.contains("gtag(") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "Analytics".to_string(),
                name: "Google Tag Manager / GA4".to_string(),
                version: None,
                confidence: 0.98,
                evidence: Some("GTM/GA4 tracking snippet loaded".to_string()),
            });
        }
        if lower.contains("connect.facebook.net") || lower.contains("fbq(") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "Marketing".to_string(),
                name: "Meta Pixel".to_string(),
                version: None,
                confidence: 0.98,
                evidence: Some("Facebook / Meta Pixel loaded".to_string()),
            });
        }
        if lower.contains("hotjar.com") || lower.contains("static.hotjar.com") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "UX Analytics".to_string(),
                name: "Hotjar".to_string(),
                version: None,
                confidence: 0.98,
                evidence: Some("Hotjar session recording tag loaded".to_string()),
            });
        }
        if lower.contains("clarity.ms") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "UX Analytics".to_string(),
                name: "Microsoft Clarity".to_string(),
                version: None,
                confidence: 0.98,
                evidence: Some("Microsoft Clarity script loaded".to_string()),
            });
        }

        // 3. Booking, Reservation & POS
        if lower.contains("opentable.com") || lower.contains("ot-widget") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "Booking".to_string(),
                name: "OpenTable".to_string(),
                version: None,
                confidence: 0.98,
                evidence: Some("OpenTable widget detected".to_string()),
            });
        }
        if lower.contains("sevenrooms.com") || lower.contains("sr-widget") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "Booking".to_string(),
                name: "SevenRooms".to_string(),
                version: None,
                confidence: 0.98,
                evidence: Some("SevenRooms reservation script found".to_string()),
            });
        }
        if lower.contains("resy.com") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "Booking".to_string(),
                name: "Resy".to_string(),
                version: None,
                confidence: 0.98,
                evidence: Some("Resy booking integration found".to_string()),
            });
        }
        if lower.contains("calendly.com") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "Scheduling".to_string(),
                name: "Calendly".to_string(),
                version: None,
                confidence: 0.98,
                evidence: Some("Calendly booking widget loaded".to_string()),
            });
        }

        // 4. Live Chat & Instant Messaging
        if lower.contains("wa.me") || lower.contains("api.whatsapp.com") || lower.contains("whatsapp") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "Messaging".to_string(),
                name: "WhatsApp Direct Chat".to_string(),
                version: None,
                confidence: 0.99,
                evidence: Some("WhatsApp wa.me click-to-chat link active".to_string()),
            });
        }

        techs
    }
}
