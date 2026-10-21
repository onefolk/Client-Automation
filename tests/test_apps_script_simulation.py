"""Tests simulating Google Apps Script sender logic, quota rules, and reply/bounce classification."""

import re
import pytest

# Simulating Apps Script business logic in Python test harness

def simulate_valid_approved_draft(row: dict) -> bool:
    email = str(row.get("public_email", "")).strip().lower()
    status = str(row.get("status", "")).strip().lower()
    approval = str(row.get("approval", "")).strip().lower()
    subject = str(row.get("subject", "")).strip()
    body = str(row.get("email_body", "")).strip()
    proof = str(row.get("proof_line", "")).strip()

    if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        return False
    if status != "approved" or approval != "approved":
        return False
    if not subject or not body or not proof:
        return False
    words = body.split()
    if len(words) > 70:
        return False
    paragraphs = [p for p in body.split("\n\n") if p.strip()]
    if len(paragraphs) != 3:
        return False
    return True


def simulate_sender_batch(rows: list, daily_used: int, max_per_day: int = 50, quota: int = 500) -> dict:
    budget = min(max_per_day - daily_used, quota)
    dispatched = []
    skipped = []
    errors = []

    for r in rows:
        if budget <= 0:
            skipped.append((r["lead_id"], "DAILY_BUDGET_EXHAUSTED"))
            continue

        if not simulate_valid_approved_draft(r):
            skipped.append((r["lead_id"], "NOT_APPROVED_OR_INVALID"))
            continue

        # Simulate sending
        if r.get("simulate_error"):
            errors.append((r["lead_id"], "SEND_REVIEW"))
        else:
            dispatched.append(r["lead_id"])
            budget -= 1

    return {"dispatched": dispatched, "skipped": skipped, "errors": errors, "remaining_budget": budget}


def classify_inbox_reply(subject: str, body: str) -> str:
    sub = subject.lower()
    b = body.lower()

    if "delivery status notification" in sub or "undelivered mail" in sub or "failure notice" in sub:
        return "BOUNCED"
    if any(k in b for k in ["not interested", "unsubscribe", "remove me", "please remove", "do not contact", "stop"]):
        return "DECLINED"
    if re.search(r"schedule|meeting|call|discuss (?:further|details|options|project)|interested|rates|quote|pricing|price", b):
        return "POSITIVE_REPLY"
    return "REPLY_REVIEW"


def test_dual_approval_required():
    approved_row = {
        "lead_id": "lead_1",
        "public_email": "info@pes.edu",
        "status": "APPROVED",
        "approval": "APPROVED",
        "subject": "Web portal observation",
        "email_body": "Paragraph 1\n\nOur team designed and built the OneFolk website.\n\nOpen to discussing?",
        "proof_line": "Our team designed and built the OneFolk website.",
    }
    assert simulate_valid_approved_draft(approved_row) is True

    # Missing status approval
    unapproved = {**approved_row, "status": "AWAITING_REVIEW"}
    assert simulate_valid_approved_draft(unapproved) is False

    # Rejected by reviewer
    rejected = {**approved_row, "status": "REJECTED", "approval": "REJECTED"}
    assert simulate_valid_approved_draft(rejected) is False


def test_daily_send_cap():
    rows = [
        {
            "lead_id": f"lead_{i}",
            "public_email": f"info{i}@pes.edu",
            "status": "APPROVED",
            "approval": "APPROVED",
            "subject": "Subject",
            "email_body": "P1\n\nOur team designed and built the OneFolk website.\n\nP3?",
            "proof_line": "Our team designed and built the OneFolk website.",
        }
        for i in range(10)
    ]

    # Already sent 45 today; cap is 50 -> only 5 should be dispatched
    res = simulate_sender_batch(rows, daily_used=45, max_per_day=50)
    assert len(res["dispatched"]) == 5
    assert len(res["skipped"]) == 5
    assert res["remaining_budget"] == 0


def test_ambiguous_send_state():
    rows = [
        {
            "lead_id": "lead_err",
            "public_email": "info@pes.edu",
            "status": "APPROVED",
            "approval": "APPROVED",
            "subject": "Subject",
            "email_body": "P1\n\nOur team designed and built the OneFolk website.\n\nP3?",
            "proof_line": "Our team designed and built the OneFolk website.",
            "simulate_error": True,
        }
    ]
    res = simulate_sender_batch(rows, daily_used=0)
    assert len(res["errors"]) == 1
    assert res["errors"][0][1] == "SEND_REVIEW"


def test_bounce_classification():
    sub = "Delivery Status Notification (Failure)"
    body = "Technical details: The recipient server did not accept our connection to pes.edu."
    assert classify_inbox_reply(sub, body) == "BOUNCED"


def test_reply_classification():
    # Opt-out
    assert classify_inbox_reply("Re: Inquiry", "Please remove me from your mailing list.") == "DECLINED"
    assert classify_inbox_reply("Re: Web inquiry", "Not interested, please do not contact us.") == "DECLINED"

    # Positive
    assert classify_inbox_reply("Re: Web inquiry", "Sounds interesting, let's schedule a call this Friday.") == "POSITIVE_REPLY"
    assert classify_inbox_reply("Re: Web inquiry", "Can you discuss pricing and send portfolio details?") == "POSITIVE_REPLY"

    # Ambiguous / general
    assert classify_inbox_reply("Re: Web inquiry", "Received, forwarding to our IT coordinator.") == "REPLY_REVIEW"


def simulate_morning_digest(rows: list, sent_dates: set, date_str: str) -> dict:
    """Simulates Apps Script sendMorningQueueDigest idempotency and calculation."""
    if date_str in sent_dates:
        return {"status": "SKIPPED_ALREADY_SENT", "date": date_str}

    ready_drafts = sum(
        1 for r in rows
        if str(r.get("status", "")).upper() in ("DRAFTED", "AWAITING_REVIEW")
        and r.get("public_email")
        and r.get("email_body")
    )
    target = 50
    shortage = max(0, target - ready_drafts)
    sent_dates.add(date_str)

    return {
        "status": "DELIVERED",
        "date": date_str,
        "ready_drafts": ready_drafts,
        "target": target,
        "shortage": shortage,
        "is_ready": ready_drafts >= target,
    }


def test_morning_digest_idempotency_and_shortfall():
    sent_dates = set()
    rows = [
        {"public_email": f"lead{i}@pes.edu", "email_body": "Body", "status": "DRAFTED"}
        for i in range(35)
    ]

    # First delivery: delivered with exact count and shortfall
    res1 = simulate_morning_digest(rows, sent_dates, "2026-10-22")
    assert res1["status"] == "DELIVERED"
    assert res1["ready_drafts"] == 35
    assert res1["shortage"] == 15
    assert res1["is_ready"] is False

    # Second delivery attempt on same date: skipped idempotently (no duplicate email)
    res2 = simulate_morning_digest(rows, sent_dates, "2026-10-22")
    assert res2["status"] == "SKIPPED_ALREADY_SENT"

    # Next date: delivered afresh
    res3 = simulate_morning_digest(rows, sent_dates, "2026-10-23")
    assert res3["status"] == "DELIVERED"
    assert res3["date"] == "2026-10-23"

