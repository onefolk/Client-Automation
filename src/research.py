"""Deep website investigation, verifiable signal extraction, and qualification scoring."""

from datetime import datetime, timezone
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
        """Conducts a bounded crawl of the prospect's website and evaluates qualification."""
        base_url = canonical_url(candidate["website"])
        target_domain = extract_domain(base_url)

        # 1. Fetch main landing page
        main_html = self.fetcher.fetch_html(base_url)
        if not main_html:
            logger.debug("Failed to fetch landing page for %s", base_url)
            return None

        soup = BeautifulSoup(main_html, "html.parser")
        target_urls = [base_url]

        # 2. Discover relevant subpages (contact, about, admissions, services)
        for a in soup.select("a[href]"):
            href = a.get("href", "")
            resolved = canonical_url(urljoin(base_url, href))
            sub_domain = extract_domain(resolved)
            if sub_domain == target_domain and resolved not in target_urls:
                lower_url = resolved.lower()
                if any(k in lower_url for k in NAVIGATION_KEYWORDS):
                    target_urls.append(resolved)
                    if len(target_urls) >= 4:
                        break

        # 3. Scrape pages, extract emails and context
        all_emails = []
        page_contexts = []
        combined_signals: Dict[str, Any] = {}

        for url in target_urls:
            html = main_html if url == base_url else self.fetcher.fetch_html(url)
            if not html:
                continue

            # Extract signals
            signals = extract_website_signals(html, url)
            if not combined_signals:
                combined_signals = signals
            else:
                for k, v in signals.items():
                    if isinstance(v, bool) and v:
                        combined_signals[k] = True

            # Extract emails
            found_emails = extract_emails_from_html(html, target_domain, url, check_dns=True)
            all_emails.extend(found_emails)

            # Clean context for AI analysis
            doc = BeautifulSoup(html, "html.parser")
            for tag in doc(["script", "style", "noscript", "svg", "nav", "footer"]):
                tag.decompose()
            clean_text = doc.get_text(" ", strip=True)
            if url == base_url:
                page_contexts.append((clean_text[:6500], url))
            else:
                page_contexts.append((clean_text[:3000], url))

        # 4. Require at least one verified official email
        best_contact = select_best_contact_email(all_emails)
        if not best_contact:
            logger.debug("No valid business contact email found for %s", target_domain)
            return None

        public_email, email_source = best_contact

        # 5. Formulate verifiable technical observation
        observation, observation_url, observation_type = self._formulate_observation(
            base_url, page_contexts, combined_signals
        )

        # 6. Select matching portfolio reference
        industry = candidate.get("industry", "other")
        portfolio_match = match_portfolio_project(industry, combined_signals)

        # 7. Compute transparent qualification score
        score, explanation, is_qualified = self._compute_qualification_score(
            combined_signals, public_email, observation, candidate
        )

        from hashlib import sha256
        lead_id = f"lead_{sha256((target_domain + '|' + public_email).encode()).hexdigest()[:16]}"
        timestamp = datetime.now(timezone.utc).isoformat()

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
            "qualification_status": "QUALIFIED" if is_qualified else "NEEDS_RESEARCH",
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
    ) -> Tuple[int, str, bool]:
        """Calculates a transparent score (0-100) based on verified evidence."""
        score = 0
        reasons = []

        if email and "@" in email:
            score += 35
            reasons.append("Verified public domain contact email present (+35)")

        if signals.get("has_https"):
            score += 15
            reasons.append("Secure HTTPS active (+15)")

        if observation:
            score += 25
            reasons.append("Verifiable website opportunity identified (+25)")

        if candidate.get("city"):
            score += 15
            reasons.append("Target metropolitan geographic alignment (+15)")

        if signals.get("has_mobile_viewport"):
            score += 10
            reasons.append("Modern mobile layout baseline detected (+10)")

        is_qualified = score >= 60
        explanation = "; ".join(reasons)
        return score, explanation, is_qualified
