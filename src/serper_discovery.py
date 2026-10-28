"""Serper.dev Google Search API discovery engine for verified B2B prospects."""
import csv
import logging
import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple
import requests

from src.config import CONFIG_DIR, USER_AGENT
from src.network import canonical_url, extract_domain
from src.open_discovery import company_id

logger = logging.getLogger(__name__)

SEARCH_TEMPLATES = {
    "education": [
        '"{city}" college admissions contact',
        '"{city}" institute higher education admissions email',
        '"{city}" university admissions portal',
    ],
    "architecture": [
        '"{city}" architecture firm contact email',
        '"{city}" interior design studio official website',
        '"{city}" architects portfolio contact',
    ],
    "hospitality": [
        '"{city}" resort booking reservations contact email',
        '"{city}" boutique hotel official website reservations',
    ],
    "events": [
        '"{city}" event venue conference centre booking contact',
        '"{city}" convention center booking inquiry email',
    ],
    "retail": [
        '"{city}" boutique designer brand flagship store contact',
        '"{city}" luxury apparel official online store',
    ],
    "professional-services": [
        '"{city}" corporate advisory consulting firm contact email',
        '"{city}" law firm corporate legal practice contact',
    ],
    "creative": [
        '"{city}" creative agency digital branding studio contact',
        '"{city}" design studio portfolio contact email',
    ],
    "training": [
        '"{city}" training academy institute admissions contact',
    ],
    "other": [
        '"{city}" commercial enterprise services contact official website',
    ],
}

DEFAULT_CITIES = [
    "Bengaluru",
    "Mumbai",
    "Delhi NCR",
    "Hyderabad",
    "Pune",
    "Chennai",
    "Kolkata",
    "Ahmedabad",
]

GENERIC_TITLES = {"contact us", "contact", "about us", "admissions", "home", "official website", "welcome"}


def clean_title(raw_title: str, domain: str = "") -> str:
    """Extracts a clean business name from a web search result title."""
    if not raw_title:
        raw_title = ""
    # Strip common suffixes like " - Official Website", "| Contact Us", etc.
    title = re.sub(
        r'\s*(?:[-–|:]\s*(?:Home|Official Website|Contact Us|About Us|Admissions|Welcome to|Online|Architecture Firm|Architects|Design Studio).*$)',
        '',
        raw_title,
        flags=re.IGNORECASE,
    ).strip()
    # Strip leading prefixes like "Welcome to ", "Contact Us - ", etc.
    title = re.sub(
        r'^(?:Welcome to\s+|Home\s*[-–|:]\s*|(?:Contact(?:\s+Us)?|Admissions|About(?:\s+Us)?)\s*[-–|:]\s*)',
        '',
        title,
        flags=re.IGNORECASE,
    ).strip()

    if not title or title.lower() in GENERIC_TITLES or len(title) < 3:
        if domain:
            base = domain.split('.')[0].replace('-', ' ').title()
            return base
        return title[:80] if title else ""

    return title[:80]


class SerperDiscovery:
    """Discovers active businesses using Serper.dev Google Search API."""

    def __init__(self, store, campaign_cfg: Optional[Dict[str, Any]] = None):
        self.store = store
        self.campaign = campaign_cfg or {}
        self.api_key = os.getenv("SERPER_API_KEY", "").strip()

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def harvest(self) -> Tuple[List[Dict[str, Any]], List[str]]:
        """Harvests candidates via Serper Google Search API.

        Returns (discovered_records, error_messages).
        """
        if not self.is_configured():
            return [], ["Serper API key not configured (SERPER_API_KEY missing)"]

        target_cities = self.campaign.get("target_cities") or DEFAULT_CITIES
        target_industries = self.campaign.get("industries") or list(SEARCH_TEMPLATES.keys())
        exclusions = set(self.campaign.get("exclusions", []))
        exclusions.update([
            "google.com", "maps.google.com", "facebook.com", "instagram.com",
            "linkedin.com", "youtube.com", "twitter.com", "x.com",
            "wikipedia.org", "gov.in", "nic.in", "justdial.com", "indiamart.com",
            "tripadvisor.com", "booking.com", "shiksha.com", "collegedunia.com",
            "scribd.com", "thearchitectsdiary.com", "buildingandinteriors.com",
            "yellowpages.in", "sulekha.com",
        ])

        jobs = []
        for city in target_cities:
            for ind in target_industries:
                templates = SEARCH_TEMPLATES.get(ind, SEARCH_TEMPLATES["other"])
                for tmpl in templates:
                    q = tmpl.format(city=city)
                    jobs.append((city, ind, q))

        if not jobs:
            return [], ["No valid search jobs match campaign criteria"]

        cursor_info = self.store.get("source:serper", {"cursor": 0})
        cursor = cursor_info.get("cursor", 0)
        city, industry, query = jobs[cursor % len(jobs)]

        discovered, errors = [], []
        endpoint = "https://google.serper.dev/search"
        headers = {
            "X-API-KEY": self.api_key,
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        }
        payload = {
            "q": query,
            "gl": "in",
            "hl": "en",
            "num": 10,
        }

        try:
            resp = requests.post(
                endpoint,
                headers=headers,
                json=payload,
                timeout=15,
            )
            if resp.status_code == 429:
                errors.append("Serper search quota exhausted (HTTP 429)")
                return [], errors

            resp.raise_for_status()
            data = resp.json()

            items = data.get("organic", [])
            seen_cids = set()
            for item in items:
                link = item.get("link", "").strip()
                if not link.startswith(("http://", "https://")):
                    continue

                domain = extract_domain(link)
                if not domain or any(domain == exc or domain.endswith("." + exc) for exc in exclusions):
                    continue

                root_url = canonical_url(f"https://{domain}")
                cid = company_id(root_url)
                if cid in seen_cids or self.store.get("prospect:" + cid):
                    continue
                seen_cids.add(cid)

                name = clean_title(item.get("title", ""), domain=domain) or domain
                candidate = {
                    "company_id": cid,
                    "name": name,
                    "business": name,
                    "website": root_url,
                    "industry": industry,
                    "city": city,
                    "source_url": link,
                    "source": "Google Search via Serper.dev",
                    "state": "DISCOVERED",
                    "discovered_at": time.time(),
                }
                discovered.append(candidate)

            if discovered:
                self.store.put_many_new({"prospect:" + c["company_id"]: c for c in discovered})

            # Advance cursor checkpoint
            self.store.put("source:serper", {
                "cursor": cursor + 1,
                "city": city,
                "industry": industry,
                "query": query,
                "timestamp": time.time(),
            })

        except requests.exceptions.RequestException as exc:
            errors.append(f"Serper API request failed: {type(exc).__name__}")
        except Exception as exc:
            errors.append(f"Serper parsing failed: {type(exc).__name__}")

        self.store.put("source:last_result", {
            "source": "Serper Google Search",
            "new": len(discovered),
            "errors": errors,
            "partition": cursor,
            "timestamp": time.time(),
        })

        return discovered, errors


class SeedDiscovery:
    """Draws unseeded targets from config/seeds.csv."""

    def __init__(self, store, campaign_cfg: Optional[Dict[str, Any]] = None):
        self.store = store
        self.campaign = campaign_cfg or {}

    def harvest(self, batch_size: int = 10) -> Tuple[List[Dict[str, Any]], List[str]]:
        path = CONFIG_DIR / "seeds.csv"
        if not path.exists():
            return [], []

        try:
            with path.open(encoding="utf-8") as f:
                seeds = list(csv.DictReader(f))
        except Exception as e:
            return [], [f"Failed to read seeds.csv: {e}"]

        discovered = []
        exclusions = set(self.campaign.get("exclusions", []))
        for row in seeds:
            if len(discovered) >= batch_size:
                break
            raw_url = row.get("website", "").strip()
            if not raw_url.startswith(("http://", "https://")):
                continue
            c_url = canonical_url(raw_url)
            domain = extract_domain(c_url)
            if not domain or any(domain == exc or domain.endswith("." + exc) for exc in exclusions):
                continue

            cid = company_id(c_url)
            if self.store.get("prospect:" + cid):
                continue

            candidate = {
                "company_id": cid,
                "name": row.get("name", "").strip() or domain,
                "business": row.get("name", "").strip() or domain,
                "website": c_url,
                "industry": (row.get("industry") or "other").strip().lower(),
                "city": row.get("city", "").strip(),
                "source_url": row.get("source_url", "").strip() or c_url,
                "source": "Curated Institutional Seeds (seeds.csv)",
                "state": "DISCOVERED",
                "discovered_at": time.time(),
            }
            discovered.append(candidate)

        if discovered:
            self.store.put_many_new({"prospect:" + c["company_id"]: c for c in discovered})

        return discovered, []
