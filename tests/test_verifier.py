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
