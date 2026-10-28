from unittest.mock import Mock
from src.open_discovery import OpenDiscovery
from tests.test_morning_queue_resilience import Store

def test_partition_checkpoint_replay_deduplicates(monkeypatch):
    store=Store()
    response=Mock()
    payload={'elements':[{'type':'node','id':123,'tags':{'name':'Fixture Academy','website':'https://fixture.edu/'}}]}
    import json
    response.headers = {}
    response.raw.read1.side_effect = [json.dumps(payload).encode(), b'', json.dumps(payload).encode(), b'']
    monkeypatch.setattr('src.open_discovery.requests.post',lambda *a,**k:response)
    discovery=OpenDiscovery(store,{'industries':['education'],'target_cities':['Chennai']})
    first,errors=discovery.harvest()
    second,_=discovery.harvest()
    assert len(first)==1 and not second and not errors
    assert store.get('source:osm')['cursor']==2

def test_failed_source_does_not_advance_checkpoint(monkeypatch):
    import requests
    store=Store()
    def fail(*a,**k): raise requests.Timeout()
    monkeypatch.setattr('src.open_discovery.requests.post',fail)
    found,errors=OpenDiscovery(store,{'industries':['education']}).harvest()
    assert not found and errors and store.get('source:osm') is None

def test_contact_or_booking_is_not_opportunity():
    from src.strict_research import StrictResearcher
    researcher=StrictResearcher(Mock())
    assert researcher._formulate_observation('https://fixture.edu',[('Book now; contact us.','https://fixture.edu')],{'has_booking_link':True})[0]==''
    observation,url,_=researcher._formulate_observation('https://fixture.edu',[('Please download the application form and submit it in person.','https://fixture.edu/apply')],{})
    assert 'download' in observation and url.endswith('/apply')


def test_open_discovery_uses_serper_when_configured(monkeypatch):
    store = Store()
    monkeypatch.setenv("SERPER_API_KEY", "test_key")
    mock_serper_harvest = Mock(return_value=([{"company_id": "c1", "business": "Test Corp"}], []))
    monkeypatch.setattr("src.serper_discovery.SerperDiscovery.harvest", mock_serper_harvest)

    discovery = OpenDiscovery(store, {"industries": ["architecture"]})
    found, errors = discovery.harvest()
    assert len(found) == 1
    assert found[0]["business"] == "Test Corp"
    mock_serper_harvest.assert_called_once()


def test_open_discovery_falls_back_to_osm_when_serper_fails(monkeypatch):
    store = Store()
    monkeypatch.setenv("SERPER_API_KEY", "test_key")
    # Serper returns empty with errors
    mock_serper_harvest = Mock(return_value=([], ["Serper API request failed: ReadTimeout"]))
    monkeypatch.setattr("src.serper_discovery.SerperDiscovery.harvest", mock_serper_harvest)

    # Mock OSM response
    osm_called = []
    def mock_osm():
        osm_called.append(True)
        return [{"company_id": "c2", "business": "OSM Firm"}], []
    monkeypatch.setattr(OpenDiscovery, "_harvest_osm", lambda self: mock_osm())

    discovery = OpenDiscovery(store, {"industries": ["architecture"]})
    found, errors = discovery.harvest()
    assert len(found) == 1
    assert found[0]["business"] == "OSM Firm"
    assert len(osm_called) == 1

