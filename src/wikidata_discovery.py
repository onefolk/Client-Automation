"""Bulk discovery of Indian education institutions from Wikidata (CC0).

Wikidata is a discovery hint only: it supplies a name and an official website.
Contact emails, observations and qualification still come from the official-site
research, exactly like every other source.
"""
import time
from typing import Any, Dict, List, Optional, Tuple
import requests

from src.config import USER_AGENT
from src.network import canonical_url, extract_domain
from src.open_discovery import company_id

ENDPOINT = "https://query.wikidata.org/sparql"
PAGE_SIZE = 300
BATCH_SIZE = 40
EXCLUDED_DOMAINS = (
    "gov.in", "nic.in", "wikipedia.org", "facebook.com", "instagram.com",
    "linkedin.com", "youtube.com", "twitter.com", "x.com", "blogspot.com", "wordpress.com",
)
QUERY = """SELECT ?i ?iLabel ?site WHERE {
  VALUES ?c { wd:Q3918 wd:Q189004 }
  ?i wdt:P31 ?c; wdt:P17 wd:Q668; wdt:P856 ?site.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT %d OFFSET %d"""


class WikidataDiscovery:
    def __init__(self, store, campaign_cfg: Optional[Dict[str, Any]] = None):
        self.store = store
        self.campaign = campaign_cfg or {}

    def is_enabled(self) -> bool:
        industries = self.campaign.get("industries")
        return not industries or "education" in industries

    def harvest(self) -> Tuple[List[Dict[str, Any]], List[str]]:
        if not self.is_enabled():
            return [], []
        exclusions = set(EXCLUDED_DOMAINS) | set(self.campaign.get("exclusions", []))
        cursor = int(self.store.get("source:wikidata", {"cursor": 0}).get("cursor", 0))
        try:
            resp = requests.get(
                ENDPOINT, params={"query": QUERY % (PAGE_SIZE, cursor), "format": "json"},
                headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"},
                timeout=40)
            resp.raise_for_status()
            rows = resp.json()["results"]["bindings"]
        except (requests.RequestException, KeyError, ValueError) as exc:
            return [], ["Wikidata source unavailable: " + type(exc).__name__]

        discovered, seen = [], set()
        for row in rows:
            site = row.get("site", {}).get("value", "").strip()
            name = row.get("iLabel", {}).get("value", "").strip()
            qid = row.get("i", {}).get("value", "")
            if not site.startswith(("http://", "https://")) or not name or name.startswith("Q"):
                continue
            domain = extract_domain(site)
            if not domain or any(domain == x or domain.endswith("." + x) for x in exclusions):
                continue
            root = canonical_url(f"https://{domain}")
            cid = company_id(root)
            if cid in seen or self.store.get("prospect:" + cid):
                continue
            seen.add(cid)
            discovered.append({
                "company_id": cid, "name": name, "business": name, "website": root,
                "industry": "education", "city": "", "source_url": qid,
                "source": "Wikidata (CC0)", "state": "DISCOVERED", "discovered_at": time.time(),
            })
            if len(discovered) >= BATCH_SIZE:
                break

        if discovered:
            self.store.put_many_new({"prospect:" + c["company_id"]: c for c in discovered})
        # Wrap to the start once the list is exhausted; seen domains are skipped above.
        next_cursor = cursor + PAGE_SIZE if len(rows) == PAGE_SIZE else 0
        self.store.put("source:wikidata", {"cursor": next_cursor, "timestamp": time.time()})
        return discovered, []
