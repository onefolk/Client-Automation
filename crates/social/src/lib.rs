use chrono::Utc;
use domain::SocialProfile;
use regex::Regex;
use uuid::Uuid;

pub struct SocialDiscovery;

impl SocialDiscovery {
    pub fn extract_from_html(
        business_id: Uuid,
        html: &str,
        source_url: &str,
    ) -> Vec<SocialProfile> {
        let mut profiles = Vec::new();

        let patterns = [
            ("instagram", r#"https?://(?:www\.)?instagram\.com/([a-zA-Z0-9_.]+)"#),
            ("threads", r#"https?://(?:www\.)?threads\.net/@([a-zA-Z0-9_.]+)"#),
            ("reddit", r#"https?://(?:www\.)?reddit\.com/(?:r|user)/([a-zA-Z0-9_]+)"#),
            ("facebook", r#"https?://(?:www\.)?facebook\.com/([a-zA-Z0-9_.]+)"#),
            ("linkedin", r#"https?://(?:www\.)?linkedin\.com/(?:company|in)/([a-zA-Z0-9_-]+)"#),
            ("tiktok", r#"https?://(?:www\.)?tiktok\.com/@([a-zA-Z0-9_.]+)"#),
            ("youtube", r#"https?://(?:www\.)?youtube\.com/(?:c/|@|user/)?([a-zA-Z0-9_-]+)"#),
            ("x_twitter", r#"https?://(?:www\.)?(?:twitter\.com|x\.com)/([a-zA-Z0-9_]+)"#),
        ];

        for (platform, pat) in patterns {
            if let Ok(re) = Regex::new(pat) {
                if let Some(cap) = re.captures(html) {
                    let url = cap.get(0).map(|m| m.as_str().to_string()).unwrap_or_default();
                    let handle = cap.get(1).map(|m| m.as_str().to_string());

                    profiles.push(SocialProfile {
                        id: Uuid::new_v4(),
                        business_id,
                        platform: platform.to_string(),
                        url,
                        handle,
                        follower_count: None,
                        post_count: None,
                        is_active: true,
                        last_posted_at: None,
                        bio: None,
                        source_url: Some(source_url.to_string()),
                    });
                }
            }
        }

        profiles
    }
}
