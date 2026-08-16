use reqwest::Client;
use scraper::{Html, Selector};
use std::time::Duration;
use thiserror::Error;
use url::Url;

#[derive(Error, Debug)]
pub enum CrawlerError {
    #[error("Invalid or blocked URL: {0}")]
    InvalidUrl(String),
    #[error("SSRF Protection triggered: blocked private IP range {0}")]
    BlockedSsrf(String),
    #[error("HTTP request failed: {0}")]
    HttpError(#[from] reqwest::Error),
    #[error("Timeout during crawl")]
    Timeout,
}

pub struct CrawledPage {
    pub url: String,
    pub status_code: u16,
    pub title: Option<String>,
    pub meta_description: Option<String>,
    pub links: Vec<String>,
    pub raw_html: String,
}

pub struct HttpCrawler {
    client: Client,
}

impl HttpCrawler {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .user_agent("OneFolkClientBot/1.0 (+https://onefolk.ai/bot)")
            .build()
            .unwrap_or_default();

        Self { client }
    }

    /// Validates URL and prevents SSRF to localhost or private subnets
    pub fn validate_url_safety(target_url: &str) -> Result<Url, CrawlerError> {
        let parsed = Url::parse(target_url).map_err(|_| CrawlerError::InvalidUrl(target_url.to_string()))?;

        if let Some(host) = parsed.host_str() {
            let lower = host.to_lowercase();
            if lower == "localhost"
                || lower == "127.0.0.1"
                || lower == "0.0.0.0"
                || lower.starts_with("192.168.")
                || lower.starts_with("10.")
                || lower.starts_with("172.16.")
            {
                return Err(CrawlerError::BlockedSsrf(lower));
            }
        } else {
            return Err(CrawlerError::InvalidUrl(target_url.to_string()));
        }

        Ok(parsed)
    }

    pub async fn fetch_page(&self, target_url: &str) -> Result<CrawledPage, CrawlerError> {
        let validated_url = Self::validate_url_safety(target_url)?;
        let resp = self.client.get(validated_url.as_str()).send().await?;
        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();

        let document = Html::parse_document(&body);
        let title = {
            let selector = Selector::parse("title").ok();
            selector.and_then(|sel| {
                document
                    .select(&sel)
                    .next()
                    .map(|el| el.text().collect::<Vec<_>>().join(" ").trim().to_string())
            })
        };

        let meta_description = {
            let selector = Selector::parse("meta[name='description']").ok();
            selector.and_then(|sel| {
                document
                    .select(&sel)
                    .next()
                    .and_then(|el| el.value().attr("content").map(|s| s.trim().to_string()))
            })
        };

        Ok(CrawledPage {
            url: target_url.to_string(),
            status_code: status,
            title,
            meta_description,
            links: vec![],
            raw_html: body,
        })
    }
}

impl Default for HttpCrawler {
    fn default() -> Self {
        Self::new()
    }
}
