from unittest.mock import Mock
from src.wikidata_discovery import WikidataDiscovery
from tests.test_morning_queue_resilience import Store


def _rows(*items):
    return {'results': {'bindings': [
        {'i': {'value': f'http://www.wikidata.org/entity/{q}'}, 'iLabel': {'value': name},
         'site': {'value': site}} for q, name, site in items]}}


def _patch(monkeypatch, payload):
    response = Mock()
    response.json.return_value = payload
    monkeypatch.setattr('src.wikidata_discovery.requests.get', lambda *a, **k: response)


def test_harvest_builds_education_candidates_and_skips_noise(monkeypatch):
    store = Store()
    _patch(monkeypatch, _rows(
        ('Q1', 'Fixture College', 'http://www.fixture.edu.in/about'),
        ('Q2', 'Fixture College Duplicate', 'https://fixture.edu.in'),
        ('Q3', 'Govt Institute', 'https://gov-inst.gov.in'),
        ('Q4', 'Q99999', 'https://unlabeled.edu'),
    ))
    found, errors = WikidataDiscovery(store, {}).harvest()
    assert errors == []
    assert [c['name'] for c in found] == ['Fixture College']
    assert found[0]['website'].startswith('https://') and found[0]['industry'] == 'education'
    assert found[0]['source'] == 'Wikidata (CC0)'
    assert store.get('prospect:' + found[0]['company_id'])


def test_cursor_advances_on_full_page_and_not_on_failure(monkeypatch):
    store = Store()
    _patch(monkeypatch, _rows(*[(f'Q{i}', f'College {i}', f'https://c{i}.edu') for i in range(300)]))
    found, _ = WikidataDiscovery(store, {}).harvest()
    assert len(found) == 40 and store.get('source:wikidata')['cursor'] == 300
    store.put('source:wikidata', {'cursor': 300})
    import requests
    monkeypatch.setattr('src.wikidata_discovery.requests.get',
                        lambda *a, **k: (_ for _ in ()).throw(requests.Timeout()))
    found, errors = WikidataDiscovery(store, {}).harvest()
    assert not found and errors and store.get('source:wikidata')['cursor'] == 300


def test_disabled_when_campaign_excludes_education():
    assert WikidataDiscovery(Store(), {'industries': ['retail']}).harvest() == ([], [])
