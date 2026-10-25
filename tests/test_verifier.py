"""Tests for contact email parsing, domain matching, and DNS/MX validation."""

from unittest.mock import patch
import pytest
from src.verifier import (
    clean_email,
    extract_emails_from_html,
    has_valid_mx_records,
    is_valid_business_email,
    is_valid_syntax,
    select_best_contact_email,
)


def test_clean_email():
    assert clean_email("  Info@Example.Com.  ") == "info@example.com"
    assert clean_email("<contact@pes.edu>") == "contact@pes.edu"


def test_is_valid_syntax():
    assert is_valid_syntax("info@pes.edu")
    assert is_valid_syntax("admissions.office@college.ac.in")
    assert not is_valid_syntax("plainaddress")
    assert not is_valid_syntax("@missingusername.com")
    assert not is_valid_syntax("username@.com")
    assert not is_valid_syntax("username@domain")


def test_is_valid_business_email():
    # Valid domain affiliation
    assert is_valid_business_email("info@pes.edu", "pes.edu", check_dns=False)
    assert is_valid_business_email("admissions@dept.pes.edu", "pes.edu", check_dns=False)

    # Disallowed third-party / free webmail / blacklisted
    assert not is_valid_business_email("person@gmail.com", "pes.edu", check_dns=False)
    assert not is_valid_business_email("test@example.com", "example.com", check_dns=False)
    assert not is_valid_business_email("admin@sentry.io", "sentry.io", check_dns=False)

    # Disallowed automated prefixes
    assert not is_valid_business_email("noreply@pes.edu", "pes.edu", check_dns=False)
    assert not is_valid_business_email("no-reply@pes.edu", "pes.edu", check_dns=False)
    assert not is_valid_business_email("mailer-daemon@pes.edu", "pes.edu", check_dns=False)


def test_dns_mx_validation_success():
    from src.verifier import MX_CACHE
    from unittest.mock import MagicMock
    MX_CACHE.clear()
    with patch("dns.resolver.Resolver.resolve", return_value=[MagicMock()]):
        assert has_valid_mx_records("pes.edu") is True


def test_dns_mx_validation_failure():
    from src.verifier import MX_CACHE
    import dns.resolver
    MX_CACHE.clear()
    with patch("dns.resolver.Resolver.resolve", side_effect=dns.resolver.NXDOMAIN):
        assert has_valid_mx_records("nonexistent-bogus-domain-12345.edu") is False


def test_extract_emails_from_html():
    html = """
    <html>
      <body>
        <p>For inquiries, email info@pes.edu or call our office.</p>
        <a href="mailto:admissions@pes.edu">Apply Now</a>
        <a href="mailto:spam@gmail.com">Ignore this</a>
        <p>Automated alerts from noreply@pes.edu</p>
      </body>
    </html>
    """
    results = extract_emails_from_html(html, "pes.edu", "https://pes.edu/contact", check_dns=False)
    extracted_addrs = [r[0] for r in results]

    assert "info@pes.edu" in extracted_addrs
    assert "admissions@pes.edu" in extracted_addrs
    assert "spam@gmail.com" not in extracted_addrs
    assert "noreply@pes.edu" not in extracted_addrs


def test_select_best_contact_email():
    candidates = [
        ("john.doe@pes.edu", "https://pes.edu/faculty"),
        ("admissions@pes.edu", "https://pes.edu/apply"),
        ("info@pes.edu", "https://pes.edu/contact"),
    ]
    best = select_best_contact_email(candidates)
    assert best is not None
    # 'info' has higher priority ranking than 'admissions' or personal name
    assert best[0] == "info@pes.edu"


def test_obfuscated_and_cloudflare_email_extraction():
    from src.verifier import decode_cf_email
    # Test Cloudflare XOR decoding
    # "info@pes.edu" XOR encoded with key 0x12
    # 'i' (105 ^ 18 = 123 -> 7b)
    # Let's test decode_cf_email roundtrip
    key = 0x25
    plain = "info@pes.edu"
    cf_hex = f"{key:02x}" + "".join(f"{ord(c) ^ key:02x}" for c in plain)
    assert decode_cf_email(cf_hex) == "info@pes.edu"

    # Test HTML with Cloudflare and obfuscated text
    html = f"""
    <div>
      <span data-cfemail="{cf_hex}">[email protected]</span>
      <p>Contact admissions at: admissions [at] pes [dot] edu</p>
      <p>Inquiries: contact (at) pes.edu</p>
    </div>
    """
    results = extract_emails_from_html(html, "pes.edu", "https://pes.edu/contact", check_dns=False)
    addrs = [r[0] for r in results]
    assert "info@pes.edu" in addrs
    assert "admissions@pes.edu" in addrs
    assert "contact@pes.edu" in addrs


def test_affiliated_domain_matching():
    # Affiliated institutional root domain (e.g. orchids in both)
    assert is_valid_business_email("info@orchids.edu.in", "orchidsinternationalschool.com", check_dns=False)
    assert is_valid_business_email("principal@ksit.edu.in", "ksit.ac.in", check_dns=False)
    # Unrelated domains should still be rejected
    assert not is_valid_business_email("info@unrelated.edu.in", "pes.edu", check_dns=False)

