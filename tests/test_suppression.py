"""Tests for suppression management, deduplication, and pre-seeded historical bounces."""

import pytest
from src.suppression import SuppressionManager


def test_pre_seeded_suppression():
    mgr = SuppressionManager()

    # The 8 historical bounces/declines must be suppressed immediately
    known_bounced = [
        "info@drkumudiniaestheticgynae.com",
        "team@studioamamumbai.com",
        "contact@amazeoneinteriors.com",
        "riointeriorsdesigner@gmail.com",
        "studioha@gmail.com",
        "hello@goristore.com",
        "info@arch4foundation.com",
        "dbs4mee@gmail.com",
    ]
    for email in known_bounced:
        is_supp, reason = mgr.is_suppressed(email)
        assert is_supp, f"Expected {email} to be suppressed"
        assert "active suppression list" in reason or "suppressed" in reason.lower()


def test_domain_level_suppression():
    mgr = SuppressionManager()
    mgr.add_suppression("blocked-organization.com", "DOMAIN", "EXPLICIT_EXCLUSION")

    is_supp, _ = mgr.is_suppressed("info@blocked-organization.com")
    assert is_supp

    is_supp, _ = mgr.is_suppressed("", "https://www.blocked-organization.com/about")
    assert is_supp


def test_historical_sent_deduplication():
    mgr = SuppressionManager()
    sent_rows = [
        ["2026-10-01", "contact@heritage-college.edu", "Sent successfully"],
    ]
    mgr.load_from_sheet_data(suppression_rows=[], sent_rows=sent_rows)

    is_supp, reason = mgr.is_suppressed("contact@heritage-college.edu")
    assert is_supp
    assert "previously contacted" in reason.lower()

    # Non-contacted address remains unsuppressed
    is_supp, _ = mgr.is_suppressed("fresh@new-college.edu")
    assert not is_supp
