from src.overture_discovery import OvertureDiscovery, PAGE_SIZE, industry_for_category
from tests.test_morning_queue_resilience import Store


def _row(i, name, domain, category):
    return {"domain": domain, "name": name, "site": "http://" + domain, "category": category, "id": f"id{i}"}


def _patch(monkeypatch, rows):
    monkeypatch.setattr('src.overture_discovery.latest_release', lambda: '2026-10-21.0')
    monkeypatch.setattr('src.overture_discovery.query_places', lambda release, bbox, offset: rows)


def test_industry_mapping_and_exclusions():
    assert industry_for_category('dentist_clinic') == 'healthcare'
    assert industry_for_category('tutoring_service') == 'training'
    assert industry_for_category('atm') is None and industry_for_category('bank_or_credit_union') is None
    assert industry_for_category('building_or_construction_service') == 'other'
    assert industry_for_category(None) is None


def test_harvest_filters_noise_and_stores_candidates(monkeypatch):
    store = Store()
    _patch(monkeypatch, [
        _row(1, 'Lumen Dental Clinic', 'lumendental.in', 'dentist_clinic'),
        _row(2, 'City Bank ATM', 'citybank.in', 'atm'),
        _row(3, 'Govt School', 'school.gov.in', 'school'),
        _row(4, 'Placeholder', 'example.com', 'professional_service'),
        _row(5, 'Unknown Thing', 'unknown.in', 'mystery_category'),
        _row(6, 'Lumen Dental Clinic Branch', 'lumendental.in', 'dentist_clinic'),
    ])
    found, errors = OvertureDiscovery(store, {}).harvest()
    assert errors == [] and [c['name'] for c in found] == ['Lumen Dental Clinic']
    lead = found[0]
    assert lead['industry'] == 'healthcare' and lead['website'].startswith('https://lumendental.in')
    assert lead['source'].startswith('Overture Maps') and lead['city'] == 'Chennai'
    assert store.get('prospect:' + lead['company_id'])


def test_respects_campaign_industries(monkeypatch):
    _patch(monkeypatch, [_row(1, 'Lumen Dental Clinic', 'lumendental.in', 'dentist_clinic')])
    found, _ = OvertureDiscovery(Store(), {'industries': ['education']}).harvest()
    assert found == []


def test_cursor_pages_within_city_then_moves_on(monkeypatch):
    store = Store()
    _patch(monkeypatch, [_row(i, f'Clinic {i}', f'c{i}.in', 'clinic') for i in range(PAGE_SIZE)])
    OvertureDiscovery(store, {}).harvest()
    assert store.get('source:overture')['offset'] == PAGE_SIZE and store.get('source:overture')['city_idx'] == 0
    _patch(monkeypatch, [])
    OvertureDiscovery(store, {}).harvest()
    state = store.get('source:overture')
    assert state['city_idx'] == 1 and state['offset'] == 0


def test_failure_does_not_advance_checkpoint(monkeypatch):
    store = Store()
    monkeypatch.setattr('src.overture_discovery.latest_release', lambda: '2026-10-21.0')

    def boom(*a, **k):
        raise TimeoutError()
    monkeypatch.setattr('src.overture_discovery.query_places', boom)
    found, errors = OvertureDiscovery(store, {}).harvest()
    assert not found and errors and store.get('source:overture') is None
