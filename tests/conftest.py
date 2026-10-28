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
