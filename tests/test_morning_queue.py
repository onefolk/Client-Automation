"""Tests for the 9 AM Morning Outreach Queue orchestrator and evergreen reserve."""

from unittest.mock import MagicMock, patch
import pytest

from src.morning_queue import MorningQueueManager, validate_queued_draft


def test_morning_queue_audit_and_maintenance():
    manager = MorningQueueManager(target_queue=50, dry_run=True)
    manager.sheets.spreadsheet = MagicMock()

    mock_ws = MagicMock()
    manager.sheets.spreadsheet.worksheet.return_value = mock_ws
    mock_ws.get_all_records.return_value = [
        {
            "lead_id": "lead_1",
            "business": "PES University",
            "public_email": "admissions@pes.edu",
            "email_source_url": "https://pes.edu/contact",
            "website": "https://pes.edu",
            "observation": "Inquiries use mailto links rather than structured forms.",
            "observation_url": "https://pes.edu/admissions",
            "proof_project": "Campus Kiosk",
            "proof_line": "Our portfolio includes a multi-vendor campus ordering web application.",
            "subject": "Web workflow inquiry for PES University",
            "email_body": "Paragraph 1 observation on admissions.\n\nOur portfolio includes a multi-vendor campus ordering web application.\n\nWould you be open to a 5-minute call?",
            "alt_opening_1": "I was reviewing PES University's digital resources.",
            "alt_opening_2": "Your admissions portal came to my attention.",
            "status": "DRAFTED",
            "approval": "",
            "created_at": "2026-10-21T18:00:00Z",
        },
        {
            "lead_id": "lead_2",
            "business": "Old Lead",
            "public_email": "info@oldlead.com",
            "website": "https://oldlead.com",
            "status": "DRAFTED",
            "approval": "",
            "created_at": "2025-01-01T10:00:00Z",  # Stale > 14 days
        },
        {
            "lead_id": "lead_3",
            "business": "Suppressed Lead",
            "public_email": "info@drkumudiniaestheticgynae.com",  # On suppression list
            "website": "https://drkumudiniaestheticgynae.com",
            "status": "DRAFTED",
            "approval": "",
            "created_at": "2026-10-21T18:00:00Z",
        },
        {
            "lead_id": "lead_4",
            "business": "Sent Lead",
            "public_email": "info@sent.com",
            "website": "https://sent.com",
            "status": "SENT",
            "approval": "APPROVED",
            "created_at": "2026-10-20T10:00:00Z",
        },
        {
            "lead_id": "lead_5",
            "business": "Incomplete Lead",
            "public_email": "info@incomplete.edu",
            "website": "https://incomplete.edu",
            "status": "DRAFTED",
            "approval": "",
            "created_at": "2026-10-21T18:00:00Z",
            # Missing email_body, observation, proof
        },
    ]

    valid_drafts, stale_count, supp_count, unready_count = manager.audit_existing_queue()

    assert len(valid_drafts) == 1
    assert valid_drafts[0]["lead_id"] == "lead_1"
    assert stale_count == 1
    assert supp_count == 1
    assert unready_count == 1


def test_validate_queued_draft():
    compliant = {
        "business": "PES University",
        "website": "https://pes.edu",
        "public_email": "admissions@pes.edu",
        "email_source_url": "https://pes.edu/contact",
        "observation": "Public portal inquiry observation",
        "observation_url": "https://pes.edu/admissions",
        "subject": "Web workflow inquiry",
        "email_body": "P1 observation.\n\nOur team designed and built the OneFolk website.\n\nOpen to a brief call?",
        "alt_opening_1": "Alt 1",
        "alt_opening_2": "Alt 2",
    }
    is_ok, reason = validate_queued_draft(compliant)
    assert is_ok is True
    assert reason == "READY"

    # Missing email source URL
    missing_src = {**compliant, "email_source_url": ""}
    is_ok, reason = validate_queued_draft(missing_src)
    assert is_ok is False
    assert "Missing contact provenance" in reason

    # Body exceeding 70 words
    long_body = {**compliant, "email_body": "word " * 75}
    is_ok, reason = validate_queued_draft(long_body)
    assert is_ok is False
    assert "70-word limit" in reason or "3 paragraphs" in reason


def test_morning_queue_draw_from_backlog_deficit():
    manager = MorningQueueManager(target_queue=2, dry_run=True)
    manager.sheets.spreadsheet = MagicMock()

    # Lead Database has 1 qualified un-drafted lead
    mock_db_ws = MagicMock()
    mock_db_ws.get_all_records.return_value = [
        {
            "lead_id": "lead_100",
            "business": "Backlog Tech Institute",
            "qualification_status": "QUALIFIED",
            "website": "https://backlog.edu",
            "public_email": "info@backlog.edu",
        }
    ]
    manager.sheets.spreadsheet.worksheet.return_value = mock_db_ws

    undrafted = manager.get_undrafted_leads(existing_draft_ids={"lead_already_drafted"})
    assert len(undrafted) == 1
    assert undrafted[0]["lead_id"] == "lead_100"


def test_morning_queue_markdown_formatting():
    manager = MorningQueueManager(target_queue=50, dry_run=True)
    summary = {
        "run_id": "morning_test",
        "campaign_name": "OneFolk Multi-Industry Pilot 2026",
        "duration_seconds": 45,
        "target_queue": 50,
        "ready_for_approval": 50,
        "drawn_from_backlog": 35,
        "qualified_overnight": 15,
        "newly_discovered_today": 149,
        "needs_research": 5,
        "rejected": 20,
        "suppressed_or_duplicate": 2,
        "api_failures": 0,
        "shortage": 0,
        "shortage_reasons": [],
        "is_campaign_ready": True,
    }

    report = manager._format_markdown_report(summary)
    assert "[STATUS: READY FOR 9 AM APPROVAL]" in report
    assert "Ready for Human Approval at 9 AM" in report
    assert "50" in report
    assert "LIVE GMAIL SENDING:" in report.upper()
    assert "STRICTLY DISABLED" in report
