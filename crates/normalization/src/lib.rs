use regex::Regex;
use url::Url;

pub struct Normalizer;

impl Normalizer {
    /// Normalize business name by stripping legal suffixes (LLC, Inc, Ltd, etc.) and punctuation
    pub fn normalize_business_name(name: &str) -> String {
        let cleaned = name.to_lowercase();
        let legal_suffixes = [
            " llc", " l.l.c.", " inc", " inc.", " ltd", " ltd.", " co.", " company",
            " group", " corp", " fzco", " fze", " dxb", " dubai", " uae",
        ];

        let mut res = cleaned;
        for suffix in legal_suffixes {
            if res.ends_with(suffix) {
                res = res[..res.len() - suffix.len()].to_string();
            }
        }

        // Replace non-alphanumeric with single space
        let re = Regex::new(r"[^a-z0-9\s]").unwrap();
        let stripped = re.replace_all(&res, " ");
        let space_re = Regex::new(r"\s+").unwrap();
        space_re.replace_all(&stripped, " ").trim().to_string()
    }

    /// Create URL-friendly slug
    pub fn slugify(name: &str) -> String {
        let normalized = Self::normalize_business_name(name);
        normalized.replace(' ', "-")
    }

    /// Normalize website URL to standard https without trailing slash or tracking parameters
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

    /// Extract clean domain hostname (e.g. "example.com" from "https://www.example.com/path")
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

    /// Normalize phone number to standardized digits with optional +
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
}
