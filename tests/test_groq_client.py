"""Tests for Groq AI drafting, factual grounding validation, word limits, and rate-limit backoff."""

import json
from unittest.mock import MagicMock, patch
import pytest
from src.groq_client import GroqClient


def test_validation_three_paragraphs_and_word_limit():
    client = GroqClient(api_key="gsk_mock_test_key")
    proof = "Our portfolio includes an invoicing, tax computation and financial operations web application."

    # Valid response: exactly 3 paragraphs, under 70 words, contains proof
    valid_result = {
        "subject": "Web portal review for Studio Alpha",
        "email_body": (
            "I noticed your studio portfolio is currently served over static pages without an interactive inquiry form.\n\n"
            f"{proof}\n\n"
            "Would you be open to a 5-minute conversation on streamlining client onboarding?"
        ),
        "alt_opening_1": "I was exploring Studio Alpha's architectural portfolio recently.",
        "alt_opening_2": "Your studio's online design projects caught my attention.",
        "observation_url": "https://studioalpha.com/contact",
    }

    research_data = {
        "page_contexts": [("Text snippet", "https://studioalpha.com/contact")],
        "observation_url": "https://studioalpha.com/contact",
    }

    sanitized = client._validate_and_sanitize(valid_result, proof, "https://studioalpha.com/contact", research_data)
    assert sanitized is not None
    assert sanitized["word_count"] <= 70
    assert sanitized["word_count"] > 20
    assert sanitized["alt_opening_1"] != ""
    assert sanitized["alt_opening_2"] != ""
    assert proof in sanitized["email_body"]


def test_validation_rejects_exceeding_word_limit():
    client = GroqClient(api_key="gsk_mock_test_key")
    proof = "Our portfolio includes an invoicing, tax computation and financial operations web application."

    # Long body exceeding 70 words
    long_body = "word " * 75
    paragraphs = f"{long_body}\n\n{proof}\n\nAre you available?"

    invalid_result = {
        "subject": "Test Subject",
        "email_body": paragraphs,
        "alt_opening_1": "Alt 1",
        "alt_opening_2": "Alt 2",
    }

    sanitized = client._validate_and_sanitize(invalid_result, proof, "https://example.com", {"page_contexts": []})
    assert sanitized is None


def test_validation_rejects_non_three_paragraphs():
    client = GroqClient(api_key="gsk_mock_test_key")
    proof = "Our portfolio includes an invoicing, tax computation and financial operations web application."

    # Only 2 paragraphs
    two_paragraphs = f"Paragraph 1 observation.\n\n{proof}"

    invalid_result = {
        "subject": "Test Subject",
        "email_body": two_paragraphs,
        "alt_opening_1": "Alt 1",
        "alt_opening_2": "Alt 2",
    }

    sanitized = client._validate_and_sanitize(invalid_result, proof, "https://example.com", {"page_contexts": []})
    assert sanitized is None


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
                    "email_body": f"Observation on your portal.\n\n{proof}\n\nAre you open to a brief chat?",
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
