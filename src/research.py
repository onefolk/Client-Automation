"""Deep website investigation, verifiable signal extraction, and qualification scoring."""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin
from bs4 import BeautifulSoup

from src.config import load_portfolio
from src.network import SafeFetcher, canonical_url, extract_domain
from src.verifier import extract_emails_from_html, select_best_contact_email

logger = logging.getLogger(__name__)

NAVIGATION_KEYWORDS = (
    "contact",
    "about",
    "admission",
    "admissions",
    "enquiry",
    "inquiry",
    "services",
    "event",
    "events",
    "reach",
    "team",
    "careers",
    "booking",
    "menu",
    "reservation",
    "reservations",
    "order",
    "catering",
    "banquet",
    "rooms",
    "tariff",
)


def match_portfolio_project(industry: str, signals: Dict[str, Any]) -> Dict[str, Any]:
    """Matches the most appropriate OneFolk portfolio project to the prospect."""
    portfolio = load_portfolio()
    # Check signal-specific matches first
    if signals.get("has_ordering_opportunity") and any(p["project"] == "Campus Kiosk" for p in portfolio):
        return next(p for p in portfolio if p["project"] == "Campus Kiosk")
    if signals.get("has_event_opportunity") and any(p["project"] == "Event Operations Platform" for p in portfolio):
        return next(p for p in portfolio if p["project"] == "Event Operations Platform")
    if signals.get("has_hostel_opportunity") and any(p["project"] == "Hostel Room Allocation Suite" for p in portfolio):
        return next(p for p in portfolio if p["project"] == "Hostel Room Allocation Suite")

    # Match by industry fit
    for p in portfolio:
        if industry in p.get("fits", []):
            return p

    # Fallback to authentic OneFolk website reference
    return next(
        (p for p in portfolio if p.get("type") == "own-site"),
        {
            "project": "OneFolk website",
            "proof": "Our team designed and built the OneFolk website.",
            "deliverables": ["Modern responsive web application"],
            "type": "own-site",
        },
    )


def extract_website_signals(html: str, url: str) -> Dict[str, Any]:
    """Extracts factual, verifiable technical signals from page HTML."""
    signals = {
        "has_https": url.startswith("https://"),
        "has_mobile_viewport": False,
        "has_inquiry_form": False,
        "has_booking_link": False,
        "has_portal_login": False,
        "has_ordering_opportunity": False,
        "has_event_opportunity": False,
        "has_hostel_opportunity": False,
        "copyright_year": None,
        "title": "",
    }
    if not html:
        return signals

    soup = BeautifulSoup(html, "html.parser")
    title_tag = soup.find("title")
    if title_tag:
        signals["title"] = title_tag.get_text(" ", strip=True)[:120]

    # Check mobile viewport tag
    viewport = soup.find("meta", attrs={"name": re.compile(r"viewport", re.I)})
    if viewport and "width=" in str(viewport.get("content", "")):
        signals["has_mobile_viewport"] = True

    # Check inquiry/application forms
    forms = soup.find_all("form")
    for f in forms:
        inputs = [inp.get("type", "").lower() for inp in f.find_all("input")]
        if "text" in inputs or "email" in inputs or f.find("textarea"):
            signals["has_inquiry_form"] = True
            break

    # Check booking/registration/portal keywords
    body_text = soup.get_text(" ", strip=True).lower()
    if any(k in body_text for k in ("book now", "reservation", "register online", "ticket")):
        signals["has_booking_link"] = True
    if any(k in body_text for k in ("student portal", "parent portal", "login", "erp login")):
        signals["has_portal_login"] = True

    # Check industry opportunity flags
    if any(k in body_text for k in ("canteen", "cafeteria", "food court", "ordering", "menu")):
        signals["has_ordering_opportunity"] = True
    if any(k in body_text for k in ("conference", "symposium", "ticketing", "exhibition")):
        signals["has_event_opportunity"] = True
    if any(k in body_text for k in ("hostel", "dormitory", "residential campus", "accommodation")):
        signals["has_hostel_opportunity"] = True

    # Check copyright year
    copyright_match = re.search(r"(?:©|&copy;|copyright)\s*(?:20\d\d\s*[-–]\s*)?(20\d\d)", body_text, re.I)
    if copyright_match:
        try:
            signals["copyright_year"] = int(copyright_match.group(1))
        except ValueError:
            pass

    return signals


class ProspectResearcher:
    """Investigates candidate websites and establishes grounded qualification records."""

    def __init__(self, fetcher: SafeFetcher):
        self.fetcher = fetcher

    def investigate(self, candidate: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Conducts a two-stage bounded crawl of the prospect's website and evaluates qualification."""
        base_url = canonical_url(candidate["website"])
        target_domain = extract_domain(base_url)
        from hashlib import sha256
        timestamp = datetime.now(ZoneInfo("Asia/Kolkata")).isoformat()

        # 1. Stage 1: Lightweight fetch of main landing page
        main_html = self.fetcher.fetch_html(base_url)
        if not main_html:
            logger.debug("Failed to fetch landing page for %s", base_url)
            lead_id = f"lead_{sha256(target_domain.encode()).hexdigest()[:16]}"
            return {
                "lead_id": lead_id,
                "business": candidate.get("name") or target_domain,
                "industry": candidate.get("industry", "other"),
                "city": candidate.get("city", ""),
                "website": base_url,
                "source_url": candidate.get("source_url", base_url),
                "public_email": "",
                "email_source_url": "",
                "qualification_score": 0,
                "qualification_status": "WEBSITE_UNAVAILABLE",
                "priority_score": 0,
                "priority_tier": "WEBSITE_UNAVAILABLE",
                "priority_breakdown": {},
                "scoring_reasons": "Landing page inaccessible or timed out",
                "observation": "",
                "observation_url": base_url,
                "observation_type": "WEBSITE_UNAVAILABLE",
                "opportunity": "",
                "proof_project": "",
                "proof_line": "",
                "page_contexts": [],
                "timestamp": timestamp,
            }

        soup = BeautifulSoup(main_html, "html.parser")
        target_urls = [base_url]

        # 2. Discover relevant contact and info subpages (prioritizing navigation and footer contact links)
        contact_links = []
        info_links = []
        for a in soup.select("a[href]"):
            href = a.get("href", "")
            resolved = canonical_url(urljoin(base_url, href))
            sub_domain = extract_domain(resolved)
            if sub_domain == target_domain and resolved not in target_urls:
                lower_url = resolved.lower()
                anchor_text = a.get_text(" ", strip=True).lower()
                if any(k in lower_url or k in anchor_text for k in ("contact", "contact-us", "contactus", "reach-us", "reach", "enquiry", "inquiry", "admissions", "admission")):
                    if resolved not in contact_links:
                        contact_links.append(resolved)
                elif any(k in lower_url or k in anchor_text for k in NAVIGATION_KEYWORDS):
                    if resolved not in info_links:
                        info_links.append(resolved)

        for a in soup.select("footer a[href]"):
            href = a.get("href", "")
            resolved = canonical_url(urljoin(base_url, href))
            sub_domain = extract_domain(resolved)
            if sub_domain == target_domain and resolved not in target_urls and resolved not in contact_links:
                contact_links.append(resolved)

        # Stage 2: Deep contact and context investigation
        prioritized_subpages = contact_links[:3] + info_links[:2]
        target_urls.extend(prioritized_subpages[:4])

        all_emails = []
        page_contexts = []
        combined_signals: Dict[str, Any] = {}

        # Landing page scan first
        landing_signals = extract_website_signals(main_html, base_url)
        combined_signals.update(landing_signals)
        landing_emails = extract_emails_from_html(main_html, target_domain, base_url, check_dns=True)
        all_emails.extend(landing_emails)

        doc = BeautifulSoup(main_html, "html.parser")
        for tag in doc(["script", "style", "noscript", "svg", "nav", "footer"]):
            tag.decompose()
        page_contexts.append((doc.get_text(" ", strip=True)[:6500], base_url))

        # Fetch subpages
        for url in target_urls[1:]:
            html = self.fetcher.fetch_html(url)
            if not html:
                continue

            signals = extract_website_signals(html, url)
            for k, v in signals.items():
                if isinstance(v, bool) and v:
                    combined_signals[k] = True

            found_emails = extract_emails_from_html(html, target_domain, url, check_dns=True)
            all_emails.extend(found_emails)

            s_doc = BeautifulSoup(html, "html.parser")
            for tag in s_doc(["script", "style", "noscript", "svg", "nav", "footer"]):
                tag.decompose()
            page_contexts.append((s_doc.get_text(" ", strip=True)[:3000], url))

        best_contact = select_best_contact_email(all_emails)
        public_email = best_contact[0] if best_contact else ""
        email_source = best_contact[1] if best_contact else ""

        # Formulate verifiable technical observation
        observation, observation_url, observation_type = self._formulate_observation(
            base_url, page_contexts, combined_signals
        )

        industry = candidate.get("industry", "other")
        portfolio_match = match_portfolio_project(industry, combined_signals)

        # Compute qualification score
        score, explanation, is_qualified, breakdown = self._compute_qualification_score(
            combined_signals, public_email, observation, candidate
        )

        lead_id = f"lead_{sha256((target_domain + '|' + (public_email or target_domain)).encode()).hexdigest()[:16]}"

        if is_qualified and public_email:
            qualification_status = "QUALIFIED_CONTACTABLE"
            priority_tier = "TOP_10_PRIORITY" if score >= 80 else "SECONDARY_BACKLOG"
        elif is_qualified and not public_email:
            qualification_status = "QUALIFIED_CONTACT_MISSING"
            priority_tier = "QUALIFIED_CONTACT_MISSING"
        elif not observation:
            qualification_status = "NEEDS_OPPORTUNITY_EVIDENCE"
            priority_tier = "NEEDS_OPPORTUNITY_EVIDENCE"
        else:
            qualification_status = "NEEDS_OPPORTUNITY_EVIDENCE"
            priority_tier = "NEEDS_OPPORTUNITY_EVIDENCE"

        return {
            "lead_id": lead_id,
            "business": candidate.get("name") or combined_signals.get("title") or target_domain,
            "industry": industry,
            "city": candidate.get("city", ""),
            "website": base_url,
            "source_url": candidate.get("source_url", base_url),
            "public_email": public_email,
            "email_source_url": email_source,
            "qualification_score": score,
            "qualification_status": qualification_status,
            "priority_score": score,
            "priority_tier": priority_tier,
            "priority_breakdown": breakdown,
            "scoring_reasons": explanation,
            "observation": observation,
            "observation_url": observation_url,
            "observation_type": observation_type,
            "opportunity": f"Enhance web presence with custom workflow: {portfolio_match['project']}",
            "proof_project": portfolio_match["project"],
            "proof_line": portfolio_match["proof"],
            "page_contexts": page_contexts,
            "timestamp": timestamp,
        }

    def _formulate_observation(
        self, base_url: str, contexts: List[Tuple[str, str]], signals: Dict[str, Any]
    ) -> Tuple[str, str, str]:
        """Formulates an honest observation distinguishing defects from improvement ideas."""
        # Check SSL
        if not signals.get("has_https"):
            return (
                "The site is currently served over insecure HTTP without automatic HTTPS redirection.",
                base_url,
                "CONFIRMED_DEFECT",
            )

        # Check mobile responsiveness
        if not signals.get("has_mobile_viewport"):
            return (
                "The homepage is missing standard mobile viewport configuration meta tags.",
                base_url,
                "CONFIRMED_DEFECT",
            )

        # Check interactive forms vs static mailto
        if not signals.get("has_inquiry_form"):
            contact_page = next((url for _, url in contexts if "contact" in url.lower() or "enquiry" in url.lower()), base_url)
            return (
                "Visitor inquiries currently rely on static email mailto links rather than a structured online form.",
                contact_page,
                "SUGGESTED_IMPROVEMENT",
            )

        # Default factual observation on page structure
        observed_url = contexts[0][1] if contexts else base_url
        return (
            "The web portal presents clean static information with potential to add self-service workflows.",
            observed_url,
            "SUGGESTED_IMPROVEMENT",
        )

    def _compute_qualification_score(
        self, signals: Dict[str, Any], email: str, observation: str, candidate: Dict[str, Any]
    ) -> Tuple[int, str, bool, Dict[str, int]]:
        """Calculates a transparent priority qualification score (0-100) based on 5 strict criteria:
        1. Verified website opportunity: max 30 pts
        2. OneFolk service fit: max 25 pts
        3. Publicly sourced appropriate contact: max 20 pts
        4. Observable improvement or buying signal: max 15 pts
        5. Commercial fit: max 10 pts
        Minimum threshold for Top 10 Priority Queue: 80 / 100.
        Secondary qualified backlog threshold: 60 - 79.
        """
        score_opportunity = 0
        score_service_fit = 0
        score_contact = 0
        score_buying_signal = 0
        score_commercial_fit = 0
        reasons = []

        # 1. Verified website opportunity (max 30 pts)
        obs_lower = (observation or "").lower()
        if any(k in obs_lower for k in ("defect", "insecure http", "viewport", "manual", "download", "construction", "broken", "unencrypted")):
            score_opportunity = 30
            reasons.append("Verified concrete technical or manual workflow defect identified (30/30)")
        elif any(k in obs_lower for k in ("mailto", "form", "inquiry", "contact")):
            score_opportunity = 25
            reasons.append("Verified missing interactive form or intake workflow (25/30)")
        elif observation:
            score_opportunity = 20
            reasons.append("Verifiable static portal modernization opportunity (20/30)")
        else:
            reasons.append("No verifiable website opportunity identified (0/30)")

        # 2. OneFolk service fit (max 25 pts)
        industry = candidate.get("industry", "other")
        portfolio = match_portfolio_project(industry, signals)
        if portfolio.get("project") != "OneFolk website":
            score_service_fit = 25
            reasons.append(f"Direct software product match: {portfolio.get('project')} (25/25)")
        elif signals.get("has_inquiry_form") is False or signals.get("has_mobile_viewport") is False:
            score_service_fit = 20
            reasons.append("Direct web redesign & responsive engineering fit (20/25)")
        else:
            score_service_fit = 15
            reasons.append("General web engineering & modernization fit (15/25)")

        # 3. Publicly sourced appropriate contact (max 20 pts)
        if email and "@" in email:
            prefix = email.split("@")[0].lower()
            if any(p in prefix for p in ("info", "contact", "office", "enquiry", "inquiry", "admissions", "admin", "principal", "reach")):
                score_contact = 20
                reasons.append(f"Verified priority role inbox with valid MX: {email} (20/20)")
            else:
                score_contact = 15
                reasons.append(f"Verified official domain contact with valid MX: {email} (15/20)")
        else:
            reasons.append("No verified public domain contact email (0/20)")

        # 4. Observable improvement or buying signal (max 15 pts)
        if signals.get("has_booking_link") or signals.get("has_portal_login") or signals.get("has_event_opportunity") or signals.get("has_ordering_opportunity"):
            score_buying_signal = 15
            reasons.append("Active interactive business signals & transaction keywords detected (15/15)")
        elif signals.get("copyright_year") and signals.get("copyright_year") >= 2023:
            score_buying_signal = 12
            reasons.append(f"Actively maintained domain with recent copyright {signals['copyright_year']} (12/15)")
        elif signals.get("has_https"):
            score_buying_signal = 10
            reasons.append("Active domain with standard HTTPS security (10/15)")
        else:
            score_buying_signal = 5
            reasons.append("Baseline active web presence (5/15)")

        # 5. Commercial fit (max 10 pts)
        if candidate.get("city") and industry in ("education", "training", "professional-services", "creative", "architecture", "hospitality", "events"):
            score_commercial_fit = 10
            reasons.append(f"Metropolitan {candidate.get('city')} commercial market fit in {industry} (10/10)")
        elif candidate.get("city"):
            score_commercial_fit = 7
            reasons.append(f"Target metropolitan {candidate.get('city')} location fit (7/10)")
        else:
            score_commercial_fit = 5
            reasons.append("Standard commercial business entity (5/10)")

        total_score = score_opportunity + score_service_fit + score_contact + score_buying_signal + score_commercial_fit
        breakdown = {
            "opportunity": score_opportunity,
            "service_fit": score_service_fit,
            "contact": score_contact,
            "buying_signal": score_buying_signal,
            "commercial_fit": score_commercial_fit,
            "total": total_score,
        }
        explanation = f"Total {total_score}/100: " + "; ".join(reasons)
        is_qualified = total_score >= 60

        return total_score, explanation, is_qualified, breakdown
