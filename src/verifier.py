"""Contact verification, email syntax parsing, and DNS/MX record verification."""

import html as html_parser
import logging
import re
from typing import Dict, List, Optional, Tuple
from urllib.parse import unquote
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
    email = email.strip().lower()
    if not email or "@" not in email:
        return False
    parts = email.split("@")
    if len(parts) != 2:
        return False
    local, domain = parts
    if local.startswith(".") or local.endswith(".") or ".." in local:
        return False
    if any(not label or len(label)>63 or label.startswith("-") or label.endswith("-") for label in domain.split(".")):
        return False
    if not local or not domain or "." not in domain:
        return False
    if len(email) > 254 or len(local) > 64:
        return False
    return bool(EMAIL_REGEX.fullmatch(email))


def has_valid_mx_records(domain: str, timeout: float = 3.0) -> bool:
    """Verifies that the email domain has valid DNS non-null MX records (not mailbox existence)."""
    domain = domain.strip().lower()
    if not domain:
        return False

    if domain in MX_CACHE:
        return MX_CACHE[domain]

    if not DNS_AVAILABLE:
        # Fallback to true if dnspython is not installed
        MX_CACHE[domain] = False
        return False

    try:
        resolver = dns.resolver.Resolver()
        resolver.nameservers = ["8.8.8.8", "1.1.1.1", "8.8.4.4"]
        resolver.lifetime = max(timeout, 4.0)
        resolver.timeout = max(timeout, 4.0)
        # First check MX records
        try:
            answers = resolver.resolve(domain, "MX")
            if answers and any(str(a.exchange).strip(".") for a in answers):
                MX_CACHE[domain] = True
                return True
        except (dns.resolver.NoAnswer, dns.resolver.NoNameservers):
            pass

        MX_CACHE[domain] = False
        return False
    except (dns.resolver.NXDOMAIN, dns.resolver.Timeout, Exception) as e:
        logger.debug("DNS check failed for %s: %s", domain, str(e)[:100])
        MX_CACHE[domain] = False
        return False


def decode_cf_email(cf_hex: str) -> Optional[str]:
    """Safely decodes Cloudflare email-protection hex strings."""
    if not cf_hex or len(cf_hex) < 4:
        return None
    try:
        key = int(cf_hex[:2], 16)
        email = "".join(chr(int(cf_hex[i:i+2], 16) ^ key) for i in range(2, len(cf_hex), 2))
        return clean_email(email)
    except Exception:
        return None


OBFUSCATED_EMAIL_REGEX = re.compile(
    r'([A-Za-z0-9._%+-]+)\s*(?:\[at\]|\(at\)|@|\bat\b)\s*([A-Za-z0-9.-]+)\s*(?:\[dot\]|\(dot\)|\.|\bdot\b)\s*([A-Za-z]{2,}(?:\.[A-Za-z]{2,})?)',
    re.I
)


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

    # Domain affiliation check: must match apex or subdomain of target organization,
    # or match affiliated institutional domain (e.g. ksit.edu.in for ksit.ac.in, orchids.edu.in for orchidsinternationalschool.com)
    is_affiliated = (
        domain_part == target_domain
        or domain_part.endswith("." + target_domain)
        or target_domain.endswith("." + domain_part)
    )
    if not is_affiliated:
        target_root = target_domain.split(".")[0].lower()
        email_root = domain_part.split(".")[0].lower()
        if len(target_root) >= 4 and (target_root in domain_part or email_root in target_domain):
            is_affiliated = True

    if not is_affiliated:
        # We only accept first-party official business domains
        return False

    # Optional DNS/MX record check
    if check_dns and not has_valid_mx_records(domain_part):
        return False

    return True


def extract_emails_from_html(html: str, target_domain: str, source_url: str, check_dns: bool = True) -> List[Tuple[str, str]]:
    """Extracts all valid business emails from HTML text, mailto links, and safe obfuscations."""
    if not html:
        return []

    soup = BeautifulSoup(html, "html.parser")
    raw_emails = set()

    # 1. Cloudflare email protection tags
    for cf in soup.select('[data-cfemail]'):
        dec = decode_cf_email(cf.get('data-cfemail', ''))
        if dec and is_valid_syntax(dec):
            raw_emails.add(dec)
    for a in soup.select('a[href*="/cdn-cgi/l/email-protection#"]'):
        hex_part = a.get('href', '').split('#')[-1]
        dec = decode_cf_email(hex_part)
        if dec and is_valid_syntax(dec):
            raw_emails.add(dec)

    # 2. mailto: links (including entity-encoded and percent-encoded)
    for link in soup.select('a[href*="mailto:"]'):
        href = link.get("href", "")
        unquoted = html_parser.unescape(unquote(href))
        if "mailto:" in unquoted:
            clean_href = unquoted.split("mailto:", 1)[-1].split("?")[0]
            for candidate in clean_href.split(","):
                candidate = clean_email(candidate)
                if candidate and is_valid_syntax(candidate):
                    raw_emails.add(candidate)

    # Decompose non-content elements (do NOT decompose footer or header as they contain contact emails)
    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()

    text = html_parser.unescape(soup.get_text(" ", strip=True))
    for found in EMAIL_REGEX.findall(text):
        raw_emails.add(found)

    # 3. Obfuscated patterns like name [at] domain [dot] com
    for m in OBFUSCATED_EMAIL_REGEX.findall(text):
        user, dom, tld = m
        constructed = f"{user}@{dom}.{tld}".replace("..", ".").lower()
        if is_valid_syntax(constructed):
            raw_emails.add(constructed)

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
