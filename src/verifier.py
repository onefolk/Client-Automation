"""Contact verification, email syntax parsing, and DNS/MX record verification."""

import logging
import re
from typing import Dict, List, Optional, Tuple
from bs4 import BeautifulSoup

try:
    import dns.resolver
    DNS_AVAILABLE = True
except ImportError:
    DNS_AVAILABLE = False

logger = logging.getLogger(__name__)

# Strict RFC-compliant email regex
EMAIL_REGEX = re.compile(r'(?<![\w.+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?![\w.-])')

# Disallowed domain suffixes & test hosts
BAD_EMAIL_DOMAINS = (
    "example.com",
    "example.org",
    "example.net",
    "domain.com",
    "wixpress.com",
    "sentry.io",
    "yourdomain.com",
    "wordpress.org",
    "wordpress.com",
    "github.com",
    "google.com",
    "cloudflare.com",
    "mysite.com",
)

# Automated / non-inquiry prefixes
DISALLOWED_PREFIXES = (
    "noreply",
    "no-reply",
    "donotreply",
    "do-not-reply",
    "mailer-daemon",
    "postmaster",
    "support@wordpress",
    "test@",
    "abuse@",
    "security@",
)

# Prioritized general enquiry prefixes
PRIORITY_PREFIXES = [
    "info",
    "contact",
    "office",
    "enquiry",
    "inquiry",
    "admissions",
    "admission",
    "hello",
    "admin",
    "principal",
    "director",
    "desk",
    "reach",
]

# MX lookup cache to avoid redundant network DNS queries
MX_CACHE: Dict[str, bool] = {}


def clean_email(email: str) -> str:
    """Strips punctuation and normalizes an email address to lowercase."""
    return email.strip(".,;:!()[]<>\"' \t\r\n").lower()


def is_valid_syntax(email: str) -> bool:
    """Validates structural syntax of an email address."""
    email = clean_email(email)
    if not email or "@" not in email:
        return False
    parts = email.split("@")
    if len(parts) != 2:
        return False
    local, domain = parts
    if not local or not domain or "." not in domain:
        return False
    if len(email) > 254 or len(local) > 64:
        return False
    return bool(EMAIL_REGEX.fullmatch(email))


def has_valid_mx_records(domain: str, timeout: float = 3.0) -> bool:
    """Verifies that the email domain has valid DNS MX or fallback A records."""
    domain = domain.strip().lower()
    if not domain:
        return False

    if domain in MX_CACHE:
        return MX_CACHE[domain]

    if not DNS_AVAILABLE:
        # Fallback to true if dnspython is not installed
        MX_CACHE[domain] = True
        return True

    try:
        resolver = dns.resolver.Resolver()
        resolver.lifetime = timeout
        resolver.timeout = timeout
        # First check MX records
        try:
            answers = resolver.resolve(domain, "MX")
            if answers and len(answers) > 0:
                MX_CACHE[domain] = True
                return True
        except (dns.resolver.NoAnswer, dns.resolver.NoNameservers):
            pass

        # If no MX, check if fallback A record exists (RFC 5321 Section 5.1)
        try:
            answers = resolver.resolve(domain, "A")
            if answers and len(answers) > 0:
                MX_CACHE[domain] = True
                return True
        except Exception:
            pass

        MX_CACHE[domain] = False
        return False
    except (dns.resolver.NXDOMAIN, dns.resolver.Timeout, Exception) as e:
        logger.debug("DNS check failed for %s: %s", domain, str(e)[:100])
        MX_CACHE[domain] = False
        return False


def is_valid_business_email(email: str, target_domain: str, check_dns: bool = True) -> bool:
    """Strictly validates that an email belongs to the business domain and is suitable for enquiry."""
    email = clean_email(email)
    if not is_valid_syntax(email):
        return False

    domain_part = email.split("@")[-1].lower()
    target_domain = target_domain.strip().lower()

    # Reject blacklisted domains
    if any(domain_part.endswith(bad) for bad in BAD_EMAIL_DOMAINS):
        return False

    # Reject automated / unmonitored prefixes
    if any(email.startswith(bad) or bad in email for bad in DISALLOWED_PREFIXES):
        return False

    # Domain affiliation check: must match apex or subdomain of the target organization
    if domain_part != target_domain and not domain_part.endswith("." + target_domain):
        # We only accept first-party official business domains
        return False

    # Optional DNS/MX record check
    if check_dns and not has_valid_mx_records(domain_part):
        return False

    return True


def extract_emails_from_html(html: str, target_domain: str, source_url: str, check_dns: bool = True) -> List[Tuple[str, str]]:
    """Extracts all valid business emails from HTML text and mailto links."""
    if not html:
        return []

    soup = BeautifulSoup(html, "html.parser")
    # Decompose non-content elements
    for tag in soup(["script", "style", "noscript", "svg", "header", "footer"]):
        tag.decompose()

    text = soup.get_text(" ", strip=True)
    raw_emails = set(EMAIL_REGEX.findall(text))

    # Also extract mailto links
    for link in soup.select('a[href^="mailto:"]'):
        href = link.get("href", "")
        clean_href = href.replace("mailto:", "").split("?")[0]
        for candidate in clean_href.split(","):
            candidate = clean_email(candidate)
            if candidate:
                raw_emails.add(candidate)

    valid_results = []
    for raw in raw_emails:
        cleaned = clean_email(raw)
        if is_valid_business_email(cleaned, target_domain, check_dns=check_dns):
            valid_results.append((cleaned, source_url))

    return valid_results


def select_best_contact_email(email_tuples: List[Tuple[str, str]]) -> Optional[Tuple[str, str]]:
    """Selects the highest priority general inquiry email from extracted candidates."""
    if not email_tuples:
        return None

    unique_candidates = list({t[0]: t for t in email_tuples}.values())

    def score_email(item: Tuple[str, str]) -> int:
        email, _ = item
        prefix = email.split("@")[0].lower()
        for idx, pref in enumerate(PRIORITY_PREFIXES):
            if prefix == pref or prefix.startswith(pref):
                return idx
        return 999

    sorted_candidates = sorted(unique_candidates, key=score_email)
    return sorted_candidates[0]
