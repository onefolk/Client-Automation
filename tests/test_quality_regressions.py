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

