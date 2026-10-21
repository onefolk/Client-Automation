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
