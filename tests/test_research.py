"""Tests for signal detection, factual observation rules, and qualification scoring."""

import pytest
from src.research import extract_website_signals, match_portfolio_project


def test_extract_website_signals():
    html = """
    <!DOCTYPE html>
    <html>
      <head>
        <title>Greenfield Academy of Technology</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body>
        <h1>Admissions Open</h1>
        <form action="/inquiry" method="POST">
          <input type="text" name="name" />
          <input type="email" name="email" />
          <button type="submit">Submit</button>
        </form>
        <p>Visit our campus cafeteria and hostel facilities.</p>
        <footer>Copyright 2024 Greenfield Academy</footer>
      </body>
    </html>
    """
    signals = extract_website_signals(html, "https://greenfield.edu")

    assert signals["has_https"] is True
    assert signals["has_mobile_viewport"] is True
    assert signals["has_inquiry_form"] is True
    assert signals["has_hostel_opportunity"] is True
    assert signals["has_ordering_opportunity"] is True
    assert signals["copyright_year"] == 2024
    assert "Greenfield Academy" in signals["title"]


def test_match_portfolio_project():
    # Education with ordering opportunity -> Campus Kiosk
    proj = match_portfolio_project("education", {"has_ordering_opportunity": True})
    assert proj["project"] == "Campus Kiosk"
    assert "multi-vendor" in proj["proof"]

    # Education with hostel opportunity -> Hostel Room Allocation Suite
    proj = match_portfolio_project("education", {"has_hostel_opportunity": True})
    assert proj["project"] == "Hostel Room Allocation Suite"

    # Creative / Architecture -> Enterprise Invoicing Suite or OneFolk website
    proj = match_portfolio_project("creative", {})
    assert proj["project"] in ("Enterprise Invoicing Suite", "OneFolk website", "Internal Workforce Operations Suite")


def test_priority_qualification_scoring_5_factors_and_thresholds():
    """Verify 5-factor 100-point scoring model (30, 25, 20, 15, 10) and 80-point priority threshold."""
    from src.research import ProspectResearcher
    researcher = ProspectResearcher(fetcher=None)

    # 1. High-priority prospect (Score >= 80)
    high_signals = {
        "has_https": True,
        "has_mobile_viewport": True,
        "has_inquiry_form": False,
        "has_ordering_opportunity": True,
        "copyright_year": 2025,
    }
    candidate_high = {"business": "Alpha Architecture Studio", "industry": "architecture", "city": "Chennai"}
    observation_high = "Visitor inquiries currently rely on static email mailto links rather than a structured online form."
    email_high = "contact@alphastudio.in"

    score, explanation, is_qual, breakdown = researcher._compute_qualification_score(
        high_signals, email_high, observation_high, candidate_high
    )
    assert score >= 80, f"Expected priority score >= 80, got {score}"
    assert is_qual is True
    assert breakdown["opportunity"] == 25  # mailto/form observation (25/30)
    assert breakdown["service_fit"] == 25  # Internal Workforce Operations Suite (25/25)
    assert breakdown["contact"] == 20      # verified role inbox (20/20)
    assert breakdown["buying_signal"] == 15 # active ordering/booking signal (15/15)
    assert breakdown["commercial_fit"] == 10 # metropolitan Chennai in architecture (10/10)
    assert breakdown["total"] == score
    assert "25/30" in explanation or "30/30" in explanation
    assert "20/20" in explanation

    # 2. Defect observation gives max 30 pts for opportunity
    obs_defect = "The site is currently served over insecure HTTP without automatic HTTPS redirection."
    score_def, expl_def, _, b_def = researcher._compute_qualification_score(
        {"has_https": False}, "info@clinic.in", obs_defect, {"industry": "healthcare", "city": "Bengaluru"}
    )
    assert b_def["opportunity"] == 30

    # 3. Secondary backlog prospect (Score 60 - 79)
    mod_signals = {
        "has_https": True,
        "has_mobile_viewport": True,
        "has_inquiry_form": True,
        "copyright_year": 2020,
    }
    candidate_mod = {"business": "Delta Logistics", "industry": "logistics"}
    score_mod, _, is_qual_mod, b_mod = researcher._compute_qualification_score(
        mod_signals, "general@deltalogistics.in", "Standard static web portal layout.", candidate_mod
    )
    assert 60 <= score_mod < 80, f"Expected backlog score between 60 and 79, got {score_mod}"
    assert is_qual_mod is True

    # 4. Disqualified / Needs research (Score < 60)
    candidate_low = {"business": "Unknown"}
    score_low, _, is_qual_low, b_low = researcher._compute_qualification_score(
        {}, "", "", candidate_low
    )
    assert score_low < 60
    assert is_qual_low is False
    assert b_low["contact"] == 0


def test_multi_industry_support_and_portfolio_matching():
    """Verify discovery and portfolio matching span multiple industries beyond education."""
    from src.research import match_portfolio_project

    # Healthcare / Clinics
    health_proj = match_portfolio_project("healthcare", {"has_booking_link": True})
    assert health_proj["project"] in ("OneFolk website", "Internal Workforce Operations Suite")

    # Architecture & Design
    arch_proj = match_portfolio_project("architecture", {})
    assert arch_proj["project"] == "Internal Workforce Operations Suite"

    # Hospitality / Retail
    hosp_proj = match_portfolio_project("hospitality", {"has_ordering_opportunity": True})
    assert hosp_proj["project"] == "Campus Kiosk"

    # Professional Services
    prof_proj = match_portfolio_project("professional-services", {})
    assert prof_proj["project"] == "Enterprise Invoicing Suite"

