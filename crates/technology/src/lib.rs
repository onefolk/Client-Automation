use domain::Technology;
use uuid::Uuid;

pub struct TechDetector;

impl TechDetector {
    pub fn detect_technologies(business_id: Uuid, html: &str) -> Vec<Technology> {
        let mut techs = Vec::new();
        let lower = html.to_lowercase();

        // 1. ERP, Educational Portals & LMS
        if lower.contains("powerschool.com") || lower.contains("powerschool") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "ERP".to_string(),
                name: "PowerSchool SIS/ERP".to_string(),
                version: None,
                confidence: 0.99,
                evidence: Some("PowerSchool SIS scripts and portal routes detected".to_string()),
            });
        }
        if lower.contains("instructure.com") || lower.contains("canvas-lms") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "LMS".to_string(),
                name: "Canvas LMS".to_string(),
                version: None,
                confidence: 0.99,
                evidence: Some("Canvas Instructure LMS assets identified".to_string()),
            });
        }
        if lower.contains("blackboard.com") || lower.contains("/webapps/login") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "LMS".to_string(),
                name: "Blackboard Learn".to_string(),
                version: None,
                confidence: 0.99,
                evidence: Some("Blackboard LMS endpoints detected".to_string()),
            });
        }
        if lower.contains("moodle") || lower.contains("theme/moodle") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "LMS".to_string(),
                name: "Moodle".to_string(),
                version: None,
                confidence: 0.98,
                evidence: Some("Moodle learning management directory found".to_string()),
            });
        }
        if lower.contains("odoo") || lower.contains("web/static/src") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "ERP".to_string(),
                name: "Odoo ERP".to_string(),
                version: None,
                confidence: 0.98,
                evidence: Some("Odoo ERP framework assets detected".to_string()),
            });
        }
        if lower.contains("sap.com") || lower.contains("/irj/portal") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "ERP".to_string(),
                name: "SAP Enterprise ERP".to_string(),
                version: None,
                confidence: 0.97,
                evidence: Some("SAP NetWeaver / ERP portal link detected".to_string()),
            });
        }
        if lower.contains("oraclecloud.com") || lower.contains("peoplesoft") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "ERP".to_string(),
                name: "Oracle / PeopleSoft ERP".to_string(),
                version: None,
                confidence: 0.97,
                evidence: Some("Oracle Cloud / PeopleSoft integration detected".to_string()),
            });
        }
        if lower.contains("/portal") || lower.contains("parent portal") || lower.contains("student portal") || lower.contains("client portal") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "Portal".to_string(),
                name: "Dedicated Client/Student Portal".to_string(),
                version: None,
                confidence: 0.95,
                evidence: Some("Active login portal navigation link found".to_string()),
            });
        }

        // 2. CRM & Lead Capture
        if lower.contains("js.hs-scripts.com") || lower.contains("hubspot") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "CRM".to_string(),
                name: "HubSpot CRM & Marketing".to_string(),
                version: None,
                confidence: 0.99,
                evidence: Some("HubSpot tracking snippet loaded".to_string()),
            });
        }
        if lower.contains("salesforce") || lower.contains("force.com") || lower.contains("pardot") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "CRM".to_string(),
                name: "Salesforce CRM".to_string(),
                version: None,
                confidence: 0.98,
                evidence: Some("Salesforce / Pardot script detected".to_string()),
            });
        }
        if lower.contains("zoho.com/crm") || lower.contains("zohocrm") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "CRM".to_string(),
                name: "Zoho CRM".to_string(),
                version: None,
                confidence: 0.98,
                evidence: Some("Zoho CRM web form or tracker found".to_string()),
            });
        }
        if lower.contains("typeform.com") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "Lead Capture".to_string(),
                name: "Typeform Interactive Funnel".to_string(),
                version: None,
                confidence: 0.99,
                evidence: Some("Typeform interactive embed detected".to_string()),
            });
        }
        if lower.contains("jotform.com") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "Lead Capture".to_string(),
                name: "Jotform".to_string(),
                version: None,
                confidence: 0.99,
                evidence: Some("Jotform form handler detected".to_string()),
            });
        }

        // 3. CMS & Website Frameworks
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

        // 4. Analytics & UX Tracking
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

        // 5. Booking, Scheduling & Appointments
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
        if lower.contains("acuityscheduling.com") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "Scheduling".to_string(),
                name: "Acuity Scheduling".to_string(),
                version: None,
                confidence: 0.98,
                evidence: Some("Acuity appointment scheduler detected".to_string()),
            });
        }
        if lower.contains("fresha.com") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "Booking".to_string(),
                name: "Fresha".to_string(),
                version: None,
                confidence: 0.99,
                evidence: Some("Fresha salon/clinic booking widget loaded".to_string()),
            });
        }
        if lower.contains("mindbodyonline.com") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "Booking".to_string(),
                name: "Mindbody".to_string(),
                version: None,
                confidence: 0.99,
                evidence: Some("Mindbody fitness/wellness booking detected".to_string()),
            });
        }

        // 6. Instant Messaging, Chat & Automation
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
        if lower.contains("intercom.io") || lower.contains("widget.intercom.io") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "Live Chat".to_string(),
                name: "Intercom Messenger".to_string(),
                version: None,
                confidence: 0.99,
                evidence: Some("Intercom customer messaging widget active".to_string()),
            });
        }
        if lower.contains("tidio.co") || lower.contains("code.tidio.co") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "Live Chat".to_string(),
                name: "Tidio AI Chatbot".to_string(),
                version: None,
                confidence: 0.99,
                evidence: Some("Tidio live chat widget active".to_string()),
            });
        }

        // 7. SEO & Schema Data
        if lower.contains("application/ld+json") {
            techs.push(Technology {
                id: Uuid::new_v4(),
                business_id,
                category: "SEO".to_string(),
                name: "Schema.org Structured Data".to_string(),
                version: None,
                confidence: 0.95,
                evidence: Some("JSON-LD semantic rich schema detected".to_string()),
            });
        }

        techs
    }
}

