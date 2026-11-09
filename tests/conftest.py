import pytest
import requests


@pytest.fixture(autouse=True)
def no_live_wikidata(monkeypatch):
    """Tests must never reach the public Wikidata endpoint."""
    def offline(*args, **kwargs):
        raise requests.ConnectionError('network disabled in tests')
    monkeypatch.setattr('src.wikidata_discovery.requests.get', offline)


@pytest.fixture(autouse=True)
def no_live_overture(monkeypatch):
    """Tests must never reach the public Overture bucket."""
    def offline(*args, **kwargs):
        raise requests.ConnectionError('network disabled in tests')
    monkeypatch.setattr('src.overture_discovery.latest_release', offline)


@pytest.fixture(autouse=True)
def no_site_lane_is_opt_in(monkeypatch):
    """Existing suites cover the website lane; no-website tests enable their lane explicitly."""
    monkeypatch.setenv('NO_SITE_ENABLED', 'false')
    monkeypatch.delenv('SERPER_API_KEY', raising=False)


@pytest.fixture(autouse=True)
def no_live_dns(monkeypatch):
    """Tests must never depend on real DNS answers."""
    monkeypatch.setattr('src.strict_research.domain_resolution', lambda domain: 'UNKNOWN')
    monkeypatch.setattr('src.no_site_verifier.domain_resolution', lambda domain: 'UNKNOWN')
