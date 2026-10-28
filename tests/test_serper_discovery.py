"""Tests for Serper Google Search and Seed Discovery engines."""
from unittest.mock import Mock, patch
import pytest
from src.serper_discovery import SeedDiscovery, SerperDiscovery, clean_title
from tests.test_morning_queue_resilience import Store


def test_clean_title():
    assert clean_title("Acme Architects - Official Website") == "Acme Architects"
    assert clean_title("Welcome to St. Xavier College | Admissions") == "St. Xavier College"
    assert clean_title("The Leela Palace - Home") == "The Leela Palace"
    assert clean_title("Zero9 Studio: Contact Us") == "Zero9 Studio"
    assert clean_title("Contact Us", domain="presidencyuniversity.in") == "Presidencyuniversity"
    assert clean_title("", domain="bmsce.ac.in") == "Bmsce"


def test_serper_discovery_unconfigured():
    store = Store()
    discovery = SerperDiscovery(store, {})
    assert not discovery.is_configured()
    found, errors = discovery.harvest()
    assert found == []
    assert any("not configured" in e for e in errors)


def test_serper_discovery_successful_harvest(monkeypatch):
    store = Store()
    monkeypatch.setenv("SERPER_API_KEY", "test_serper_key")

    discovery = SerperDiscovery(store, {"industries": ["architecture"], "target_cities": ["Bengaluru"]})
    assert discovery.is_configured()

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "organic": [
            {
                "title": "Morphogenesis - Architects & Design Studio",
                "link": "https://morphogenesis.org/contact",
                "snippet": "Leading architectural studio in Bengaluru.",
            },
            {
                "title": "Government Tenders",
                "link": "https://karnataka.gov.in/tenders",
                "snippet": "Karnataka tenders.",
            },
            {
                "title": "Duplicate Link",
                "link": "https://morphogenesis.org/portfolio",
                "snippet": "Portfolio page.",
            },
        ]
    }

    monkeypatch.setattr("src.serper_discovery.requests.post", lambda *a, **k: mock_resp)

    found, errors = discovery.harvest()
    assert len(found) == 1
    lead = found[0]
    assert lead["business"] == "Morphogenesis"
    assert lead["website"] == "https://morphogenesis.org/"
    assert lead["city"] == "Bengaluru"
    assert lead["industry"] == "architecture"
    assert lead["source"] == "Google Search via Serper.dev"
    assert errors == []

    # Second run deduplicates already stored company
    found_2, _ = discovery.harvest()
    assert len(found_2) == 0


def test_serper_discovery_quota_exhaustion_429(monkeypatch):
    store = Store()
    monkeypatch.setenv("SERPER_API_KEY", "test_serper_key")

    discovery = SerperDiscovery(store, {"industries": ["education"], "target_cities": ["Mumbai"]})
    mock_resp = Mock()
    mock_resp.status_code = 429
    monkeypatch.setattr("src.serper_discovery.requests.post", lambda *a, **k: mock_resp)

    found, errors = discovery.harvest()
    assert found == []
    assert any("quota exhausted" in e.lower() for e in errors)


def test_seed_discovery_harvests_unseeded_rows():
    store = Store()
    seed_disc = SeedDiscovery(store, {"exclusions": ["gov.in"]})
    found, errors = seed_disc.harvest(batch_size=5)
    assert len(found) <= 5
    if found:
        assert found[0]["state"] == "DISCOVERED"
        assert found[0]["source"] == "Curated Institutional Seeds (seeds.csv)"
        assert not errors
        cid = found[0]["company_id"]
        assert store.get("prospect:" + cid) is not None


def test_bio_websites_reads_listed_site_and_ignores_link_hubs():
    from src.serper_discovery import bio_websites
    item = {"title": "Lumen Studio (@lumenstudio) • Instagram", "snippet": "Wedding films, Pune. www.lumenstudio.in | linktr.ee/lumen | instagram.com/lumen"}
    assert bio_websites(item) == ["www.lumenstudio.in"]
    assert bio_websites({"title": "x", "snippet": "no website here"}) == []


def test_social_profile_becomes_candidate_from_bio_website(monkeypatch):
    from src import serper_discovery
    store = Store()
    monkeypatch.setenv("SERPER_API_KEY", "k")
    monkeypatch.setenv("SERPER_QUERIES_PER_HARVEST", "1")
    monkeypatch.setattr(serper_discovery, "SEARCH_TEMPLATES", {"wedding": [], "other": []})
    monkeypatch.setattr(serper_discovery, "INTENT_TEMPLATES", [])
    monkeypatch.setattr(serper_discovery, "SOCIAL_TEMPLATES", ['site:instagram.com "{city}" {label}'])
    mock_resp = Mock(status_code=200)
    mock_resp.json.return_value = {"organic": [
        {"title": "Lumen Studio (@lumenstudio) • Instagram", "link": "https://www.instagram.com/lumenstudio/",
         "snippet": "Wedding films Pune. www.lumenstudio.in"},
        {"title": "No site (@nosite) • Instagram", "link": "https://www.instagram.com/nosite/", "snippet": "DM to book"},
    ]}
    monkeypatch.setattr("src.serper_discovery.requests.post", lambda *a, **k: mock_resp)
    found, errors = SerperDiscovery(store, {"industries": ["wedding"], "target_cities": ["Pune"]}).harvest()
    assert errors == [] and len(found) == 1
    assert found[0]["website"] == "https://lumenstudio.in/" or found[0]["website"].endswith("lumenstudio.in/")
    assert found[0]["business"] == "Lumen Studio"
    assert found[0]["source"].startswith("Public social profile")


def test_multiple_queries_per_harvest_advance_cursor(monkeypatch):
    store = Store()
    monkeypatch.setenv("SERPER_API_KEY", "k")
    monkeypatch.setenv("SERPER_QUERIES_PER_HARVEST", "3")
    mock_resp = Mock(status_code=200)
    mock_resp.json.return_value = {"organic": []}
    monkeypatch.setattr("src.serper_discovery.requests.post", lambda *a, **k: mock_resp)
    SerperDiscovery(store, {"industries": ["education"], "target_cities": ["Pune"]}).harvest()
    assert store.get("source:serper")["cursor"] == 3
