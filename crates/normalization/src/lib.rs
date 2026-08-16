use regex::Regex;
use url::Url;

pub struct Normalizer;

impl Normalizer {
    /// Normalize business name by stripping international legal entity suffixes and location noise
    pub fn normalize_business_name(name: &str) -> String {
        let mut cleaned = name.to_lowercase().trim().to_string();

        let legal_suffixes = [
            " fz-llc", " fzco", " fze", " dmcc", " llc", " l.l.c.", " ltd", " ltd.",
            " limited", " inc", " inc.", " incorporated", " corp", " corporation",
            " co.", " company", " group", " gmbh", " ag", " sas", " sarl", " bv",
            " spa", " s.p.a.", " pty ltd", " pty", " plc", " llp", " dxb", " dubai",
            " uae", " restaurant", " cafe", " lounge", " bar",
        ];

        for suffix in legal_suffixes {
            if cleaned.ends_with(suffix) {
                cleaned = cleaned[..cleaned.len() - suffix.len()].trim().to_string();
            }
        }

        // Replace all non-alphanumeric chars with space
        let re = Regex::new(r"[^a-z0-9\s]").unwrap();
        let stripped = re.replace_all(&cleaned, " ");
        let space_re = Regex::new(r"\s+").unwrap();
        space_re.replace_all(&stripped, " ").trim().to_string()
    }

    /// Create URL-safe deterministic slug
    pub fn slugify(name: &str) -> String {
        let normalized = Self::normalize_business_name(name);
        normalized.replace(' ', "-")
    }

    /// Normalize website URL to standard https without query params, trailing slashes or tracking
    pub fn normalize_url(raw_url: &str) -> Option<String> {
        let mut trimmed = raw_url.trim().to_string();
        if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
            trimmed = format!("https://{}", trimmed);
        }

        if let Ok(mut parsed) = Url::parse(&trimmed) {
            parsed.set_query(None);
            parsed.set_fragment(None);
            let mut s = parsed.to_string();
            if s.ends_with('/') {
                s.pop();
            }
            Some(s)
        } else {
            None
        }
    }

    /// Extract root domain without www
    pub fn extract_domain(raw_url: &str) -> Option<String> {
        let normalized = Self::normalize_url(raw_url)?;
        if let Ok(parsed) = Url::parse(&normalized) {
            if let Some(host) = parsed.host_str() {
                let lower = host.to_lowercase();
                let without_www = lower.strip_prefix("www.").unwrap_or(&lower);
                return Some(without_www.to_string());
            }
        }
        None
    }

    /// Normalize phone number to standardized international digits (E.164-compatible)
    pub fn normalize_phone(raw_phone: &str) -> String {
        let mut digits = String::new();
        for (i, c) in raw_phone.chars().enumerate() {
            if i == 0 && c == '+' {
                digits.push('+');
            } else if c.is_ascii_digit() {
                digits.push(c);
            }
        }
        digits
    }

    /// Normalize social handle from profile URL
    pub fn normalize_social_handle(profile_url: &str) -> Option<String> {
        let re = Regex::new(r"(?:instagram\.com|facebook\.com|tiktok\.com|linkedin\.com/company)/([a-zA-Z0-9_.-]+)").unwrap();
        if let Some(cap) = re.captures(profile_url) {
            let handle = cap.get(1)?.as_str().trim_matches('/');
            return Some(format!("@{}", handle.to_lowercase()));
        }
        None
    }
}
