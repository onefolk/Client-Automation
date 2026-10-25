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
    from unittest.mock import patch
    with patch("socket.getaddrinfo", return_value=[(2,1,6,"",("8.8.8.8",443))]):
        assert is_safe_url("https://onefolk.in/work")
        assert is_safe_url("https://pes.edu")


def test_safe_fetcher_pins_dns_ip():
    from unittest.mock import patch, MagicMock
    from src.network import SafeFetcher

    fetcher = SafeFetcher()
    fake_addr_info = [(2, 1, 6, "", ("93.184.215.14", 443))]
    with patch("socket.getaddrinfo", return_value=fake_addr_info):
        with patch.object(fetcher.session, "get") as mock_get:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.headers = {"Content-Type": "text/html"}
            mock_resp.raw.read1.side_effect = [b"<html>OK</html>", b""]
            mock_get.return_value = mock_resp

            res = fetcher.fetch_html("https://example.com/test")
            assert res == "<html>OK</html>"
            assert fetcher.dns_map.get("example.com") == "93.184.215.14"


def test_fetcher_isolation_and_unpinned_host_rejection():
    from src.network import SafeFetcher
    import pytest

    f1 = SafeFetcher()
    f1.dns_map["site1.com"] = "1.1.1.1"

    f2 = SafeFetcher()
    f2.dns_map["site2.com"] = "2.2.2.2"

    # Creating f2 must not clear or alter f1's pins
    assert f1.dns_map.get("site1.com") == "1.1.1.1"
    assert "site2.com" not in f1.dns_map
    assert f2.dns_map.get("site2.com") == "2.2.2.2"
    assert "site1.com" not in f2.dns_map

    # Connection to an unpinned host must be rejected
    with pytest.raises(Exception, match="Connection rejected: unpinned host"):
        f1.session.get("http://unpinned-domain.com", timeout=1)


def test_permitted_fetcher_pins_robots_dns():
    from unittest.mock import patch, MagicMock
    from src.permitted_fetcher import PermittedFetcher

    fetcher = PermittedFetcher()
    fake_addr = [(2, 1, 6, "", ("93.184.215.14", 443))]
    with patch("socket.getaddrinfo", return_value=fake_addr):
        with patch.object(fetcher.session, "get") as mock_get:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.raw.read1.side_effect = [b"User-agent: *\nAllow: /", b"", b"<html>OK</html>", b""]
            mock_resp.headers = {"Content-Type": "text/html"}
            mock_resp.__enter__.return_value = mock_resp
            mock_get.return_value = mock_resp

            fetcher.fetch_html("https://example.com/page")
            # robots.txt must have caused example.com to be pinned
            assert fetcher.dns_map.get("example.com") == "93.184.215.14"


