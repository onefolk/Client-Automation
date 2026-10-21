"""Tests for Google Sheets schema initialization, idempotent updates, and dashboard KPIs."""

from unittest.mock import MagicMock, patch
import pytest
from src.sheets import (
    SheetsManager,
    TAB_APPROVAL_QUEUE,
    TAB_CAMPAIGN_RUNS,
    TAB_DASHBOARD,
    TAB_EMAIL_ACTIVITY,
    TAB_LEAD_DATABASE,
    TAB_SETTINGS,
    TAB_SUPPRESSION_LIST,
)


def test_initialize_schema():
    manager = SheetsManager(spreadsheet_id="test_sheet_id", service_account_json='{"mock": "creds"}')
    manager.spreadsheet = MagicMock()

    created_tabs = []
    def mock_ensure_tab(name, headers, rows=1000):
        created_tabs.append(name)
        return MagicMock()

    manager.ensure_tab = mock_ensure_tab
    manager.initialize_schema()

    expected_tabs = [
        TAB_DASHBOARD,
        TAB_LEAD_DATABASE,
        TAB_APPROVAL_QUEUE,
        TAB_EMAIL_ACTIVITY,
        TAB_SUPPRESSION_LIST,
        TAB_CAMPAIGN_RUNS,
        TAB_SETTINGS,
    ]
    for tab in expected_tabs:
        assert tab in created_tabs


def test_idempotent_upsert_leads():
    manager = SheetsManager(spreadsheet_id="test_sheet_id")
    manager.spreadsheet = MagicMock()

    mock_ws = MagicMock()
    manager.ensure_tab = MagicMock(return_value=mock_ws)
    # Existing lead ID is "lead_123"
    manager.get_existing_lead_ids = MagicMock(return_value={"lead_123"})

    leads = [
        {"lead_id": "lead_123", "business": "Duplicate Lead"},
        {"lead_id": "lead_456", "business": "New Lead"},
    ]

    inserted = manager.upsert_leads(leads)
    assert inserted == 1  # Only lead_456 is inserted
    mock_ws.append_rows.assert_called_once()
    appended_rows = mock_ws.append_rows.call_args[0][0]
    assert len(appended_rows) == 1
    assert appended_rows[0][0] == "lead_456"


def test_dashboard_kpis_calculation():
    manager = SheetsManager(spreadsheet_id="test_sheet_id")
    manager.spreadsheet = MagicMock()

    mock_dash = MagicMock()
    manager.ensure_tab = MagicMock(return_value=mock_dash)

    metrics = {
        "prospects_discovered": 100,
        "prospects_scraped": 95,
        "qualified_leads": 80,
        "needs_research": 15,
        "emails_drafted": 75,
        "duration_seconds": 120,
        "ai_calls_used": 75,
    }

    manager.update_dashboard(metrics)

    mock_dash.clear.assert_called_once()
    mock_dash.update.assert_called_once()
    update_kwargs = mock_dash.update.call_args[1]
    rows = update_kwargs["values"]

    # Verify key dashboard rows
    metric_map = {r[0]: r[1] for r in rows}
    assert metric_map["Prospects discovered"] == 100
    assert metric_map["Emails drafted"] == 75
    assert metric_map["Actual spending"] == "₹0.00"
