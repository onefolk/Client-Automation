"""The no-website lane: discovery, proof of absence, routing, gates and contact safety."""
import copy
from datetime import datetime, timezone
from unittest.mock import MagicMock, Mock

import pytest

from src import morning_queue as mq
from src import no_site_verifier as nsv
from src.groq_client import capability_sentence
from src.open_discovery import no_site_candidate, no_site_company_id
from src.overture_discovery import OvertureNoSiteDiscovery
from src.quality import eligible_queue, validate_queued_draft
from src.serper_discovery import SerperNoSiteDiscovery, bio_websites, is_profile_url, no_site_from_profile
from src.suppression import SuppressionManager, normalize_phone
from tests.test_morning_queue import valid_record
from tests.test_morning_queue_resilience import Store

PROFILE = 'https://www.instagram.com/lumenstudio/'
LISTING = 'https://www.justdial.com/Pune/Lumen-Studio/123'


def prospect(**overrides):
    base = no_site_candidate('Lumen Studio', 'wedding', 'Pune', 'overture:1', 'Overture', phone='+919876543210')
    return {**base, **overrides}


def researcher(monkeypatch, organic=None, graph=None, html=None, budget=5):
    monkeypatch.setenv('SERPER_API_KEY', 'k')
    response = Mock(status_code=200)
    response.json.return_value = {'organic': organic or [], 'knowledgeGraph': graph or {}}
    monkeypatch.setattr(nsv.requests, 'post', lambda *a, **k: response)
    monkeypatch.setattr(nsv, 'has_valid_mx_records', lambda domain: True)
    fetcher = Mock()
    fetcher.fetch_html.return_value = html if html is not None else 'OneFolk work'
    return nsv.NoSiteResearcher(fetcher, max_searches=budget)


def social(snippet='Wedding films. DM to book', link=PROFILE, title='Lumen Studio (@lumenstudio) • Instagram'):
    return {'title': title, 'link': link, 'snippet': snippet}


def no_site_record(index=1):
    return {**valid_record(index), 'website': '', 'lead_type': 'NO_WEBSITE', 'website_status': 'SOCIAL_ONLY',
            'company_id': f'company_nosite_{index}', 'public_email': f'lead{index}@gmail.com',
            'email_source_url': PROFILE, 'observation_url': PROFILE}


# --- identity and suppression -------------------------------------------------------------

def test_identity_is_unique_and_shared_across_sources():
    assert no_site_company_id('Lumen Studio', 'Pune') == no_site_company_id('LUMEN  studio!', 'pune')
    assert no_site_company_id('Lumen Studio', 'Pune') != no_site_company_id('Orbit Cafe', 'Pune')


def test_one_gmail_bounce_does_not_block_every_gmail_lead():
    manager = SuppressionManager()
    assert manager.is_suppressed('studioha@gmail.com')[0]
    assert not manager.is_suppressed('fresh.lead@gmail.com')[0]
    manager.load_from_sheet_data([], [['2026-10-01', 'old@gmail.com']])
    assert manager.is_suppressed('old@gmail.com')[0] and not manager.is_suppressed('other@gmail.com')[0]


def test_company_domain_suppression_still_applies():
    manager = SuppressionManager()
    manager.load_from_sheet_data([], [['2026-10-01', 'info@acme.in']])
    assert manager.is_suppressed('sales@acme.in')[0]


@pytest.mark.parametrize('raw,expected', [('98765 43210', '+919876543210'), ('+91-98765-43210', '+919876543210'),
                                          ('09876543210', '+919876543210'), ('12345', ''), ('0000000000', ''), ('', '')])
def test_phone_normalization(raw, expected):
    assert normalize_phone(raw) == expected


def test_do_not_call_blocks_and_listed_numbers_are_not_repeated():
    manager = SuppressionManager()
    manager.load_call_list([{'phone': '9876543210', 'status': 'DO_NOT_CALL'}, {'phone': '9123456789', 'status': 'TO_CALL'}])
    assert manager.is_phone_opted_out('+919876543210')
    assert manager.is_phone_blocked('9123456789') and not manager.is_phone_opted_out('9123456789')
    assert not manager.is_phone_blocked('9000000001')


def test_suppression_list_accepts_phone_rows():
    manager = SuppressionManager()
    manager.load_from_sheet_data([{'type': 'PHONE', 'value': '98765 43210'}], [])
    assert manager.is_phone_opted_out('9876543210')


# --- discovery ----------------------------------------------------------------------------

def test_bio_scan_ignores_emails_and_abbreviations():
    assert bio_websites({'title': 'x', 'snippet': 'Mail lumen@gmail.com, Dr.Kumar on call'}) == []
    assert bio_websites({'title': 'x', 'snippet': 'Visit www.lumenstudio.in today'}) == ['www.lumenstudio.in']


@pytest.mark.parametrize('link,expected', [(PROFILE, True), ('https://instagram.com/p/abc/', False),
                                           ('https://www.facebook.com/groups/x', False), ('https://www.reddit.com/foo', False)])
def test_only_account_pages_count_as_profiles(link, expected):
    assert is_profile_url(link) is expected


def test_profile_listing_a_website_is_not_a_no_site_candidate():
    assert no_site_from_profile(social('Book at www.lumenstudio.in'), 'Pune', 'wedding') is None
    lead = no_site_from_profile(social(), 'Pune', 'wedding')
    assert lead['business'] == 'Lumen Studio' and lead['website'] == '' and lead['lead_type'] == 'NO_WEBSITE'


def test_overture_lane_stores_unverified_candidates(monkeypatch):
    store = Store()
    monkeypatch.setattr('src.overture_discovery.latest_release', lambda: 'r')
    monkeypatch.setattr('src.overture_discovery.query_no_website_places', lambda *a: [
        {'name': 'Lumen Dental', 'category': 'dentist_clinic', 'id': '1', 'phone': '98765 43210', 'social': ''},
        {'name': 'City ATM', 'category': 'atm', 'id': '2', 'phone': '9876543211', 'social': ''},
    ])
    found, errors = OvertureNoSiteDiscovery(store, {}).harvest()
    assert not errors and [c['name'] for c in found] == ['Lumen Dental']
    assert found[0]['phone'] == '+919876543210' and found[0]['state'] == 'DISCOVERED' and found[0]['website'] == ''


def test_unbranded_chain_outlets_are_dropped(monkeypatch):
    store = Store()
    monkeypatch.setattr('src.overture_discovery.latest_release', lambda: 'r')
    names = ['Naturals Ttk Road', 'Naturals Adyar', 'Naturals Anna Nagar', 'Sri Lakshmi Salon', 'Sri Ganesh Salon', 'Sri Murugan Salon', 'Cutz Unisex Salon']
    monkeypatch.setattr('src.overture_discovery.query_no_website_places', lambda *a: [
        {'name': n, 'category': 'beauty_salon', 'id': str(i), 'phone': '', 'social': ''} for i, n in enumerate(names)])
    found, _ = OvertureNoSiteDiscovery(store, {}).harvest()
    assert sorted(c['name'] for c in found) == ['Cutz Unisex Salon', 'Sri Ganesh Salon', 'Sri Lakshmi Salon', 'Sri Murugan Salon']


def test_discovery_pauses_when_backlog_is_full(monkeypatch):
    store = Store()
    monkeypatch.setattr('src.open_discovery.NO_SITE_MAX_BACKLOG', 1)
    store.put('prospect:x', prospect())
    monkeypatch.setattr('src.overture_discovery.latest_release', lambda: pytest.fail('must not scan'))
    assert OvertureNoSiteDiscovery(store, {}).harvest() == ([], [])


def test_serper_lane_has_its_own_cursor(monkeypatch):
    store = Store()
    monkeypatch.setenv('SERPER_API_KEY', 'k')
    response = Mock(status_code=200)
    response.json.return_value = {'organic': [social()]}
    monkeypatch.setattr('src.serper_discovery.requests.post', lambda *a, **k: response)
    found, errors = SerperNoSiteDiscovery(store, {'industries': ['wedding'], 'target_cities': ['Pune']}).harvest()
    assert not errors and len(found) == 1 and store.get('source:serper_nosite')['cursor'] == 2
    assert store.get('source:serper') is None


# --- proving there is no website ----------------------------------------------------------

def test_official_site_in_search_routes_to_website_lane(monkeypatch):
    organic = [{'title': 'Lumen Studio - Wedding Films', 'link': 'https://lumenstudio.co/about', 'snippet': 'Pune'}]
    result = researcher(monkeypatch, organic).investigate(prospect())
    assert result['qualification_status'] == 'HAS_WEBSITE_FOUND' and result['website'].startswith('https://lumenstudio.co')


def test_knowledge_panel_website_routes_to_website_lane(monkeypatch):
    result = researcher(monkeypatch, [social()], graph={'title': 'Lumen Studio', 'website': 'https://lumen-films.in/'}).investigate(prospect())
    assert result['qualification_status'] == 'HAS_WEBSITE_FOUND'


def test_website_in_profile_bio_routes_to_website_lane(monkeypatch):
    result = researcher(monkeypatch, [social('Book at www.lumenfilms.in')]).investigate(prospect())
    assert result['qualification_status'] == 'HAS_WEBSITE_FOUND' and 'lumenfilms.in' in result['website']


def test_company_email_implies_a_site_to_check(monkeypatch):
    result = researcher(monkeypatch, [social('Mail hello@lumenweddings.in')]).investigate(prospect())
    assert result['qualification_status'] == 'HAS_WEBSITE_FOUND' and 'lumenweddings.in' in result['website']


def test_matching_domain_guess_skips_paid_search(monkeypatch):
    r = researcher(monkeypatch, html='Lumen Studio, wedding films in Pune')
    monkeypatch.setattr(nsv, 'domain_resolution', lambda d: 'RESOLVES' if d == 'lumenstudio.in' else 'NXDOMAIN')
    assert r.investigate(prospect())['qualification_status'] == 'HAS_WEBSITE_FOUND' and r.searches_used == 0


def test_same_name_in_another_city_makes_no_claim(monkeypatch):
    r = researcher(monkeypatch, [social()], html='Lumen Studio, wedding films in Delhi')
    monkeypatch.setattr(nsv, 'domain_resolution', lambda d: 'RESOLVES' if d == 'lumenstudio.in' else 'NXDOMAIN')
    result = r.investigate(prospect())
    assert result['qualification_status'] == 'NEEDS_OPPORTUNITY_EVIDENCE' and not result['observation']


def test_unknown_possible_site_makes_no_claim(monkeypatch):
    organic = [social(), {'title': 'Lumen Studio', 'link': 'https://pune-weddings.net/', 'snippet': 'Lumen Studio Pune'}]
    result = researcher(monkeypatch, organic).investigate(prospect())
    assert result['qualification_status'] == 'NEEDS_OPPORTUNITY_EVIDENCE' and 'ruled out' in result['qualification_reason']


def test_business_not_findable_is_not_claimed(monkeypatch):
    assert researcher(monkeypatch, []).investigate(prospect())['qualification_status'] == 'NEEDS_OPPORTUNITY_EVIDENCE'


def test_similar_name_is_not_evidence(monkeypatch):
    p = prospect(name='Lumen Dental Clinic', business='Lumen Dental Clinic')
    organic = [{'title': 'Best Dental Clinic in Pune', 'link': LISTING, 'snippet': 'Top dental clinic'}]
    assert researcher(monkeypatch, organic).investigate(p)['qualification_status'] == 'NEEDS_OPPORTUNITY_EVIDENCE'


def test_generic_name_cannot_be_verified(monkeypatch):
    r = researcher(monkeypatch, [social()])
    result = r.investigate(prospect(name='The Clinic', business='The Clinic'))
    assert result['qualification_status'] == 'NEEDS_OPPORTUNITY_EVIDENCE' and r.searches_used == 0


@pytest.mark.parametrize('name', ['Treebo Nestlay Casa', 'Croma BSR Mall', 'Naturals Ttk Road', 'Castrol Service - Sv Car Care', "McDonald's Adyar"])
def test_known_chain_is_rejected_before_spending_a_search(monkeypatch, name):
    r = researcher(monkeypatch, [social()])
    result = r.investigate(prospect(name=name, business=name))
    assert result['qualification_status'] == 'REJECTED' and r.searches_used == 0


@pytest.mark.parametrize('name', ['Natural Foods Pune', 'Tajmahal Sweets', 'Crompton Electricals'])
def test_chain_match_needs_whole_words(name):
    from src.open_discovery import is_known_chain
    assert not is_known_chain(name)


def test_chain_website_is_not_sent_to_the_website_pipeline(monkeypatch):
    p = prospect(name='Lumen Croma Store', business='Lumen Store')
    organic = [{'title': 'Lumen Store', 'link': 'https://www.croma.com/', 'snippet': 'Lumen Store Pune'}]
    monkeypatch.setattr(nsv, 'is_known_chain', lambda name: False)
    r = researcher(monkeypatch, organic)
    monkeypatch.setattr(r, '_classify', lambda *a: {'site': 'https://www.croma.com/', 'uncertain': False, 'social': [], 'listings': [], 'emails': [], 'phones': [], 'snippets': {}})
    result = r.investigate(p)
    assert result['qualification_status'] == 'REJECTED' and result['website'] == ''


@pytest.mark.parametrize('link', ['https://the-belstead.hotelinchennai.com/', 'https://www.expedia.co.in/Lumen-Studio'])
def test_booking_site_counts_as_a_listing_not_a_website(monkeypatch, link):
    organic = [{'title': 'Lumen Studio', 'link': link, 'snippet': 'Lumen Studio Pune'}]
    result = researcher(monkeypatch, organic).investigate(prospect())
    assert result['qualification_status'] == 'CALL_LIST' and result['website_status'] == 'NO_SITE_CONFIRMED'
    assert result['website'] == '' and result['observation_url'] == link


def test_real_hotel_domain_is_not_mistaken_for_a_portal():
    assert not nsv.is_listing_host('hotelgreenpark.com') and nsv.is_listing_host('hotelinchennai.com')


def test_rejected_chain_is_never_checked_again(rig, monkeypatch):
    manager, store, written = rig
    lead = seed(store)
    investigate = stub_research(monkeypatch, qualification_status='REJECTED')
    manager.run()
    assert store.get('prospect:' + lead['company_id'])['state'] == 'REJECTED'
    monkeypatch.setenv('SCHEDULE_SLOT', 'second')
    manager.run()
    assert investigate.call_count == 1 and 'Call List' not in written


def test_public_gmail_on_profile_is_contactable(monkeypatch):
    organic = [social('Bookings: lumenfilms@gmail.com'), {'title': 'Lumen Studio', 'link': LISTING, 'snippet': 'Pune'}]
    result = researcher(monkeypatch, organic).investigate(prospect())
    assert result['qualification_status'] == 'QUALIFIED_CONTACTABLE'
    assert result['public_email'] == 'lumenfilms@gmail.com' and result['email_source_url'] == PROFILE
    assert result['website_status'] == 'SOCIAL_ONLY' and result['website'] == ''
    assert result['observation'] == 'We looked for Lumen Studio in Pune and found your Instagram page, but could not find a website.'
    assert result['priority_score'] == 35 + 17 + 20 + 10 + 10 and result['priority_tier'] == 'TOP_10_PRIORITY'


def test_phone_only_goes_to_call_list(monkeypatch):
    result = researcher(monkeypatch, [social()]).investigate(prospect())
    assert result['qualification_status'] == 'CALL_LIST' and result['phone'] == '+919876543210'
    assert 'will remove this number' in result['call_script']


def test_listing_only_status_and_wording(monkeypatch):
    result = researcher(monkeypatch, [{'title': 'Lumen Studio', 'link': LISTING, 'snippet': 'Pune'}]).investigate(prospect())
    assert result['website_status'] == 'NO_SITE_CONFIRMED' and 'listing on justdial.com' in result['observation']


def test_no_contact_is_kept_out_of_outreach(monkeypatch):
    result = researcher(monkeypatch, [social()]).investigate(prospect(phone=''))
    assert result['qualification_status'] == 'QUALIFIED_CONTACT_MISSING'


def test_dead_site_wording_and_new_site_detection(monkeypatch):
    p = prospect(dead_domain='lumenold.in')
    result = researcher(monkeypatch, [social()]).investigate(p)
    assert result['website_status'] == 'SITE_DEAD' and 'lumenold.in, did not open' in result['observation']
    organic = [{'title': 'Lumen Studio', 'link': 'https://lumenstudio.co/', 'snippet': 'Pune'}]
    assert researcher(monkeypatch, organic).investigate(p)['qualification_status'] == 'HAS_WEBSITE_FOUND'


def test_search_budget_and_quota_stop_verification(monkeypatch):
    with pytest.raises(nsv.SearchUnavailable):
        researcher(monkeypatch, [social()], budget=0).investigate(prospect())
    r = researcher(monkeypatch, [social()])
    monkeypatch.setattr(nsv.requests, 'post', lambda *a, **k: Mock(status_code=429))
    with pytest.raises(nsv.SearchUnavailable):
        r.investigate(prospect())
    assert not r.can_verify()


def test_scoring_ceiling_and_capability_sentence():
    assert nsv.score_lead(3, True, True, 'wedding', 'Pune')[0] == 100
    assert capability_sentence('healthcare', 'First website and online presence') == (
        'At OneFolk, we help clinics and hospitals build simple, professional first websites.')


def test_realistic_draft_passes_real_grounding_and_gate(monkeypatch):
    """No mocks on the validators: the fixed observation must survive drafting rules end to end."""
    from src.groq_client import GroqClient
    organic = [social('Bookings: lumenfilms@gmail.com')]
    research = researcher(monkeypatch, organic).investigate(prospect())
    capability = capability_sentence('wedding', research['recommended_service'])
    body = (f"{research['observation']} A simple website could help couples find your work and enquire directly.\n\n"
            f"{capability}\n\nWould it be useful to share a simple idea for a first website?")
    raw = {'subject': 'A first website idea', 'email_body': body, 'opportunity': research['opportunity'],
           'alt_opening_1': 'We noticed your Instagram page while looking for wedding studios in Pune.',
           'alt_opening_2': 'Your Instagram page came up when we searched for your studio.'}
    draft = GroqClient(api_key='x')._validate_and_sanitize(raw, research['proof_line'], research['observation_url'], research, 'Lumen Studio')
    assert draft, 'grounding rejected the draft'
    record = {**research, **draft, 'status': 'AWAITING_REVIEW', 'approval': 'PENDING'}
    record.pop('page_contexts')
    assert validate_queued_draft(record) == (True, 'READY')


# --- gates --------------------------------------------------------------------------------

def test_no_site_record_passes_gate():
    assert validate_queued_draft(no_site_record()) == (True, 'READY')


@pytest.mark.parametrize('change', [{'website_status': ''}, {'website_status': 'MAYBE'}, {'website': 'https://x.in/'},
                                    {'observation_url': 'overture:1'}, {'email_source_url': ''}])
def test_no_site_record_fails_closed(change):
    assert not validate_queued_draft({**no_site_record(), **change})[0]


def test_website_lane_still_requires_website():
    assert not validate_queued_draft({**valid_record(), 'website': ''})[0]
    assert not validate_queued_draft({**valid_record(), 'website_status': 'SOCIAL_ONLY', 'website': ''})[0]


def test_many_no_site_leads_are_not_duplicates_of_each_other():
    ready, issues = eligible_queue([no_site_record(1), no_site_record(2), no_site_record(3)], SuppressionManager())
    assert len(ready) == 3 and not issues
    ready, issues = eligible_queue([no_site_record(1), {**no_site_record(1), 'lead_id': 'other'}], SuppressionManager())
    assert len(ready) == 1 and len(issues) == 1


# --- orchestration ------------------------------------------------------------------------

@pytest.fixture
def rig(monkeypatch):
    store, queue, written = Store(), [], {}
    manager = mq.MorningQueueManager(target_queue=2)
    manager.sheets = MagicMock()
    manager.sheets.connect.return_value = True
    manager.sheets.load_historical_suppression_data.side_effect = lambda: ([], [], copy.deepcopy(queue))
    manager.sheets.spreadsheet.worksheet.return_value.get_all_records.return_value = []
    manager.sheets.ensure_tab.return_value.get_all_records.return_value = []
    monkeypatch.setattr(mq, 'ReserveStore', lambda _: store)
    monkeypatch.setattr(mq, 'require_production_writer', lambda: None)
    monkeypatch.setattr(mq, 'validate_credentials', lambda **_: None)
    monkeypatch.setattr(mq.OpenDiscovery, 'harvest', lambda _: ([], []))
    monkeypatch.setattr(mq.PermittedFetcher, 'fetch_html', lambda self, url: None)
    monkeypatch.setenv('SCHEDULE_SLOT', 'no_site_slot')
    monkeypatch.setenv('SERPER_API_KEY', 'k')

    def append(sheets, tab, rows, **kwargs):
        written.setdefault(tab, []).extend(copy.deepcopy(rows))
        if tab == 'Approval Queue':
            queue.extend(copy.deepcopy(rows))
        return len(rows)
    monkeypatch.setattr(mq, 'append_records', append)
    return manager, store, written


def stub_research(monkeypatch, **result):
    base = {'lead_id': 'lead_x', 'company_id': 'c', 'website': '', 'qualification_status': 'CALL_LIST',
            'phone': '+919876543210', 'observation_url': PROFILE, 'business': 'Lumen Studio'}
    investigate = MagicMock(return_value={**base, **result})
    monkeypatch.setattr(mq.NoSiteResearcher, 'investigate', investigate)
    return investigate


def seed(store, **overrides):
    lead = prospect(**overrides)
    store.put('prospect:' + lead['company_id'], lead)
    return lead


def test_call_list_row_written_once(rig, monkeypatch):
    manager, store, written = rig
    lead = seed(store)
    investigate = stub_research(monkeypatch)
    result = manager.run()
    assert result['call_list_added'] == 1 and written['Call List'][0]['status'] == 'TO_CALL'
    assert store.get('prospect:' + lead['company_id'])['state'] == 'CALL_LISTED'
    monkeypatch.setenv('SCHEDULE_SLOT', 'second')
    manager.run()
    assert investigate.call_count == 1 and len(written['Call List']) == 1


def test_opted_out_number_is_never_listed(rig, monkeypatch):
    manager, store, written = rig
    lead = seed(store)
    manager.sheets.ensure_tab.return_value.get_all_records.return_value = [{'phone': '+919876543210', 'status': 'DO_NOT_CALL'}]
    stub_research(monkeypatch)
    manager.run()
    assert 'Call List' not in written and store.get('prospect:' + lead['company_id'])['state'] == 'SUPPRESSED'


def test_found_website_moves_to_normal_pipeline(rig, monkeypatch):
    manager, store, _ = rig
    lead = seed(store)
    stub_research(monkeypatch, qualification_status='HAS_WEBSITE_FOUND', website='https://lumenfilms.in/')
    monkeypatch.setattr(mq.StrictResearcher, 'investigate', lambda *a: None)
    result = manager.run()
    assert result['no_site_found_website'] == 1 and store.get('prospect:' + lead['company_id'])['state'] == 'ROUTED_HAS_SITE'
    assert any(p.get('website') == 'https://lumenfilms.in/' for p in store.values('prospect:'))


def test_outage_leaves_lead_untouched(rig, monkeypatch):
    manager, store, _ = rig
    lead = seed(store)
    monkeypatch.setattr(mq.NoSiteResearcher, 'investigate', MagicMock(side_effect=nsv.SearchUnavailable('ReadTimeout')))
    result = manager.run()
    stored = store.get('prospect:' + lead['company_id'])
    assert stored['state'] == 'DISCOVERED' and not stored.get('last_attempt')
    assert any('paused' in r for r in result['shortage_reasons'])


def test_daily_search_budget_is_enforced_and_unused_returned(rig, monkeypatch):
    manager, store, _ = rig
    day_key = lambda: next(k for k in store.data if k.startswith('no_site_budget:'))
    monkeypatch.setattr(mq, 'NO_SITE_SEARCHES_PER_DAY', 0)
    seed(store)
    investigate = stub_research(monkeypatch)
    manager.run()
    investigate.assert_not_called()
    assert store.get(day_key())['reserved'] == 0


def test_dead_website_is_moved_to_no_site_lane(rig, monkeypatch):
    manager, store, _ = rig
    store.put('prospect:c1', dict(company_id='c1', name='Lumen Studio', website='https://lumenold.in/', state='DISCOVERED', industry='wedding', city='Pune'))
    monkeypatch.setattr(mq.StrictResearcher, 'investigate', lambda *a: {'qualification_status': 'WEBSITE_UNAVAILABLE', 'dead_site_reason': 'NXDOMAIN'})
    manager.run()
    stored = store.get('prospect:c1')
    assert stored['lead_type'] == 'NO_WEBSITE' and stored['dead_domain'] == 'lumenold.in' and stored['website'] == '' and stored['state'] == 'DISCOVERED'


def test_timeout_is_not_treated_as_dead_site(rig, monkeypatch):
    manager, store, _ = rig
    store.put('prospect:c1', dict(company_id='c1', name='X', website='https://slow.in/', state='DISCOVERED'))
    monkeypatch.setattr(mq.StrictResearcher, 'investigate', lambda *a: {'qualification_status': 'WEBSITE_UNAVAILABLE'})
    manager.run()
    assert store.get('prospect:c1')['state'] == 'WEBSITE_UNAVAILABLE' and not store.get('prospect:c1').get('lead_type')


def test_emailable_no_site_lead_reaches_approval_queue(rig, monkeypatch):
    manager, store, written = rig
    lead = seed(store)
    record = no_site_record()
    record.update(company_id=lead['company_id'], lead_id='lead_ns', qualification_status='QUALIFIED_CONTACTABLE',
                  page_contexts=[('Wedding films', PROFILE)], strict_grounding=True)
    for k in ('status', 'approval'):
        record.pop(k)
    stub_research(monkeypatch, **record)
    draft = {k: record[k] for k in ('subject', 'email_body', 'alt_opening_1', 'alt_opening_2')}
    monkeypatch.setattr(mq.GroqClient, 'is_available', lambda *a: True)
    monkeypatch.setattr(mq.GroqClient, 'draft_outreach', lambda *a: draft)
    result = manager.run()
    assert result['no_site_qualified'] == 1 and result['ready_for_approval'] == 1
    assert written['Approval Queue'][0]['lead_type'] == 'NO_WEBSITE'
