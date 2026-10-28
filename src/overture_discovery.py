"""Bulk discovery of independent Indian businesses from the Overture Maps places dataset.

Overture Maps (CDLA Permissive 2.0) is a discovery hint only: it supplies a name, a category and a
website. Its emails and phone numbers are never trusted; the contact email must still be found on the
official site by the normal research step. Chain outlets are dropped by keeping only places without a
brand whose website domain appears on at most MAX_PLACES_PER_DOMAIN places.
"""
import json
import re
import threading
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import requests

from src.config import CONFIG_DIR, USER_AGENT
from src.network import canonical_url, extract_domain
from src.open_discovery import company_id

BUCKET = "https://overturemaps-us-west-2.s3.amazonaws.com"
PAGE_SIZE = 400
BATCH_SIZE = 40
QUERY_TIMEOUT_SECONDS = 90
MAX_PLACES_PER_DOMAIN = 2
MIN_CONFIDENCE = 0.6

EXCLUDED_DOMAINS = (
    "gov.in", "nic.in", "wikipedia.org", "google.com", "facebook.com", "instagram.com", "linkedin.com",
    "youtube.com", "twitter.com", "x.com", "justdial.com", "indiamart.com", "sulekha.com", "zomato.com",
    "swiggy.com", "tripadvisor.com", "booking.com", "makemytrip.com", "linktr.ee", "wixsite.com",
    "blogspot.com", "wordpress.com", "example.com", "example.org", "example.net",
)
# Place categories that are never useful cold-email leads.
EXCLUDED_CATEGORY_WORDS = ("atm", "bank", "gas_station", "fuel", "ev_charging", "government", "post_office",
                           "parking", "religious", "police", "courthouse", "cemetery", "public_toilet")
# Ordered keyword -> OneFolk industry; the first match wins.
INDUSTRY_BY_CATEGORY_WORD = (
    ("wedding", "wedding"), ("event", "events"), ("architect", "architecture"),
    ("school", "education"), ("college", "education"), ("university", "education"),
    ("tutoring", "training"), ("training", "training"), ("coaching", "training"),
    ("hotel", "hospitality"), ("resort", "hospitality"), ("hostel", "hospitality"),
    ("restaurant", "restaurant"), ("cafe", "restaurant"), ("catering", "restaurant"), ("bakery", "restaurant"),
    ("clinic", "healthcare"), ("dent", "healthcare"), ("diagnostic", "healthcare"),
    ("hospital", "healthcare"), ("medical", "healthcare"), ("health", "healthcare"),
    ("real_estate", "real-estate"), ("construction", "other"),
    ("gym", "wellness"), ("fitness", "wellness"), ("beauty", "wellness"), ("spa", "wellness"), ("salon", "wellness"),
    ("advertising", "creative"), ("marketing", "creative"), ("design", "creative"), ("photograph", "creative"),
    ("apparel", "retail"), ("jewel", "retail"), ("furniture", "retail"), ("store", "retail"), ("shop", "retail"),
    ("manufactur", "manufacturing"), ("industrial", "manufacturing"),
    ("travel", "logistics-travel"), ("transport", "logistics-travel"), ("logistic", "logistics-travel"),
    ("automotive", "automotive"), ("car_dealer", "automotive"),
    ("financial", "finance"), ("accounting", "finance"), ("insurance", "finance"),
    ("professional", "professional-services"), ("b2b", "professional-services"), ("legal", "professional-services"),
    ("software", "startup-tech"), ("technology", "startup-tech"), ("it_service", "startup-tech"),
)


def industry_for_category(category: Optional[str]) -> Optional[str]:
    word = (category or "").lower()
    if not word or any(bad in word for bad in EXCLUDED_CATEGORY_WORDS):
        return None
    return next((industry for key, industry in INDUSTRY_BY_CATEGORY_WORD if key in word), None)


def latest_release() -> str:
    resp = requests.get(f"{BUCKET}/", params={"prefix": "release/", "delimiter": "/"},
                        headers={"User-Agent": USER_AGENT}, timeout=20)
    resp.raise_for_status()
    ns = {"s3": "http://s3.amazonaws.com/doc/2006-03-01/"}
    prefixes = [p.text for p in ET.fromstring(resp.content).findall(".//s3:CommonPrefixes/s3:Prefix", ns)]
    releases = sorted(re.sub(r"^release/|/$", "", p) for p in prefixes if re.search(r"\d{4}-\d{2}-\d{2}", p))
    if not releases:
        raise ValueError("no Overture release found")
    return releases[-1]


def query_places(release: str, bbox: List[float], offset: int) -> List[Dict[str, Any]]:
    """One bounded DuckDB scan of the public Overture bucket; no credentials are used."""
    import duckdb
    south, west, north, east = bbox
    con = duckdb.connect()
    timer = threading.Timer(QUERY_TIMEOUT_SECONDS, con.interrupt)
    timer.start()
    try:
        con.execute("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';")
        sql = f"""
        WITH f AS (
          SELECT names.primary AS name, websites[1] AS site, basic_category AS category, id,
                 lower(regexp_extract(websites[1], '^(?:https?://)?(?:www\\.)?([^/:?#]+)', 1)) AS domain
          FROM read_parquet('s3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*')
          WHERE addresses[1].country = 'IN'
            AND bbox.xmin BETWEEN {west} AND {east} AND bbox.ymin BETWEEN {south} AND {north}
            AND brand IS NULL AND len(websites) > 0 AND confidence >= {MIN_CONFIDENCE}
            AND (operating_status IS NULL OR operating_status = 'open')
        )
        SELECT domain, any_value(name), any_value(site), any_value(category), any_value(id)
        FROM f WHERE domain <> '' AND name IS NOT NULL AND length(name) >= 3
        GROUP BY domain HAVING count(*) <= {MAX_PLACES_PER_DOMAIN}
        ORDER BY hash(domain) LIMIT {PAGE_SIZE} OFFSET {int(offset)}"""
        rows = con.execute(sql).fetchall()
    finally:
        timer.cancel()
        con.close()
    return [{"domain": r[0], "name": r[1], "site": r[2], "category": r[3], "id": r[4]} for r in rows]


class OvertureDiscovery:
    def __init__(self, store, campaign_cfg: Optional[Dict[str, Any]] = None):
        self.store = store
        self.campaign = campaign_cfg or {}

    def cities(self) -> List[Dict[str, Any]]:
        cfg = json.loads((CONFIG_DIR / "public_sources.json").read_text())
        wanted = self.campaign.get("target_cities")
        return [c for c in cfg["cities"] if not wanted or c["name"] in wanted]

    def harvest(self) -> Tuple[List[Dict[str, Any]], List[str]]:
        cities = self.cities()
        if not cities:
            return [], []
        state = self.store.get("source:overture", {"city_idx": 0, "offset": 0, "release": ""})
        city = cities[state.get("city_idx", 0) % len(cities)]
        allowed = set(self.campaign.get("industries") or [])
        exclusions = set(EXCLUDED_DOMAINS) | set(self.campaign.get("exclusions", []))
        try:
            # Old releases are retired upstream, so resolve the newest one on every run.
            release = latest_release()
            rows = query_places(release, city["bbox"], state.get("offset", 0))
        except Exception as exc:
            return [], ["Overture source unavailable: " + type(exc).__name__]

        discovered, seen = [], set()
        for row in rows:
            industry = industry_for_category(row["category"])
            domain = row["domain"]
            if not industry or (allowed and industry not in allowed):
                continue
            if not domain or any(domain == x or domain.endswith("." + x) for x in exclusions):
                continue
            root = canonical_url(f"https://{domain}")
            cid = company_id(root)
            if cid in seen or self.store.get("prospect:" + cid):
                continue
            seen.add(cid)
            discovered.append({
                "company_id": cid, "name": row["name"], "business": row["name"], "website": root,
                "industry": industry, "city": city["name"], "source_url": "overture:" + str(row["id"]),
                "source": "Overture Maps Foundation (CDLA Permissive 2.0)",
                "state": "DISCOVERED", "discovered_at": time.time(),
            })
            if len(discovered) >= BATCH_SIZE:
                break

        if discovered:
            self.store.put_many_new({"prospect:" + c["company_id"]: c for c in discovered})
        # A short page means the city is exhausted; move on to the next city.
        if len(rows) == PAGE_SIZE:
            state.update(offset=state.get("offset", 0) + PAGE_SIZE)
        else:
            state.update(city_idx=state.get("city_idx", 0) + 1, offset=0)
        state.update(release=release, timestamp=time.time())
        self.store.put("source:overture", state)
        return discovered, []
