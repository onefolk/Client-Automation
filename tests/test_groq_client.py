"""Tests for Groq AI drafting, factual grounding validation, word limits, and rate-limit backoff."""

import json
from unittest.mock import MagicMock, patch
import pytest
from src.groq_client import GroqClient


def test_validation_four_paragraphs_and_word_limit():
    client = GroqClient(api_key="gsk_mock_test_key")
    proof = "Our portfolio includes an invoicing, tax computation and financial operations web application."

    # Valid response: exactly 4 paragraphs, 45-70 words target (40-120 valid), contains proof
    valid_result = {
        "subject": "Web portal review for Studio Alpha",
        "email_body": (
            "We noticed that your studio portfolio is currently served over static pages without an interactive inquiry form.\n\n"
            "Introducing an interactive consultation booking workflow could help prospective clients schedule consultations much more seamlessly.\n\n"
            f"At OneFolk, {proof.lower()}\n\n"
            "Could you connect us with the person responsible for your website updates?"
        ),
        "alt_opening_1": "We were exploring Studio Alpha's architectural portfolio recently.",
        "alt_opening_2": "Your studio's online design projects caught our attention.",
        "opportunity": "Improve consultation inquiries",
        "observation_url": "https://studioalpha.com/contact",
    }

    research_data = {
        "page_contexts": [("Text snippet", "https://studioalpha.com/contact")],
        "observation_url": "https://studioalpha.com/contact",
    }

    sanitized = client._validate_and_sanitize(valid_result, proof, "https://studioalpha.com/contact", research_data)
    assert sanitized is not None
    assert 40 <= sanitized["word_count"] <= 120
    assert sanitized["alt_opening_1"] != ""
    assert sanitized["alt_opening_2"] != ""
    assert proof.lower() in sanitized["email_body"].lower()


def test_validation_rejects_exceeding_word_limit():
    client = GroqClient(api_key="gsk_mock_test_key")
    proof = "Our portfolio includes an invoicing, tax computation and financial operations web application."

    # Long body exceeding 150 words
    long_body = "word " * 160
    paragraphs = f"{long_body}\n\nRecommendation paragraph.\n\nAt OneFolk, {proof}\n\nCould we discuss this?"

    invalid_result = {
        "subject": "Specific website page update",
        "opportunity": "Improve website information",
        "email_body": paragraphs,
        "alt_opening_1": "Alt 1",
        "alt_opening_2": "Alt 2",
    }

    sanitized = client._validate_and_sanitize(invalid_result, proof, "https://example.com", {"page_contexts": []})
    assert sanitized is None


def test_validation_rejects_non_four_paragraphs():
    client = GroqClient(api_key="gsk_mock_test_key")
    proof = "Our portfolio includes an invoicing, tax computation and financial operations web application."

    # Only 2 paragraphs
    two_paragraphs = f"Paragraph 1 observation.\n\n{proof}"
    invalid_result_2 = {
        "subject": "Specific website page update",
        "opportunity": "Improve website information",
        "email_body": two_paragraphs,
        "alt_opening_1": "Alt 1",
        "alt_opening_2": "Alt 2",
    }
    assert client._validate_and_sanitize(invalid_result_2, proof, "https://example.com", {"page_contexts": []}) is None

    # Only 3 paragraphs
    three_paragraphs = f"Observation paragraph.\n\nRecommendation paragraph.\n\n{proof}"
    invalid_result_3 = {
        "subject": "Specific website page update",
        "opportunity": "Improve website information",
        "email_body": three_paragraphs,
        "alt_opening_1": "Alt 1",
        "alt_opening_2": "Alt 2",
    }
    assert client._validate_and_sanitize(invalid_result_3, proof, "https://example.com", {"page_contexts": []}) is None


def test_groq_quota_exhaustion_stops_gracefully():
    client = GroqClient(api_key="gsk_mock_test_key", max_calls=2)
    assert client.is_available()

    client.calls_used = 2
    assert not client.is_available()

    # Draft outreach returns None immediately without network calls
    res = client.draft_outreach({}, {})
    assert res is None


def test_groq_rate_limit_backoff():
    client = GroqClient(api_key="gsk_mock_test_key", max_calls=5)

    mock_429 = MagicMock()
    mock_429.status_code = 429
    mock_429.headers = {"Retry-After": "0.1"}

    mock_200 = MagicMock()
    mock_200.status_code = 200
    proof = "Our team designed and built the OneFolk website."
    mock_200.json.return_value = {
        "choices": [{
            "message": {
                "content": json.dumps({
                    "subject": "Quick web review",
                    "opportunity": "Simplify consultation bookings",
                    "email_body": (
                        "We noticed that your web portal currently provides general information without an interactive consultation booking workflow.\n\n"
                        "Introducing a dedicated digital scheduling and client intake flow could make booking inquiries significantly faster for your visitors.\n\n"
                        f"{proof} We help organizations create high-performance web applications and streamlined digital tools.\n\n"
                        "Could you connect us with the team member responsible for your digital portal updates?"
                    ),
                    "alt_opening_1": "Alt 1",
                    "alt_opening_2": "Alt 2",
                })
            }
        }]
    }

    with patch("requests.post", side_effect=[mock_429, mock_200]):
        draft = client.draft_outreach(
            {"name": "Test Co", "website": "https://test.co"},
            {
                "proof_project": "OneFolk website",
                "proof_line": proof,
                "observation": "Observation",
                "observation_url": "https://test.co",
                "page_contexts": [("Text", "https://test.co")],
            },
        )
        assert draft is not None
        assert draft["subject"] == "Quick web review"
        assert client.calls_used == 2


from tests.test_email_validator import BODY, OBSERVATION


def official_draft():
    return dict(subject='Course outcomes page update', email_body=BODY,
        alt_opening_1='Your BCA course outcomes page is marked under construction.',
        alt_opening_2='We noticed the construction notice on your BCA outcomes page.',
        opportunity='Add programme outcomes and syllabus information.', skip=False)


def test_prompt_schema_envelope_and_natural_strict_cta(monkeypatch):
    client = GroqClient(api_key='test', model='openai/gpt-oss-120b')
    response = MagicMock(status_code=200)
    response.json.return_value = {'choices':[{'message':{'content':json.dumps(official_draft())}}]}
    post = MagicMock(return_value=response)
    monkeypatch.setattr('src.groq_client.requests.post', post)
    result = client.draft_outreach({'business':'Swarnandhra College'}, {
        'strict_grounding':True, 'observation':OBSERVATION,
        'observation_url':'https://example.edu/bca',
        'page_contexts':[(OBSERVATION, 'https://example.edu/bca')]})
    assert result is not None
    assert result['email_body'].startswith('Dear Swarnandhra College Team,\n\n')
    assert result['email_body'].endswith('Regards,\nTeam OneFolk\nhttps://onefolk.in/')
    assert 'Would online submission' not in result['email_body']
    assert 'Our team designed' not in result['email_body']
    assert result['word_count'] == len(BODY.split())
    payload = post.call_args.kwargs['json']
    schema = payload['response_format']['json_schema']['schema']
    assert 'opportunity' in schema['required']
    prompt = json.loads(payload['messages'][1]['content'])
    assert '50-90' in prompt['task']
    assert 'my company' in payload['messages'][0]['content']


@pytest.mark.parametrize('field,value', [
    ('subject','Update'), ('subject','One two three four five six seven eight'),
    ('alt_opening_1',"I've noticed your course page."),
    ('alt_opening_2','My team saw your page.'), ('opportunity','Unlock your business potential'),
    ('alt_opening_1',''), ('opportunity',None), ('email_body', ['not text']),
])
def test_reject_bad_fields(field, value):
    raw = official_draft(); raw[field] = value
    assert GroqClient(api_key='test')._validate_and_sanitize(raw, '', '', {}) is None


def test_no_silent_proof_repair_and_no_duplicate_openings():
    client = GroqClient(api_key='test')
    raw = official_draft(); raw['email_body'] = BODY.replace('At OneFolk,', 'I work here and')
    assert client._validate_and_sanitize(raw, 'At OneFolk, we improve websites.', '', {}) is None
    raw = official_draft(); raw['alt_opening_2'] = raw['alt_opening_1'].upper()
    assert client._validate_and_sanitize(raw, '', '', {}) is None


def test_grounding_and_url_mismatch_fail_closed():
    client = GroqClient(api_key='test')
    assert client._validate_and_sanitize(official_draft(), '', '', {
        'strict_grounding':True, 'observation':'A different verified observation.'}) is None
    assert client._validate_and_sanitize(official_draft(), '', 'https://wrong.edu', {
        'page_contexts': [('Evidence','https://right.edu')]}) is None


@pytest.mark.parametrize('claim', [
    '500% growth',
    '$500 revenue',
    '₹500 revenue',
    '100 percent increase',
    '50% higher',
    '10x growth',
    '£500 profit',
    '€500 value',
])
def test_metric_and_currency_claims_rejected(claim):
    client = GroqClient(api_key='test')
    raw = official_draft()
    raw['email_body'] = raw['email_body'].replace('could help prospective students', f'could help prospective students achieve {claim}')
    assert client._validate_and_sanitize(raw, '', '', {}) is None



def test_capability_sentence_matches_industry_and_service():
    from src.groq_client import capability_sentence
    assert capability_sentence('education', 'Website content and UX improvements') == \
        'At OneFolk, we help institutions improve website content and structure.'
    assert 'clinics and hospitals' in capability_sentence('healthcare', 'Website design and development')
    assert capability_sentence('unknown', None).startswith('At OneFolk, we help businesses')
