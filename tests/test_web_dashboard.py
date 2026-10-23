"""Acceptance tests for OneFolk Web Dashboard: HTML integrity, real Google Sheet connectivity,
and safe reversible write validation on an isolated test record."""

import os
import json
import pytest
from src.sheets import SheetsManager

def test_appsscript_manifest_configuration():
    """Verify appsscript.json contains WebApp config and required OAuth scopes."""
    manifest_path = os.path.join("apps-script", "appsscript.json")
    assert os.path.exists(manifest_path), "apps-script/appsscript.json must exist"
    
    with open(manifest_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    assert "webapp" in data, "Manifest must declare webapp configuration"
    assert data["webapp"].get("executeAs") == "USER_ACCESSING", "webapp must execute as USER_ACCESSING for identity verification"
    assert "oauthScopes" in data
    assert "https://www.googleapis.com/auth/spreadsheets" in data["oauthScopes"]
    assert "https://www.googleapis.com/auth/userinfo.email" in data["oauthScopes"]


def test_html_dashboard_integrity():
    """Verify Index.html contains all 6 required dashboard sections, OneFolk branding, and no placeholders."""
    html_path = os.path.join("apps-script", "Index.html")
    assert os.path.exists(html_path), "apps-script/Index.html must exist"
    
    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Branding & Security
    assert "OneFolk Outreach OS" in content
    assert "SENDING LOCKED" in content or "headerSendingStatus" in content
    assert "headerUserEmail" in content

    # 2. Section 1: Overview
    assert "tab-overview" in content
    assert "Morning Target: 10 High-Priority Cold Email Drafts" in content
    assert "kpi-readyToReview" in content
    assert "kpi-approved" in content
    assert "kpi-sentToday" in content
    assert "kpi-bounced" in content
    assert "kpi-positiveReplies" in content
    assert "kpi-meetingsBooked" in content
    assert "kpi-convertedClients" in content

    # 3. Section 2: Approval Queue (Primary Screen)
    assert "tab-queue" in content
    assert "queueSearchInput" in content
    assert "leadsTable" in content
    assert "openLeadReview" in content
    assert "pill-awaiting" in content

    # 4. Section 3: Campaigns
    assert "tab-campaigns" in content
    assert "campaignsTable" in content

    # 5. Section 4: Sent & Replies
    assert "tab-replies" in content
    assert "repliesTable" in content

    # 6. Section 5: Settings & System Health
    assert "tab-health" in content
    assert "healthImplLock" in content
    assert "healthEnableSending" in content
    assert "healthMailQuota" in content
    assert "healthAdminList" in content

    # 7. Lead Detail & Cold Email Editor
    assert "reviewModal" in content
    assert "modalObservation" in content
    assert "modalObservationSourceUrl" in content
    assert "modalAltOpening1" in content
    assert "modalAltOpening2" in content
    assert "applyAltOpening" in content
    assert "editorSubject" in content
    assert "editorBody" in content
    assert "counterWords" in content
    assert "counterParas" in content
    assert "btnModalApprove" in content
    assert "btnModalReject" in content
    assert "btnModalNeedsResearch" in content

    # 8. Check that no fake placeholder data is hardcoded in the table bodies
    assert "Lorem ipsum" not in content
    assert "Acme Corp" not in content


@pytest.mark.skipif(os.getenv("RUN_LIVE_SHEET_READ_TESTS") != "YES", reason="Live Sheet reads require explicit opt-in")
def test_real_google_sheet_read_connection():
    """Verify live read connection to the existing master spreadsheet."""
    sm = SheetsManager()
    if not sm.raw_creds:
        pytest.skip("Live Google Sheet test skipped: GOOGLE_SERVICE_ACCOUNT_JSON not configured in environment")
    connected = sm.connect()
    assert connected is True, "Failed to connect to Google Sheets with service account"
    assert sm.spreadsheet is not None
    
    # Check all authoritative tabs exist
    titles = [ws.title for ws in sm.spreadsheet.worksheets()]
    required_tabs = [
        "Dashboard",
        "Lead Database",
        "Approval Queue",
        "Email Activity",
        "Suppression List",
        "Campaign Runs",
        "Settings",
        "Automation State",
        "Morning Health"
    ]
    for tab in required_tabs:
        assert tab in titles, f"Required tab '{tab}' missing from master spreadsheet"

    # Verify Approval Queue headers
    ws = sm.spreadsheet.worksheet("Approval Queue")
    headers = ws.row_values(1)
    for col in ["lead_id", "business", "public_email", "status", "approval", "email_body", "proof_line"]:
        assert col in headers, f"Approval Queue missing expected column '{col}'"


@pytest.mark.skipif(os.getenv("RUN_LIVE_SHEET_WRITE_TESTS") != "YES", reason="Live Sheet writes require explicit opt-in")
def test_safe_reversible_sheet_write_and_cleanup():
    """Perform a safe, reversible write test on an explicitly designated isolated test record,
    then clean it up completely, ensuring zero corruption to real outreach records."""
    sm = SheetsManager()
    if not sm.raw_creds:
        pytest.skip("Live Google Sheet test skipped: GOOGLE_SERVICE_ACCOUNT_JSON not configured in environment")
    assert sm.connect() is True
    
    # Target tab: Approval Audit (or insert temporary test audit record)
    ws = sm.spreadsheet.worksheet("Approval Audit") if "Approval Audit" in [w.title for w in sm.spreadsheet.worksheets()] else None
    if not ws:
        # If Approval Audit not yet present in Sheet, test against Settings tab
        ws = sm.ensure_tab("Settings", ["Parameter", "Configured Value", "Description", "Last Updated"])
        
    assert ws is not None
    test_key = "TEST_INTEGRATION_VERIFICATION_ISOLATED"
    test_val = "VERIFIED_OK_TIMESTAMP"
    
    # Append safe designated test record
    res = ws.append_row([test_key, test_val, "Temporary integration verification test row", "2026-10-22"], value_input_option="RAW")
    assert res is not None, "Failed to append test row"
    
    # Verify the test record was written
    all_values = ws.get_all_values()
    found_idx = None
    for i, row in enumerate(all_values):
        if row and row[0] == test_key:
            found_idx = i + 1  # 1-indexed for gspread
            break
            
    assert found_idx is not None, "Appended verification test row was not found in readback"
    
    # Immediately clean up the test row
    ws.delete_rows(found_idx)
    
    # Verify cleanup succeeded
    all_values_after = ws.get_all_values()
    assert not any(row and row[0] == test_key for row in all_values_after), "Test row was not cleaned up"
