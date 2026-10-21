"""Tests for multi-industry candidate discovery, campaign filtering, and shortage reports."""

from unittest.mock import MagicMock, patch
import pytest
from src.discovery import DiscoveryEngine


def test_matches_campaign_industry():
    engine = DiscoveryEngine({
        "industries": ["education", "hospitality"],
        "target_cities": [],
        "keywords": [],
        "exclusions": ["gov.in"],
    })

    assert engine.matches_campaign({"website": "https://college.edu", "industry": "education"})
    assert engine.matches_campaign({"website": "https://resort.com", "industry": "hospitality"})
    assert not engine.matches_campaign({"website": "https://agency.com", "industry": "creative"})


def test_matches_campaign_exclusions():
    engine = DiscoveryEngine({
        "industries": ["education"],
        "target_cities": [],
        "keywords": [],
        "exclusions": ["gov.in", "nic.in"],
    })

    assert not engine.matches_campaign({"website": "https://dept.gov.in", "industry": "education"})
    assert not engine.matches_campaign({"website": "https://facebook.com/page", "industry": "education"})


def test_shortage_reporting():
    engine = DiscoveryEngine({
        "name": "Small Pilot",
        "target_lead_count": 100,
        "industries": ["education"],
        "target_cities": [],
        "keywords": [],
        "exclusions": [],
    })

    fetcher = MagicMock()
    # Mock seeds
    with patch("src.discovery.read_csv_file") as mock_csv:
        mock_csv.side_effect = [
            [
                {"name": "PES University", "website": "https://pes.edu", "industry": "education"},
                {"name": "RV College", "website": "https://rvce.edu.in", "industry": "education"},
            ],
            [],  # empty directories
        ]
        with patch("src.discovery.is_safe_url", return_value=True):
            candidates, report = engine.harvest_candidates(fetcher)

            assert len(candidates) == 2
            assert report["is_shortage"] is True
            assert report["target_lead_count"] == 100
            assert report["total_harvested"] == 2
