use chrono::Utc;
use domain::{EvidenceSignal, EvidenceStatus, Freshness, MatcherType, SignalMatcher, Technology};
use regex::Regex;
use uuid::Uuid;

pub struct TechDetector;

impl TechDetector {
    /// Evaluates generic SignalMatcher definitions against crawled page content
    /// Zero hardcoded industry/tech branching in the matching algorithm!
    pub fn evaluate_signals(
        business_id: Uuid,
        html: &str,
        website_url: Option<&str>,
        has_ssl: bool,
        matchers: &[SignalMatcher],
    ) -> (Vec<EvidenceSignal>, Vec<Technology>) {
        let mut evidence = Vec::new();
        let mut techs = Vec::new();
        let lower_html = html.to_lowercase();

        for matcher in matchers {
            let is_match = match matcher.matcher_type {
                MatcherType::TechFingerprint | MatcherType::ContentRegex => {
                    let patterns: Vec<&str> = matcher.pattern.split('|').collect();
                    patterns.iter().any(|pat| lower_html.contains(&pat.to_lowercase()))
                }
                MatcherType::UrlRoute => {
                    let routes: Vec<&str> = matcher.pattern.split('|').collect();
                    routes.iter().any(|route| lower_html.contains(route))
                }
                MatcherType::SslCheck => has_ssl,
                MatcherType::SchemaCheck => lower_html.contains("application/ld+json"),
                MatcherType::HtmlSelector => {
                    if let Ok(re) = Regex::new(&format!(r#"(?i)<[^>]*{}[^>]*>"#, matcher.pattern)) {
                        re.is_match(html)
                    } else {
                        lower_html.contains(&matcher.pattern.to_lowercase())
                    }
                }
                MatcherType::ContactPresence | MatcherType::MetricThreshold | MatcherType::ReputationCheck => {
                    false
                }
            };

            let status = if is_match {
                EvidenceStatus::Detected
            } else if !html.is_empty() {
                EvidenceStatus::NotDetected
            } else {
                EvidenceStatus::Unknown
            };

            evidence.push(EvidenceSignal {
                key: matcher.signal_key.clone(),
                label: matcher.label.clone(),
                status: status.clone(),
                details: Some(format!(
                    "Evaluated signal pattern '{}' via {:?}",
                    matcher.pattern, matcher.matcher_type
                )),
                confidence: matcher.confidence_weight,
                source: "dynamic_signal_extractor".to_string(),
                freshness: Freshness::Current,
                timestamp: Utc::now(),
            });

            if is_match && matcher.matcher_type == MatcherType::TechFingerprint {
                techs.push(Technology {
                    id: Uuid::new_v4(),
                    business_id,
                    category: "Detected Stack".to_string(),
                    name: matcher.label.clone(),
                    version: None,
                    confidence: matcher.confidence_weight,
                    evidence: Some(format!("Pattern '{}' matched on page", matcher.pattern)),
                });
            }
        }

        (evidence, techs)
    }

    /// Generic technology scanner for general web footprint analysis
    pub fn detect_technologies(business_id: Uuid, html: &str) -> Vec<Technology> {
        let generic_signatures = [
            ("WordPress", "CMS", "wp-content|wp-includes"),
            ("Shopify", "Ecommerce", "cdn.shopify.com|shopify.theme"),
            ("Next.js (React)", "Framework", "__next|/_next/"),
            ("Webflow", "CMS", "webflow.com|data-wf-page"),
            ("Wix", "CMS", "wix.com|wixsite.com"),
            ("Google Tag Manager", "Analytics", "googletagmanager.com|gtag("),
            ("Meta Pixel", "Marketing", "connect.facebook.net|fbq("),
            ("WhatsApp Chat", "Messaging", "wa.me|api.whatsapp.com|whatsapp"),
            ("HubSpot", "CRM", "hs-scripts.com|hubspot"),
            ("Salesforce", "CRM", "force.com|salesforce"),
            ("Calendly", "Scheduling", "calendly.com"),
            ("Intercom", "Live Chat", "intercom.io|widget.intercom.io"),
            ("Schema.org JSON-LD", "SEO", "application/ld+json"),
        ];

        let mut techs = Vec::new();
        let lower = html.to_lowercase();

        for (name, cat, patterns) in &generic_signatures {
            let pats: Vec<&str> = patterns.split('|').collect();
            if pats.iter().any(|p| lower.contains(p)) {
                techs.push(Technology {
                    id: Uuid::new_v4(),
                    business_id,
                    category: cat.to_string(),
                    name: name.to_string(),
                    version: None,
                    confidence: 0.98,
                    evidence: Some(format!("Matched pattern '{}'", patterns)),
                });
            }
        }

        techs
    }
}
