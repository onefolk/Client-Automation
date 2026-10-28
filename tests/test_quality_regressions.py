from unittest.mock import Mock
from src import verifier
from src.groq_client import GroqClient

def test_no_dns_and_null_mx_never_pass(monkeypatch):
    verifier.MX_CACHE.clear()
    monkeypatch.setattr(verifier,'DNS_AVAILABLE',False)
    assert not verifier.has_valid_mx_records('fixture.edu')
    monkeypatch.setattr(verifier,'DNS_AVAILABLE',True)
    answer=Mock(exchange='.')
    resolver=Mock(); resolver.resolve.return_value=[answer]
    monkeypatch.setattr(verifier.dns.resolver,'Resolver',lambda:resolver)
    assert not verifier.has_valid_mx_records('nullmx.edu')

def test_invalid_local_and_domain_syntax():
    for email in ('a..b@fixture.edu','.a@fixture.edu','a.@fixture.edu','a@-fixture.edu','a@fixture..edu'):
        assert not verifier.is_valid_syntax(email)

def test_retry_loop_cannot_exceed_reserved_budget(monkeypatch):
    client=GroqClient(api_key='test',max_calls=1)
    response=Mock(status_code=429,headers={'Retry-After':'0'})
    post=Mock(return_value=response)
    monkeypatch.setattr('src.groq_client.requests.post',post)
    monkeypatch.setattr('src.groq_client.time.sleep',lambda _:None)
    assert client.draft_outreach({"name": "Fixture Business"}, {}) is None
    assert post.call_count==1


def test_timetable_never_matches_restaurant_table():
    from src.strict_research import StrictResearcher, workflow_opportunity, workflow_project
    researcher = StrictResearcher(fetcher=None)
    obs, url, obs_type = researcher._formulate_observation(
        "https://college.edu",
        [("Download the Semester Examination Timetable 2026. Hall tickets available.", "https://college.edu/exams")],
        {"has_https": True, "has_mobile_viewport": True}
    )
    assert obs_type == "NEEDS_RESEARCH"
    assert "table" not in obs.lower()
    assert workflow_project("Download Semester Exam Timetable")['project'] == 'OneFolk website'
    assert workflow_opportunity("education", "MANUAL_WORKFLOW", "Examination Timetable 2026") == ""


def test_academic_syllabus_pdf_never_treated_as_broken_application():
    from src.strict_research import StrictResearcher
    researcher = StrictResearcher(fetcher=None)
    obs, url, obs_type = researcher._formulate_observation(
        "https://college.edu",
        [("Download the BCA syllabus and curriculum PDF. View academic regulations.", "https://college.edu/academics")],
        {"has_https": True, "has_mobile_viewport": True}
    )
    assert obs_type == "NEEDS_RESEARCH"


def test_online_admission_portal_never_treated_as_offline_workflow():
    from src.strict_research import StrictResearcher
    researcher = StrictResearcher(fetcher=None)
    obs, url, obs_type = researcher._formulate_observation(
        "https://school.edu",
        [("Admissions open! Apply online via our admission portal. Download the admission form and submit in person if needed.", "https://school.edu/admissions")],
        {"has_https": True, "has_mobile_viewport": True}
    )
    assert obs_type == "NEEDS_RESEARCH"


def test_government_counselling_never_treated_as_replaceable_workflow():
    from src.strict_research import StrictResearcher
    researcher = StrictResearcher(fetcher=None)
    obs, url, obs_type = researcher._formulate_observation(
        "https://engineering.edu",
        [("Admissions to B.Tech are conducted exclusively via TNEA centralised counselling code 1234. Submit application form to TNEA office.", "https://engineering.edu/admissions")],
        {"has_https": True, "has_mobile_viewport": True}
    )
    assert obs_type == "NEEDS_RESEARCH"


def test_standard_contact_email_never_treated_as_intake_defect():
    from src.strict_research import StrictResearcher
    researcher = StrictResearcher(fetcher=None)
    obs, url, obs_type = researcher._formulate_observation(
        "https://studio.com",
        [("For general queries and contact details, please email info@studio.com or call our office.", "https://studio.com/contact")],
        {"has_https": True, "has_mobile_viewport": True}
    )
    assert obs_type == "NEEDS_RESEARCH"


def test_under_construction_page_recognized_as_technical_opportunity():
    from src.strict_research import StrictResearcher
    researcher = StrictResearcher(fetcher=None)
    obs, url, obs_type = researcher._formulate_observation(
        "https://college.edu",
        [("BCA Programme: Website Under Construction. Information will follow.", "https://college.edu/bca")],
        {"has_https": True, "has_mobile_viewport": True}
    )
    assert obs_type == "PAGE_UNDER_CONSTRUCTION"
    assert "under construction" in obs.lower()
    assert url == "https://college.edu/bca"



def test_unrelated_construction_text_is_not_a_page_observation():
    from src.strict_research import StrictResearcher
    researcher = StrictResearcher(fetcher=None)
    obs, url, obs_type = researcher._formulate_observation(
        "https://college.edu",
        [("Road work: the bypass near campus is under construction until March.", "https://college.edu/news")],
        {"has_https": True, "has_mobile_viewport": True}
    )
    assert obs_type == "NEEDS_RESEARCH"


def test_serialize_store_value_keeps_draft_record_when_oversized():
    import json
    from src.reserve import serialize_store_value
    value = {'company_id': 'c1', 'name': 'X', 'website': 'https://x.in', 'state': 'QUEUED',
             'record': {'subject': 'Hi', 'email_body': 'Body'},
             'research': {'page_contexts': [('a' * 60000, 'u')]}, 'blob': ['z' * 900] * 100}
    out = json.loads(serialize_store_value(value, max_chars=3000))
    assert out['record']['subject'] == 'Hi'


def test_open_discovery_falls_back_to_osm_when_serper_empty(monkeypatch):
    from src import open_discovery
    monkeypatch.setenv('SERPER_API_KEY', 'k')
    monkeypatch.setattr('src.serper_discovery.SerperDiscovery.harvest', lambda self: ([], []))
    monkeypatch.setattr(open_discovery.OpenDiscovery, '_harvest_osm', lambda self: ([{'x': 1}], []))
    d, errs = open_discovery.OpenDiscovery(object(), {}).harvest()
    assert d == [{'x': 1}]


def test_unused_groq_allowance_is_refunded_in_source():
    import inspect
    from src import morning_queue
    src = inspect.getsource(morning_queue)
    assert "unused=calls-groq.calls_used" in src and "budget['batches'] >= 6" in src


def _observe(contexts, signals, year=2026, monkeypatch=None):
    from src.strict_research import StrictResearcher
    base = {"has_https": True, "has_mobile_viewport": True}
    base.update(signals)
    return StrictResearcher(fetcher=None)._formulate_observation("https://site.in", contexts, base)


def test_stale_copyright_is_a_quotable_observation(monkeypatch):
    monkeypatch.setattr('src.strict_research.current_year', lambda: 2026)
    obs, url, kind = _observe([("Welcome to our school.", "https://site.in")], {"copyright_year": 2019})
    assert kind == "STALE_COPYRIGHT" and "© 2019" in obs and url == "https://site.in"
    assert _observe([("Welcome", "https://site.in")], {"copyright_year": 2025})[2] == "NEEDS_RESEARCH"
    assert _observe([("Welcome", "https://site.in")], {"copyright_year": 2024})[2] == "STALE_COPYRIGHT"


def test_legacy_marker_and_placeholder_text(monkeypatch):
    monkeypatch.setattr('src.strict_research.current_year', lambda: 2026)
    obs, _, kind = _observe([("Hello", "https://site.in")], {"legacy_marker": "Best viewed in Internet Explorer 8"})
    assert kind == "LEGACY_SITE_MARKER" and "Internet Explorer 8" in obs
    obs, url, kind = _observe([("Lorem ipsum dolor sit amet", "https://site.in/about")], {})
    assert kind == "PLACEHOLDER_CONTENT" and url == "https://site.in/about"


def test_stronger_evidence_outranks_new_weak_signals(monkeypatch):
    monkeypatch.setattr('src.strict_research.current_year', lambda: 2026)
    _, _, kind = _observe([("Website under construction. Lorem ipsum", "https://site.in")],
                          {"copyright_year": 2015, "legacy_marker": "Best viewed in IE 6"})
    assert kind == "PAGE_UNDER_CONSTRUCTION"


def test_signal_extraction_reads_footer_markers_and_placeholder():
    from src.research import extract_website_signals
    html = ('<html><body><p>Lorem ipsum dolor sit amet</p>'
            '<footer>Best viewed in Internet Explorer 8 at 1024x768 &copy; 2018 Foo</footer></body></html>')
    sig = extract_website_signals(html, "http://a.in")
    assert sig["placeholder_text"] is True and sig["copyright_year"] == 2018
    assert sig["legacy_marker"].startswith("Best viewed in Internet Explorer 8")
    clean = extract_website_signals("<body>A modern responsive site</body>", "https://a.in")
    assert clean["legacy_marker"] == "" and clean["placeholder_text"] is False


def test_new_observation_types_have_opportunities():
    from src.strict_research import workflow_opportunity
    for kind in ("STALE_COPYRIGHT", "LEGACY_SITE_MARKER", "PLACEHOLDER_CONTENT"):
        assert workflow_opportunity("education", kind, "x")
