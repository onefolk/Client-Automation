"""Tests for fail-fast credential preflight validation and malformed secret detection."""

import json
from unittest.mock import MagicMock, patch
import pytest
from src.config import validate_credentials
from src.groq_client import GroqClient
from src.cli import preflight_check


@pytest.fixture
def valid_env(monkeypatch):
    """Sets a complete and structurally valid set of test credentials."""
    mock_sa = {
        "type": "service_account",
        "project_id": "test-project",
        "private_key_id": "key123",
        "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----\n",
        "client_email": "bot@test-project.iam.gserviceaccount.com",
    }
    monkeypatch.setenv("SHEET_ID", "1U3JxQUcxSyqfZySnHNdLIwExtr3ikfcYlj0a3YY7ATM")
    monkeypatch.setenv("GOOGLE_SERVICE_ACCOUNT_JSON", json.dumps(mock_sa))
    monkeypatch.setenv("GROQ_API_KEY", "gsk_mock_test_key_with_at_least_20_characters")
    return mock_sa


def test_validate_credentials_success(valid_env):
    details = validate_credentials(require_groq=True, require_sheets=True)
    assert details["sheet_id_length"] == 44
    assert details["service_account_email"] == "bot@test-project.iam.gserviceaccount.com"
    assert details["groq_configured"] is True


def test_validate_credentials_missing_service_account(valid_env, monkeypatch):
    monkeypatch.setenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    with pytest.raises(ValueError) as excinfo:
        validate_credentials(require_groq=True, require_sheets=True)
    assert "GOOGLE_SERVICE_ACCOUNT_JSON is missing or empty" in str(excinfo.value)
    # Ensure no secret values are leaked
    assert "gsk_" not in str(excinfo.value)


def test_validate_credentials_malformed_json(valid_env, monkeypatch):
    monkeypatch.setenv("GOOGLE_SERVICE_ACCOUNT_JSON", "not a json string {")
    with pytest.raises(ValueError) as excinfo:
        validate_credentials(require_groq=True, require_sheets=True)
    assert "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON" in str(excinfo.value)


def test_validate_credentials_missing_sa_fields(valid_env, monkeypatch):
    incomplete_sa = {"type": "service_account", "client_email": "bot@test.com"}
    monkeypatch.setenv("GOOGLE_SERVICE_ACCOUNT_JSON", json.dumps(incomplete_sa))
    with pytest.raises(ValueError) as excinfo:
        validate_credentials(require_groq=True, require_sheets=True)
    assert "missing required fields: private_key" in str(excinfo.value)


def test_validate_credentials_invalid_sa_type(valid_env, monkeypatch):
    wrong_type_sa = {
        "type": "authorized_user",
        "client_email": "bot@test.com",
        "private_key": "-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----\n",
    }
    monkeypatch.setenv("GOOGLE_SERVICE_ACCOUNT_JSON", json.dumps(wrong_type_sa))
    with pytest.raises(ValueError) as excinfo:
        validate_credentials(require_groq=True, require_sheets=True)
    assert "'type' must be 'service_account'" in str(excinfo.value)


def test_validate_credentials_missing_groq_key(valid_env, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "")
    with pytest.raises(ValueError) as excinfo:
        validate_credentials(require_groq=True, require_sheets=True)
    assert "GROQ_API_KEY is missing or empty" in str(excinfo.value)


def test_validate_credentials_malformed_groq_key(valid_env, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "invalid_prefix_key_1234567890")
    with pytest.raises(ValueError) as excinfo:
        validate_credentials(require_groq=True, require_sheets=True)
    assert "GROQ_API_KEY appears malformed" in str(excinfo.value)


def test_groq_test_connection_success():
    client = GroqClient(api_key="gsk_mock_valid_key_1234567890")
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    with patch("requests.get", return_value=mock_resp) as mock_get:
        assert client.test_connection() is True
        mock_get.assert_called_once()
        assert "Authorization" in mock_get.call_args[1]["headers"]


def test_groq_test_connection_auth_failure():
    client = GroqClient(api_key="gsk_mock_invalid_key_12345678")
    mock_resp = MagicMock()
    mock_resp.status_code = 401
    with patch("requests.get", return_value=mock_resp):
        assert client.test_connection() is False


def test_preflight_check_fails_on_missing_env(monkeypatch):
    monkeypatch.setenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    monkeypatch.setenv("GROQ_API_KEY", "")
    assert preflight_check() is False


def test_preflight_check_without_groq(valid_env, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "")
    with patch("src.sheets.SheetsManager.connect", return_value=True):
        assert preflight_check(require_groq=False) is True

