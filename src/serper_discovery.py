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
    "restaurant": [
        '"{city}" restaurant cafe official website reservations contact',
        '"{city}" catering company official website enquiry email',
    ],
    "healthcare": [
        '"{city}" multispeciality clinic hospital official website appointments contact',
        '"{city}" dental diagnostic centre official website contact email',
    ],
    "real-estate": [
        '"{city}" real estate developer builder official website enquiry',
        '"{city}" property consultants official website contact email',
    ],
    "wellness": [
        '"{city}" gym fitness studio yoga wellness spa official website contact',
        '"{city}" salon beauty clinic official website booking contact',
    ],
    "wedding": [
        '"{city}" wedding planner photographer official website enquiry email',
        '"{city}" event management company official website contact',
    ],
    "manufacturing": [
        '"{city}" manufacturer exporter company official website contact email',
        '"{city}" industrial engineering company official website enquiry',
    ],
    "logistics-travel": [
        '"{city}" travel agency tour operator official website contact email',
        '"{city}" logistics transport company official website enquiry',
    ],
    "startup-tech": [
        '"{city}" startup SaaS software company official website contact',
        '"{city}" IT services company small business website contact email',
    ],
    "automotive": [
        '"{city}" car dealership showroom service centre official website contact',
    ],
    "nonprofit": [
        '"{city}" NGO foundation trust official website donate contact email',
    ],
    "finance": [
        '"{city}" chartered accountant financial advisory firm official website contact',
    ],
}

# Plain-language noun used to build intent and social-profile queries per industry.
INDUSTRY_LABELS = {
    "education": "college", "training": "coaching institute", "events": "event venue",
    "hospitality": "hotel", "restaurant": "restaurant", "professional-services": "consulting firm",
    "creative": "design studio", "architecture": "architects", "retail": "boutique store",
    "healthcare": "clinic", "real-estate": "real estate", "wellness": "fitness studio",
    "wedding": "wedding planner", "manufacturing": "manufacturer", "logistics-travel": "travel agency",
    "startup-tech": "startup", "automotive": "car showroom", "nonprofit": "NGO",
    "finance": "chartered accountant", "other": "business",
}

# Google-search signals that a business has a visible website gap (strong, quotable observations).
INTENT_TEMPLATES = [
    '"{city}" {label} website "under construction" OR "coming soon" OR "under maintenance"',
]

# Public social profiles are only discovery hints: we read the website a profile publicly lists
# in its search snippet, then research that official site like any other candidate.
SOCIAL_TEMPLATES = [
    'site:instagram.com "{city}" {label} "www." OR ".in" OR ".com"',
    'site:threads.net "{city}" {label} "www." OR ".in" OR ".com"',
    'site:facebook.com "{city}" {label} "www." OR ".in" OR ".com"',
]
SOCIAL_HOSTS = ("instagram.com", "threads.net", "facebook.com", "x.com", "twitter.com", "linkedin.com", "reddit.com")
LINK_HUBS = ("linktr.ee", "bit.ly", "wa.me", "t.me", "whatsapp.com", "goo.gl", "forms.gle", "g.page", "maps.app.goo.gl")
URL_IN_TEXT = re.compile(r'(?:https?://)?((?:www\.)?[a-z0-9][a-z0-9-]{1,61}(?:\.[a-z0-9-]{2,24}){1,3})(?:/[^\s]*)?', re.I)

DEFAULT_CITIES = [
    "Bengaluru", "Mumbai", "Delhi NCR", "Hyderabad", "Pune", "Chennai", "Kolkata", "Ahmedabad",
    "Jaipur", "Kochi", "Coimbatore", "Chandigarh", "Lucknow", "Indore", "Nagpur", "Surat",
    "Goa", "Thiruvananthapuram", "Visakhapatnam", "Bhubaneswar", "Mysuru", "Vadodara",
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


def is_social_host(domain: str) -> bool:
    return any(domain == h or domain.endswith("." + h) for h in SOCIAL_HOSTS)


def bio_websites(item: Dict[str, Any]) -> List[str]:
    """Websites a public social profile lists in its own search title/snippet."""
    text = f"{item.get('title', '')} {item.get('snippet', '')}"
    found = []
    for match in URL_IN_TEXT.finditer(text):
        host = match.group(1).lower()
        if is_social_host(host) or any(host == h or host.endswith("." + h) for h in LINK_HUBS):
            continue
        if re.search(r'\.(?:jpg|png|gif|pdf|html?)$', host) or host in found:
            continue
        found.append(host)
    return found


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
            "google.com", "maps.google.com", "youtube.com",
            "wikipedia.org", "gov.in", "nic.in", "justdial.com", "indiamart.com",
            "tripadvisor.com", "booking.com", "shiksha.com", "collegedunia.com",
            "scribd.com", "thearchitectsdiary.com", "buildingandinteriors.com",
            "yellowpages.in", "sulekha.com",
        ])
        exclusions.update(SOCIAL_HOSTS)

        # Consecutive queries vary city first, then industry, so a few runs cover many niches.
        jobs = []
        max_templates = max(
            [len(SEARCH_TEMPLATES.get(i, SEARCH_TEMPLATES["other"])) for i in target_industries] or [0])
        for t in range(max_templates):
            for ind in target_industries:
                templates = SEARCH_TEMPLATES.get(ind, SEARCH_TEMPLATES["other"])
                if t < len(templates):
                    jobs.extend((city, ind, templates[t].format(city=city)) for city in target_cities)
        for template in INTENT_TEMPLATES + SOCIAL_TEMPLATES:
            for ind in target_industries:
                label = INDUSTRY_LABELS.get(ind, INDUSTRY_LABELS["other"])
                jobs.extend((city, ind, template.format(city=city, label=label)) for city in target_cities)

        if not jobs:
            return [], ["No valid search jobs match campaign criteria"]

        cursor = self.store.get("source:serper", {"cursor": 0}).get("cursor", 0)
        queries = max(1, int(os.getenv("SERPER_QUERIES_PER_HARVEST", "3")))
        discovered, errors, seen_cids = [], [], set()
        headers = {"X-API-KEY": self.api_key, "Content-Type": "application/json", "User-Agent": USER_AGENT}
        start_cursor = cursor

        for _ in range(queries):
            city, industry, query = jobs[cursor % len(jobs)]
            try:
                resp = requests.post("https://google.serper.dev/search", headers=headers, timeout=15,
                                     json={"q": query, "gl": "in", "hl": "en", "num": 10})
                if resp.status_code == 429:
                    errors.append("Serper search quota exhausted (HTTP 429)")
                    break
                resp.raise_for_status()
                items = resp.json().get("organic", [])
                batch = []
                for item in items:
                    link = item.get("link", "").strip()
                    if not link.startswith(("http://", "https://")):
                        continue
                    link_domain = extract_domain(link)
                    if link_domain and is_social_host(link_domain):
                        sites = bio_websites(item)[:1]
                        source = "Public social profile bio via Google Search"
                        raw_title = re.split(r'\s+(?:\(@|[•|·]\s)', item.get("title", ""))[0]
                    else:
                        sites, source, raw_title = [link_domain], "Google Search via Serper.dev", item.get("title", "")
                    for domain in sites:
                        if not domain or any(domain == exc or domain.endswith("." + exc) for exc in exclusions):
                            continue
                        root_url = canonical_url(f"https://{domain}")
                        cid = company_id(root_url)
                        if cid in seen_cids or self.store.get("prospect:" + cid):
                            continue
                        seen_cids.add(cid)
                        name = clean_title(raw_title, domain=domain) or domain
                        batch.append({
                            "company_id": cid, "name": name, "business": name, "website": root_url,
                            "industry": industry, "city": city, "source_url": link, "source": source,
                            "state": "DISCOVERED", "discovered_at": time.time(),
                        })
                if batch:
                    self.store.put_many_new({"prospect:" + c["company_id"]: c for c in batch})
                    discovered.extend(batch)
                cursor += 1  # checkpoint advances only after the query and its writes succeed
                self.store.put("source:serper", {
                    "cursor": cursor, "city": city, "industry": industry, "query": query,
                    "timestamp": time.time(),
                })
            except requests.exceptions.RequestException as exc:
                errors.append(f"Serper API request failed: {type(exc).__name__}")
                break
            except Exception as exc:
                errors.append(f"Serper parsing failed: {type(exc).__name__}")
                break

        self.store.put("source:last_result", {
            "source": "Serper Google Search",
            "new": len(discovered),
            "errors": errors,
            "partition": start_cursor,
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
