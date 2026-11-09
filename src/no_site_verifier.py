"""Proves a business has no working website before anyone tells them so.

Being absent from one dataset proves nothing, so a candidate must pass domain guesses and a
Google search, and must still be findable somewhere under its own name. Anything unclear is
parked without a claim. A website turning up is a useful result: the lead moves to the normal
website pipeline.
"""
import hashlib
import logging
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Tuple
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

from src.config import LEAD_TYPE_NO_WEBSITE, USER_AGENT, load_chains, load_portfolio
from src.network import canonical_url, extract_domain
from src.open_discovery import is_known_chain
from src.serper_discovery import LINK_HUBS, bio_websites, is_profile_url, is_social_host
from src.strict_research import corroborated_identity
from src.suppression import normalize_phone
from src.verifier import (
    BAD_EMAIL_DOMAINS, DISALLOWED_PREFIXES, EMAIL_REGEX, clean_email, domain_resolution,
    has_valid_mx_records, is_free_mail, is_valid_syntax,
)

logger = logging.getLogger(__name__)

IST = ZoneInfo("Asia/Kolkata")
QUALIFY_SCORE = 60
PRIORITY_SCORE = 80
CITY_HOTEL_PORTAL = re.compile(r'(?:^|\.)hotels?in[a-z]+\.(?:com|in|net|org|co\.in)$')  # the-x.hotelinchennai.com
PHONE_IN_TEXT = re.compile(r'(?<!\d)(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?!\d)')
GENERIC_NAME_WORDS = {
    'the', 'and', 'private', 'limited', 'pvt', 'ltd', 'llp', 'college', 'school', 'university', 'institute',
    'academy', 'hotel', 'restaurant', 'resort', 'services', 'service', 'company', 'group', 'clinic', 'studio',
    'centre', 'center', 'shop', 'store', 'cafe', 'salon', 'gym', 'hospital', 'india', 'new', 'best',
}
PLATFORM_NAMES = {"instagram.com": "Instagram", "facebook.com": "Facebook", "threads.net": "Threads"}
# Directories and marketplaces can list a business, but they are never its own website.
DIRECTORY_HOSTS = (
    "justdial.com", "indiamart.com", "sulekha.com", "tradeindia.com", "yellowpages.in", "yelp.com", "zomato.com",
    "swiggy.com", "magicpin.in", "eazydiner.com", "dineout.co.in", "tripadvisor.com", "tripadvisor.in", "booking.com",
    "makemytrip.com", "goibibo.com", "agoda.com", "practo.com", "lybrate.com", "wedmegood.com", "weddingwire.in",
    "shaadisaga.com", "urbancompany.com", "shiksha.com", "collegedunia.com", "collegedekho.com", "housing.com",
    "99acres.com", "magicbricks.com", "nobroker.in", "mouthshut.com", "tofler.in", "zaubacorp.com", "wikipedia.org",
    "youtube.com", "google.com", "linkedin.com", "pinterest.com", "x.com", "twitter.com", "wanderlog.com", "mapcarta.com",
)
HIGH_VALUE_INDUSTRIES = ("healthcare", "wellness", "hospitality", "restaurant", "wedding", "architecture", "training",
                         "real-estate", "professional-services", "finance", "creative", "events", "retail", "automotive")


class SearchUnavailable(Exception):
    """The search could not run, so nothing can be concluded about this business."""


def _matches(domain: str, hosts) -> bool:
    return any(domain == h or domain.endswith("." + h) for h in hosts)


def is_listing_host(domain: str) -> bool:
    """Directories, booking sites and city hotel portals can list a business but are not its website."""
    return (_matches(domain, DIRECTORY_HOSTS) or _matches(domain, load_chains()["booking_domains"])
            or bool(CITY_HOTEL_PORTAL.search(domain)))


def distinctive_words(name: str) -> List[str]:
    return [w for w in re.findall(r'[a-z0-9]{3,}', str(name).lower()) if w not in GENERIC_NAME_WORDS]


def names_this_business(name: str, text: str) -> bool:
    """Strict match for evidence: "Best Dental Clinic" must not count for "Lumen Dental Clinic"."""
    words = distinctive_words(name)
    observed = re.sub(r'[^a-z0-9]+', ' ', str(text).lower())
    phrase = re.sub(r'[^a-z0-9]+', ' ', str(name).lower()).strip()
    if phrase and f" {phrase} " in f" {observed} ":
        return True
    return len(words) >= 2 and all(w in observed.split() for w in words)


def domain_guesses(name: str) -> List[str]:
    slug = re.sub(r'[^a-z0-9]', '', re.sub(r'\b(?:pvt|private|ltd|limited|llp)\b', '', str(name).lower()))
    if len(slug) < 6:
        return []
    return [f"{slug}.{tld}" for tld in ("in", "com", "co.in")]


def _platform(domain: str) -> str:
    return next((label for host, label in PLATFORM_NAMES.items() if _matches(domain, (host,))), "social media")


def build_observation(status: str, business: str, city: str, evidence_url: str, dead_domain: str) -> str:
    """Fixed wording: it says what we could not find, never that no website exists."""
    place = f"{business} in {city}" if city else business
    if status == "SITE_DEAD":
        return f"We looked for {place}, but the website address listed for you, {dead_domain}, did not open when we checked."
    domain = extract_domain(evidence_url)
    if status == "SOCIAL_ONLY":
        return f"We looked for {place} and found your {_platform(domain)} page, but could not find a website."
    return f"We looked for {place} and found your listing on {domain}, but could not find a website."


def call_script(business: str, observation: str) -> str:
    return (f"Hello, this is Team OneFolk calling for {business}. {observation} We build simple first websites for "
            "businesses like yours. Would it be useful if we shared an idea? If not, we will remove this number.")


def score_lead(sources: int, has_email: bool, has_phone: bool, industry: str, city: str) -> Tuple[int, Dict[str, int]]:
    """Out of 100: confirmed gap 35, active evidence 25, contact 20, industry 10, city 10."""
    breakdown = {
        "no_site_verified": 35,
        "active_evidence": 25 if sources >= 3 else 17 if sources == 2 else 10,
        "contact": 20 if has_email else 10 if has_phone else 0,
        "industry_fit": 10 if industry in HIGH_VALUE_INDUSTRIES else 6,
        "city_fit": 10 if city else 5,
    }
    total = sum(breakdown.values())
    return total, {**breakdown, "total": total}


class NoSiteResearcher:
    def __init__(self, fetcher, max_searches: int):
        self.fetcher = fetcher
        self.remaining = max(0, max_searches)
        self.searches_used = 0
        self.api_key = os.getenv("SERPER_API_KEY", "").strip()
        self.stopped = False
        self._proof = None

    def can_verify(self) -> bool:
        return bool(self.api_key) and self.remaining > 0 and not self.stopped

    def _search(self, query: str) -> Dict[str, Any]:
        if not self.can_verify():
            raise SearchUnavailable("search budget exhausted or Serper not configured")
        self.remaining -= 1
        self.searches_used += 1
        try:
            resp = requests.post("https://google.serper.dev/search", timeout=15,
                                 headers={"X-API-KEY": self.api_key, "Content-Type": "application/json", "User-Agent": USER_AGENT},
                                 json={"q": query, "gl": "in", "hl": "en", "num": 10})
            if resp.status_code == 429:
                self.stopped = True
                raise SearchUnavailable("Serper quota exhausted")
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, ValueError) as exc:
            raise SearchUnavailable(type(exc).__name__) from exc

    def _guess_official_site(self, name: str, city: str, dead_domain: str) -> Tuple[str, bool]:
        """Returns (site, ambiguous). A name alone can belong to another business elsewhere."""
        ambiguous = False
        for domain in domain_guesses(name):
            if domain == dead_domain or domain_resolution(domain) != "RESOLVES":
                continue
            url = canonical_url(f"https://{domain}")
            html = self.fetcher.fetch_html(url)
            if not html:
                ambiguous = True
                continue
            text = BeautifulSoup(html, "html.parser").get_text(" ", strip=True).lower()
            if not corroborated_identity(name, text):
                continue
            if city and city.lower() in text:
                return url, False
            ambiguous = True
        return "", ambiguous

    def _classify(self, prospect: Dict[str, Any], name: str, dead_domain: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Reads the search results for an official site, public profiles and listings."""
        found: Dict[str, Any] = {"site": "", "uncertain": False, "social": [], "listings": [], "emails": [], "phones": [], "snippets": {}}
        words = [w for w in distinctive_words(name) if len(w) >= 4]
        graph = data.get("knowledgeGraph") or {}
        graph_site = extract_domain(str(graph.get("website") or ""))
        if (graph_site and graph_site != dead_domain and corroborated_identity(name, str(graph.get("title", "")).lower())
                and not is_social_host(graph_site) and not is_listing_host(graph_site) and not _matches(graph_site, LINK_HUBS)):
            found["site"] = canonical_url(f"https://{graph_site}")
            return found

        def read_contacts(text: str, url: str):
            found["emails"].extend((clean_email(e), url) for e in EMAIL_REGEX.findall(text))
            found["phones"].extend(PHONE_IN_TEXT.findall(text))

        items = list(data.get("organic") or [])
        known_profile = prospect.get("social_url", "") if prospect.get("profile_snippet") else ""
        if known_profile:
            found["social"].append(known_profile)
            found["snippets"][known_profile] = prospect["profile_snippet"]
            read_contacts(prospect["profile_snippet"], known_profile)

        for item in items:
            link = str(item.get("link", "")).strip()
            domain = extract_domain(link) if link.startswith(("http://", "https://")) else ""
            text = f"{item.get('title', '')} {item.get('snippet', '')}"
            if not domain or not corroborated_identity(name, text.lower()):
                continue
            # Loose matching above errs towards finding a site; evidence of the business must be exact.
            if (is_social_host(domain) or is_listing_host(domain)) and not names_this_business(name, text):
                continue
            if is_social_host(domain):
                sites = [s for s in bio_websites(item) if extract_domain(s) != dead_domain and not is_listing_host(extract_domain(s))]
                if sites:
                    found["site"] = canonical_url(f"https://{extract_domain(sites[0])}")
                    return found
                if is_profile_url(link):
                    if link not in found["social"]:
                        found["social"].append(link)
                        found["snippets"][link] = str(item.get("snippet", ""))
                    read_contacts(text, link)
            elif is_listing_host(domain):
                if link not in found["listings"]:
                    found["listings"].append(link)
                    found["snippets"][link] = str(item.get("snippet", ""))
            elif not _matches(domain, LINK_HUBS) and domain != dead_domain:
                if any(w in domain.split(".")[0] for w in words):
                    found["site"] = canonical_url(f"https://{domain}")
                    return found
                # A deep link is usually an article; a shallow one on an unknown domain could be their site.
                if len([s for s in urlsplit(link).path.split("/") if s]) <= 1:
                    found["uncertain"] = True
        return found

    def _pick_email(self, emails: List[Tuple[str, str]]) -> Tuple[str, str, str]:
        """Returns (free-mail address, its source, company domain). A company email implies a site to check."""
        for email, source in emails:
            domain = email.split("@")[-1]
            if not is_valid_syntax(email) or any(email.startswith(p) for p in DISALLOWED_PREFIXES):
                continue
            if any(domain.endswith(bad) for bad in BAD_EMAIL_DOMAINS):
                continue
            if not is_free_mail(domain):
                return "", "", domain
            if has_valid_mx_records(domain):
                return email, source, ""
        return "", "", ""

    def _proof_item(self) -> Tuple[Dict[str, Any], str]:
        project = next((p for p in load_portfolio() if p["project"] == "OneFolk website"), {})
        if self._proof is None:
            html = self.fetcher.fetch_html(project.get("evidence_url", "")) if project.get("evidence_url") else None
            self._proof = bool(html and "onefolk" in BeautifulSoup(html, "html.parser").get_text(" ", strip=True).lower())
        return project, "YES" if self._proof else "NO"

    def _route_to_site(self, base: Dict[str, Any], website: str, reason: str) -> Dict[str, Any]:
        if _matches(extract_domain(website), load_chains()["site_domains"]):
            return {**base, "qualification_status": "REJECTED", "qualification_reason": "Website belongs to a known chain"}
        return {**base, "qualification_status": "HAS_WEBSITE_FOUND", "website": website, "qualification_reason": reason}

    def investigate(self, prospect: Dict[str, Any]) -> Dict[str, Any]:
        name = str(prospect.get("business") or prospect.get("name") or "").strip()
        city = str(prospect.get("city") or "").strip()
        industry = prospect.get("industry", "other")
        dead_domain = str(prospect.get("dead_domain") or "")
        cid = prospect["company_id"]
        now = datetime.now(IST).isoformat()
        base = {
            "lead_id": "lead_" + hashlib.sha256(cid.encode()).hexdigest()[:16], "company_id": cid, "business": name,
            "industry": industry, "city": city, "website": "", "lead_type": LEAD_TYPE_NO_WEBSITE,
            "source_url": prospect.get("source_url", ""), "public_email": "", "email_source_url": "",
            "qualification_score": 0, "priority_score": 0, "observation": "", "observation_url": "",
            "observation_type": "", "opportunity": "", "proof_project": "", "proof_line": "",
            "page_contexts": [], "timestamp": now, "last_verified_at": now, "research_date": now,
        }

        if not distinctive_words(name):
            return {**base, "qualification_status": "NEEDS_OPPORTUNITY_EVIDENCE",
                    "qualification_reason": "Name too generic to verify against search results"}

        if is_known_chain(name):
            return {**base, "qualification_status": "REJECTED", "qualification_reason": "Known chain outlet"}

        site, ambiguous = self._guess_official_site(name, city, dead_domain)
        if site:
            return self._route_to_site(base, site, "A site matching the name and city resolves")

        found = self._classify(prospect, name, dead_domain, self._search(f'"{name}" {city}'.strip()))
        if found["site"]:
            return self._route_to_site(base, found["site"], "Search found an official website")

        email, email_source, company_domain = self._pick_email(found["emails"])
        if company_domain:
            return self._route_to_site(base, canonical_url(f"https://{company_domain}"), "Public profile uses a company email domain")

        evidence = found["social"] + found["listings"]
        if ambiguous or found["uncertain"] or not evidence:
            reason = ("Possible website could not be ruled out" if (ambiguous or found["uncertain"])
                      else "Business could not be found under its own name")
            return {**base, "qualification_status": "NEEDS_OPPORTUNITY_EVIDENCE", "qualification_reason": reason}

        status = "SITE_DEAD" if dead_domain else "SOCIAL_ONLY" if found["social"] else "NO_SITE_CONFIRMED"
        evidence_url = evidence[0]
        observation = build_observation(status, name, city, evidence_url, dead_domain)
        phone = normalize_phone(prospect.get("phone", "")) or next(filter(None, map(normalize_phone, found["phones"])), "")
        sources = len({extract_domain(u) for u in evidence})
        score, breakdown = score_lead(sources, bool(email), bool(phone), industry, city)
        project, proof_verified = self._proof_item()
        opportunity = "Build a simple first website so customers can find the business and enquire directly."
        result = {
            **base, "website_status": status, "phone": phone,
            "social_url": found["social"][0] if found["social"] else prospect.get("social_url", ""),
            "public_email": email, "email_source_url": email_source, "qualification_score": score, "priority_score": score,
            "priority_breakdown": breakdown, "observation": observation, "observation_url": evidence_url,
            "observation_type": status, "opportunity": opportunity, "business_relevance": opportunity,
            "opportunity_category": "NO_WEBSITE_OPPORTUNITY", "recommended_service": "First website and online presence",
            "proof_project": project.get("project", ""), "proof_line": project.get("proof", ""),
            "proof_url": project.get("evidence_url", ""), "proof_verified": proof_verified,
            "page_contexts": [(str(found["snippets"].get(evidence_url, ""))[:1000] or observation, evidence_url)],
            "strict_grounding": True, "confidence_level": "HIGH", "call_script": call_script(name, observation),
            "mail_domain_status": "MX_VALID_MAILBOX_UNCONFIRMED" if email else "",
            "verification_confidence": "Domain guesses + Google search + public profile; mailbox unconfirmed",
            "qualification_reason": f"{status}: {sources} public source(s) found, no official website",
        }
        if score < QUALIFY_SCORE or (email and proof_verified != "YES"):
            status_out, tier = "NEEDS_OPPORTUNITY_EVIDENCE", "NEEDS_OPPORTUNITY_EVIDENCE"
        elif email:
            status_out, tier = "QUALIFIED_CONTACTABLE", "TOP_10_PRIORITY" if score >= PRIORITY_SCORE else "SECONDARY_BACKLOG"
        elif phone:
            status_out, tier = "CALL_LIST", "CALL_LIST"
        else:
            status_out, tier = "QUALIFIED_CONTACT_MISSING", "QUALIFIED_CONTACT_MISSING"
        return {**result, "qualification_status": status_out, "priority_tier": tier}
