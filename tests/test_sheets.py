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


def test_reserve_store_quoted_range_and_bulk_appends():
    from src.reserve import ReserveStore

    sheets = MagicMock()
    ws = MagicMock()
    ws.get_all_records.return_value = []
    sheets.ensure_tab.return_value = ws

    store = ReserveStore(sheets)

    # 1. Single put with quoted range like "'Automation State'!A3:C3"
    ws.append_row.return_value = {
        "updates": {"updatedRange": "'Automation State'!A3:C3"}
    }
    store.put("key1", {"foo": "bar"})
    assert store.indices["key1"] == 3

    # 2. Bulk put with quoted range
    ws.append_rows.return_value = {
        "updates": {"updatedRange": "'Automation State'!A4:C5"}
    }
    store.put_many_new({"key2": {"v": 2}, "key3": {"v": 3}})
    assert store.indices["key2"] == 4
    assert store.indices["key3"] == 5


def test_append_records_prevents_overwriting_concurrent_approvals():
    from src.reserve import append_records

    sheets = MagicMock()
    ws = MagicMock()
    # Initial snapshot taken at T0: lead_100 was PENDING / AWAITING_REVIEW
    ws.get_all_records.return_value = [
        {"lead_id": "lead_100", "status": "AWAITING_REVIEW", "approval": "PENDING", "business": "Acme", "reviewer_notes": ""}
    ]
    columns = ["lead_id", "status", "approval", "business", "reviewer_notes"]
    # At T1, a human approved it in the live sheet
    ws.row_values.side_effect = lambda idx: columns if idx == 1 else ["lead_100", "APPROVED", "APPROVED", "Acme", "Looks good"]
    ws.col_count = 5
    sheets.ensure_tab.return_value = ws

    # At T2, pipeline attempts to refresh lead_100
    records = [{"lead_id": "lead_100", "status": "AWAITING_REVIEW", "approval": "PENDING", "business": "Acme New"}]
    append_records(sheets, "Approval Queue", records, refresh_pending=True)

    # ws.update must NOT have been called on row 2 because live state is APPROVED
    ws.update.assert_not_called()


def test_reserve_store_recovers_row_or_raises_never_guesses():
    from src.reserve import ReserveStore

    sheets = MagicMock()
    ws = MagicMock()
    ws.get_all_records.return_value = []
    sheets.ensure_tab.return_value = ws

    store = ReserveStore(sheets)

    # 1. Unparseable response -> recovers actual row from column A
    ws.append_row.return_value = {}  # No updates.updatedRange
    ws.col_values.return_value = ["key", "existing_key", "recovered_key"]
    store.put("recovered_key", {"v": 1})
    assert store.indices["recovered_key"] == 3

    # 2. Unparseable response and not in column A -> raises RuntimeError (never guesses)
    ws.col_values.return_value = ["key", "other_key"]
    with pytest.raises(RuntimeError, match="Failed to determine durable checkpoint row index"):
        store.put("missing_key", {"v": 2})

    # 3. Bulk put unparseable response -> recovers start row from column A
    ws.append_rows.return_value = None
    ws.col_values.return_value = ["key", "k1", "k2", "bulk1", "bulk2"]
    store.put_many_new({"bulk1": {"b": 1}, "bulk2": {"b": 2}})
    assert store.indices["bulk1"] == 4
    assert store.indices["bulk2"] == 5

    # 4. Bulk put unparseable and not in column A -> raises RuntimeError
    ws.col_values.return_value = ["key"]
    with pytest.raises(RuntimeError, match="Failed to determine durable checkpoint start row"):
        store.put_many_new({"not_found_1": {"x": 1}})



@pytest.mark.parametrize('status', ['AWAITING_REVIEW', 'NEEDS_RESEARCH', 'APPROVED', 'SENDING', 'SENT'])
def test_pipeline_cannot_mutate_existing_queue_row(status):
    from src.reserve import transactional_update_row
    ws = MagicMock()
    assert not transactional_update_row(ws, 2, ['status'], {'status':status},
                                        {'status':'AWAITING_REVIEW'}, 'Approval Queue')
    ws.row_values.assert_not_called()
    ws.update.assert_not_called()
    ws.batch_update.assert_not_called()


@pytest.mark.parametrize('race', [False, True])
def test_requalification_appends_revision_without_touching_original(race):
    import copy
    from src.reserve import append_records
    columns = ['lead_id','business','status','approval','email_body','reviewer_notes','last_verified_at']
    original = dict(zip(columns, ['lead1','Acme','NEEDS_RESEARCH','PENDING','old human text','keep note','old']))
    class Worksheet:
        col_count = len(columns)
        def __init__(self): self.rows = [copy.deepcopy(original)]
        def get_all_records(self):
            snapshot = copy.deepcopy(self.rows)
            if race: self.rows[0].update(status='APPROVED', approval='APPROVED', email_body='approved human text')
            return snapshot
        def row_values(self, index):
            assert index == 1, 'Existing queue rows must never be fetched for overwrite'
            return columns
        def append_rows(self, rows, **kwargs):
            assert kwargs['value_input_option'] == 'RAW'
            self.rows.extend(dict(zip(columns, r)) for r in rows)
        def update(self, **kwargs): raise AssertionError('Existing queue was overwritten')
        def batch_update(self, *args, **kwargs): raise AssertionError('Existing queue was overwritten')
    ws = Worksheet()
    sheets = MagicMock(); sheets.ensure_tab.return_value = ws
    new = {**original, 'status':'AWAITING_REVIEW', 'email_body':'new verified draft', 'last_verified_at':'new'}
    assert append_records(sheets, 'Approval Queue', [new], refresh_pending=True) == 1
    assert ws.rows[0]['email_body'] == ('approved human text' if race else 'old human text')
    assert ws.rows[0]['status'] == ('APPROVED' if race else 'NEEDS_RESEARCH')
    assert ws.rows[0]['reviewer_notes'] == 'keep note'
    revision = ws.rows[1]
    assert revision['lead_id'].startswith('lead1_rev_')
    assert revision['status'] == 'AWAITING_REVIEW' and revision['approval'] == 'PENDING'
    assert revision['email_body'] == 'new verified draft'
    assert append_records(sheets, 'Approval Queue', [new], refresh_pending=True) == 0
    assert len(ws.rows) == 2
