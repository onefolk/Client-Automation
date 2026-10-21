"""Multi-industry prospect discovery engine using public directories and curated seeds."""

import csv
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin
from bs4 import BeautifulSoup

from src.config import CONFIG_DIR, MAX_DIRECTORY_LINKS, get_active_campaign
from src.network import SafeFetcher, canonical_url, extract_domain, is_safe_url

logger = logging.getLogger(__name__)

# Social networks and major utility domains to exclude from discovery
GLOBAL_DIRECTORY_EXCLUSIONS = {
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "youtube.com",
    "twitter.com",
    "x.com",
    "pinterest.com",
    "google.com",
    "maps.google.com",
    "wikipedia.org",
    "gov.in",
    "nic.in",
}


def read_csv_file(filename: str) -> List[Dict[str, str]]:
    """Reads a CSV file from the config directory safely."""
    path = CONFIG_DIR / filename
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


class DiscoveryEngine:
    """Discovers multi-industry candidate businesses from seeds and directories."""

    def __init__(self, campaign_config: Optional[Dict[str, Any]] = None):
        self.campaign = campaign_config or get_active_campaign()
        self.target_industries = set(self.campaign.get("industries", []))
        self.target_cities = [c.lower() for c in self.campaign.get("target_cities", [])]
        self.keywords = [k.lower() for k in self.campaign.get("keywords", [])]
        self.exclusions = set(self.campaign.get("exclusions", [])).union(GLOBAL_DIRECTORY_EXCLUSIONS)
        self.max_directory_links = MAX_DIRECTORY_LINKS

    def matches_campaign(self, lead: Dict[str, Any]) -> bool:
        """Determines if a candidate matches the active campaign criteria."""
        industry = (lead.get("industry") or "other").strip().lower()
        if self.target_industries and industry not in self.target_industries:
            return False

        website = lead.get("website", "")
        host = extract_domain(website)
        if any(exc in host for exc in self.exclusions):
            return False

        city = (lead.get("city") or "").strip().lower()
        if self.target_cities and city:
            if not any(tc in city for tc in self.target_cities):
                return False

        # Keyword filtering on name/notes if keywords are defined
        name = lead.get("name", "").lower()
        if self.keywords:
            # Match if keyword in name or if industry matches
            has_kw = any(kw in name for kw in self.keywords)
            has_ind = industry in self.target_industries
            if not (has_kw or has_ind):
                return False

        return True

    def harvest_candidates(self, fetcher: SafeFetcher) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """Harvests candidates from seeds and directories with an audit summary."""
        candidates_by_domain: Dict[str, Dict[str, Any]] = {}
        seeds_found = 0
        directories_found = 0

        # 1. Harvest from curated seeds
        seed_rows = read_csv_file("seeds.csv")
        for row in seed_rows:
            raw_url = row.get("website", "").strip()
            c_url = canonical_url(raw_url)
            host = extract_domain(c_url)
            if not host or not is_safe_url(c_url):
                continue

            lead = {
                "name": row.get("name", "").strip() or host,
                "website": c_url,
                "industry": (row.get("industry") or "other").strip().lower(),
                "city": row.get("city", "").strip(),
                "source_url": row.get("source_url", "").strip() or c_url,
                "discovery_type": "seed",
            }
            if self.matches_campaign(lead):
                candidates_by_domain[host] = lead
                seeds_found += 1

        # 2. Harvest from public directories
        dir_rows = read_csv_file("directories.csv")
        links_followed = 0

        for row in dir_rows:
            dir_url = row.get("directory_url", "").strip()
            dir_industry = (row.get("industry") or "other").strip().lower()
            if not is_safe_url(dir_url):
                continue

            html = fetcher.fetch_html(dir_url)
            if not html:
                continue

            dir_host = extract_domain(dir_url)
            soup = BeautifulSoup(html, "html.parser")

            for a in soup.select("a[href]"):
                if links_followed >= self.max_directory_links:
                    break

                href = a.get("href", "").strip()
                full_url = canonical_url(urljoin(dir_url, href))
                host = extract_domain(full_url)

                if not host or host == dir_host or not is_safe_url(full_url):
                    continue

                if any(exc in host for exc in self.exclusions):
                    continue

                title = a.get_text(" ", strip=True)[:100] or host
                lead = {
                    "name": title,
                    "website": f"https://{host}/",
                    "industry": dir_industry,
                    "city": "",
                    "source_url": dir_url,
                    "discovery_type": "directory",
                }

                if host not in candidates_by_domain and self.matches_campaign(lead):
                    candidates_by_domain[host] = lead
                    directories_found += 1
                    links_followed += 1

        results = list(candidates_by_domain.values())
        report = {
            "total_harvested": len(results),
            "seeds_matched": seeds_found,
            "directories_matched": directories_found,
            "target_lead_count": self.campaign.get("target_lead_count", 100),
            "is_shortage": len(results) < self.campaign.get("target_lead_count", 100),
        }

        if report["is_shortage"]:
            logger.info(
                "Discovery shortage: Harvested %d valid leads (target: %d). No leads were fabricated.",
                len(results),
                report["target_lead_count"],
            )

        return results, report
