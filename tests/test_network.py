"""Tests for URL canonicalization, domain extraction, and SSRF prevention."""

import pytest
from src.network import canonical_url, extract_domain, is_ip_safe, is_safe_url


def test_canonical_url():
    assert canonical_url("pes.edu") == "https://pes.edu/"
    assert canonical_url("http://example.com/path/") == "http://example.com/path"
    assert canonical_url("https://www.example.org/about") == "https://www.example.org/about"
    assert canonical_url("") == ""


def test_extract_domain():
    assert extract_domain("https://www.pes.edu/admissions") == "pes.edu"
    assert extract_domain("http://sub.domain.example.com/page") == "sub.domain.example.com"
    assert extract_domain("https://example.org") == "example.org"
    assert extract_domain("") == ""


def test_ip_safety():
    # Loopback addresses
    assert not is_ip_safe("127.0.0.1")
    assert not is_ip_safe("127.0.1.1")
    assert not is_ip_safe("::1")

    # Private RFC 1918 addresses
    assert not is_ip_safe("10.0.0.1")
    assert not is_ip_safe("172.16.0.1")
    assert not is_ip_safe("192.168.1.1")

    # Link-local / Cloud Metadata (AWS/GCP/Azure)
    assert not is_ip_safe("169.254.169.254")
    assert not is_ip_safe("169.254.1.1")
    assert not is_ip_safe("fe80::1")

    # Multicast / Unspecified
    assert not is_ip_safe("224.0.0.1")
    assert not is_ip_safe("0.0.0.0")

    # Public routable IPs
    assert is_ip_safe("8.8.8.8")
    assert is_ip_safe("1.1.1.1")


def test_safe_url_blocking():
    # Localhost and internal domains
    assert not is_safe_url("http://localhost:8000")
    assert not is_safe_url("http://127.0.0.1:3000/api")
    assert not is_safe_url("http://169.254.169.254/latest/meta-data")
    assert not is_safe_url("file:///etc/passwd")
    assert not is_safe_url("ftp://example.com")
    assert not is_safe_url("")

    # Public valid URLs
    assert is_safe_url("https://onefolk.in/work")
    assert is_safe_url("https://pes.edu")
