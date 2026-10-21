"""End-to-end dry run integration test exercising the complete outreach lifecycle."""

from unittest.mock import patch
import pytest
from src.cli import run_pipeline
from src.network import extract_domain
from src.verifier import MX_CACHE


def test_full_pipeline_dry_run():
    MX_CACHE.clear()

    def dynamic_mock_fetch(self, url, max_redirects=3):
        dom = extract_domain(url) or "example.edu"
        return f"""
        <!DOCTYPE html>
        <html>
          <head>
            <title>{dom} Academic Portal</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body>
            <h1>{dom} Institutional Platform</h1>
            <p>Direct inquiries: contact info@{dom} or admissions@{dom}</p>
            <form action="/inquiry" method="POST">
              <input type="email" name="email" />
              <textarea name="message"></textarea>
            </form>
            <p>Annual symposium registration and campus accommodation details.</p>
            <footer>© 2024 {dom}. All rights reserved.</footer>
          </body>
        </html>
        """

    with patch("src.network.SafeFetcher.fetch_html", new=dynamic_mock_fetch):
        with patch("src.network.is_safe_url", return_value=True):
            with patch("src.discovery.is_safe_url", return_value=True):
                with patch("src.verifier.has_valid_mx_records", return_value=True):
                    summary = run_pipeline(target_count=3, dry_run=True)

                    assert summary["status"] == "COMPLETED"
                    assert summary["prospects_discovered"] > 0
                    assert summary["qualified_leads"] >= 1
                    assert summary["emails_drafted"] >= 1
                    assert summary["duration_seconds"] >= 0
                    assert "run_id" in summary
