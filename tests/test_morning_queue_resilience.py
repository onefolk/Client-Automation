"""Tests for morning queue resilience: delayed execution, duplicate reruns, and failure handling."""

from unittest.mock import MagicMock, patch
import pytest

from src.morning_queue import MorningQueueManager


def test_morning_queue_rerun_idempotency_zero_duplicates():
    """Verify that rerunning the morning queue when the target is already met creates zero duplicates."""
    manager = MorningQueueManager(target_queue=2, dry_run=True)
    manager.sheets.spreadsheet = MagicMock()
    manager.discovery.harvest_candidates = MagicMock(return_value=([], {}))

    # Approval Queue already has 2 ready, valid drafts
    mock_ws = MagicMock()
    manager.sheets.spreadsheet.worksheet.return_value = mock_ws
    mock_ws.get_all_records.return_value = [
        {
            "lead_id": f"lead_{i}",
            "business": f"Institution {i}",
            "website": f"https://inst{i}.edu",
            "public_email": f"info@inst{i}.edu",
            "email_source_url": f"https://inst{i}.edu/contact",
            "observation": "Observation",
            "observation_url": f"https://inst{i}.edu/contact",
            "subject": "Inquiry",
            "email_body": "P1\n\nOur team designed and built the OneFolk website.\n\nP3?",
            "alt_opening_1": "Alt1",
            "alt_opening_2": "Alt2",
            "status": "DRAFTED",
            "approval": "",
            "created_at": "2026-10-21T18:00:00Z",
        }
        for i in range(2)
    ]

    summary = manager.run()

    # Target queue (2) was already fulfilled by backlog
    assert summary["ready_for_approval"] == 2
    assert summary["drawn_from_backlog"] == 2
    assert summary["qualified_overnight"] == 0
    assert summary["shortage"] == 0
    assert summary["is_campaign_ready"] is True


@patch("src.morning_queue.validate_credentials")
def test_morning_queue_recovers_from_api_failures(mock_val):
    """Verify that if Groq fails or times out, the pipeline records the failure and reports actual shortfall."""
    manager = MorningQueueManager(target_queue=3, dry_run=False)
    manager.sheets.spreadsheet = MagicMock()
    manager.sheets.connect = MagicMock(return_value=True)
    manager.sheets.initialize_schema = MagicMock()
    manager.sheets.load_historical_suppression_data = MagicMock(return_value=([], [], []))
    manager.sheets.append_leads = MagicMock()
    manager.sheets.append_approval_queue = MagicMock()

    # Mock empty queue
    mock_ws = MagicMock()
    mock_ws.get_all_records.return_value = []
    manager.sheets.spreadsheet.worksheet.return_value = mock_ws

    # Mock discovery yielding 2 candidates
    mock_candidates = [
        {"name": "PES University", "website": "https://pes.edu", "industry": "education"},
        {"name": "RVCE", "website": "https://rvce.edu.in", "industry": "education"},
    ]
    manager.discovery.harvest_candidates = MagicMock(return_value=(mock_candidates, {}))

    # Mock researcher qualifying them
    mock_research = {
        "lead_id": "lead_pes",
        "business": "PES University",
        "website": "https://pes.edu",
        "public_email": "admissions@pes.edu",
        "email_source_url": "https://pes.edu/contact",
        "observation": "Public inquiries rely on standard mailto links.",
        "observation_url": "https://pes.edu/admissions",
        "qualification_status": "QUALIFIED",
        "qualification_score": 85,
        "proof_line": "Our portfolio includes a campus ordering web application.",
    }
    manager.researcher.investigate = MagicMock(return_value=mock_research)

    # Mock Groq failing (e.g. rate limit exhaustion returns None)
    manager.groq.draft_outreach = MagicMock(return_value=None)
    manager.groq.is_available = MagicMock(return_value=True)

    summary = manager.run()

    # Both drafts failed AI drafting
    assert summary["ready_for_approval"] == 0
    assert summary["api_failures"] == 2
    assert summary["shortage"] == 3
    assert summary["is_campaign_ready"] is False
    assert any("failed Groq validation" in r for r in summary["shortage_reasons"])
