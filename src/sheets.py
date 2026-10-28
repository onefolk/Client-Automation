"""Master Google Sheets integration, schema migration, and dashboard synchronization."""

import json
import logging
import os
from typing import Any, Dict, List, Optional, Set, Tuple
from google.oauth2.service_account import Credentials
import gspread

from src.config import (
    APPROVAL_QUEUE_HEADERS,
    CAMPAIGN_RUNS_HEADERS,
    DEFAULT_SPREADSHEET_ID,
    EMAIL_ACTIVITY_HEADERS,
    LEAD_DATABASE_HEADERS,
    SHEET_ID,
    SUPPRESSION_HEADERS,
    TAB_APPROVAL_QUEUE,
    TAB_CAMPAIGN_RUNS,
    TAB_DASHBOARD,
    TAB_EMAIL_ACTIVITY,
    TAB_HISTORICAL_SENT,
    TAB_LEAD_DATABASE,
    TAB_LEGACY_LEAD_QUEUE,
    TAB_SETTINGS,
    TAB_SUPPRESSION_LIST,
)

logger = logging.getLogger(__name__)

# Operator-set statuses in the Approval Queue, in pipeline order.
CONVERSION_STAGES = ("MEETING_BOOKED", "PROPOSAL_REQUESTED", "CLIENT_CONVERTED")

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


class SheetsManager:
    """Manages reading, upserting, and dashboard reporting across the master spreadsheet."""

    def __init__(self, spreadsheet_id: Optional[str] = None, service_account_json: Optional[str] = None):
        self.spreadsheet_id = spreadsheet_id or SHEET_ID or DEFAULT_SPREADSHEET_ID
        self.raw_creds = service_account_json or os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")
        self.client: Optional[gspread.Client] = None
        self.spreadsheet: Optional[gspread.Spreadsheet] = None

    def connect(self) -> bool:
        """Establishes an authenticated connection to the Google Sheets API."""
        if not self.raw_creds:
            logger.warning("No GOOGLE_SERVICE_ACCOUNT_JSON configured.")
            return False

        try:
            creds_data = json.loads(self.raw_creds)
            credentials = Credentials.from_service_account_info(creds_data, scopes=SCOPES)
            self.client = gspread.authorize(credentials, http_client=gspread.BackOffHTTPClient)
            self.spreadsheet = self.client.open_by_key(self.spreadsheet_id)
            logger.info("Successfully connected to Google Sheet ID: %s", self.spreadsheet_id)
            return True
        except Exception as e:
            logger.error("Failed to authenticate with Google Sheets: %s", str(e))
            return False

    def ensure_tab(self, tab_name: str, headers: List[str], rows: int = 1000) -> Optional[gspread.Worksheet]:
        """Ensures a worksheet tab exists and has the designated headers."""
        if not self.spreadsheet:
            return None

        try:
            ws = self.spreadsheet.worksheet(tab_name)
            # Verify or append headers if empty
            existing_headers = ws.row_values(1)
            if not existing_headers:
                ws.append_row(headers, value_input_option="RAW")
            return ws
        except gspread.WorksheetNotFound:
            logger.info("Creating missing tab '%s' with %d columns", tab_name, len(headers))
            ws = self.spreadsheet.add_worksheet(title=tab_name, rows=rows, cols=len(headers) + 2)
            ws.append_row(headers, value_input_option="RAW")
            return ws

    def initialize_schema(self):
        """Initializes all 7 operational tabs while preserving historical tabs."""
        if not self.spreadsheet:
            return

        self.ensure_tab(TAB_DASHBOARD, ["Metric", "Value", "Notes"])
        self.ensure_tab(TAB_LEAD_DATABASE, LEAD_DATABASE_HEADERS)
        self.ensure_tab(TAB_APPROVAL_QUEUE, APPROVAL_QUEUE_HEADERS)
        self.ensure_tab(TAB_EMAIL_ACTIVITY, EMAIL_ACTIVITY_HEADERS)
        self.ensure_tab(TAB_SUPPRESSION_LIST, SUPPRESSION_HEADERS)
        self.ensure_tab(TAB_CAMPAIGN_RUNS, CAMPAIGN_RUNS_HEADERS)
        self.ensure_tab(
            TAB_SETTINGS,
            ["Parameter", "Configured Value", "Description", "Last Updated"],
        )

    def get_existing_lead_ids(self) -> Set[str]:
        """Retrieves existing lead IDs from Lead Database and legacy Lead Queue."""
        lead_ids = set()
        if not self.spreadsheet:
            return lead_ids

        # Check Lead Database
        try:
            ws = self.spreadsheet.worksheet(TAB_LEAD_DATABASE)
            records = ws.get_all_records()
            for r in records:
                lid = str(r.get("lead_id", "")).strip()
                if lid:
                    lead_ids.add(lid)
        except Exception:
            pass

        # Check legacy Lead Queue
        try:
            ws = self.spreadsheet.worksheet(TAB_LEGACY_LEAD_QUEUE)
            records = ws.get_all_records()
            for r in records:
                lid = str(r.get("lead_id", "")).strip()
                if lid:
                    lead_ids.add(lid)
        except Exception:
            pass

        return lead_ids

    def load_historical_suppression_data(self):
        """Fail closed: a missing/unreadable safety tab cannot mean no suppressions."""
        if not self.spreadsheet:
            raise RuntimeError("Sheet unavailable")
        supp = self.spreadsheet.worksheet(TAB_SUPPRESSION_LIST).get_all_records()
        sent = self.spreadsheet.worksheet(TAB_HISTORICAL_SENT).get_all_values()[1:]
        queue = self.spreadsheet.worksheet(TAB_APPROVAL_QUEUE).get_all_records()
        activity = self.spreadsheet.worksheet(TAB_EMAIL_ACTIVITY).get_all_records()
        for row in activity:
            if row.get('recipient_email'):
                sent.append(['', row['recipient_email']])
        return supp, sent, queue

    def upsert_leads(self, leads: List[Dict[str, Any]]) -> int:
        """Idempotently appends newly discovered leads to the Lead Database tab."""
        if not self.spreadsheet or not leads:
            return 0

        ws = self.ensure_tab(TAB_LEAD_DATABASE, LEAD_DATABASE_HEADERS)
        existing_ids = self.get_existing_lead_ids()
        new_rows = []

        for lead in leads:
            lid = lead["lead_id"]
            if lid in existing_ids:
                continue

            row = [
                lead.get("lead_id", ""),
                lead.get("business", ""),
                lead.get("industry", ""),
                lead.get("city", ""),
                lead.get("website", ""),
                lead.get("source_url", ""),
                lead.get("public_email", ""),
                lead.get("email_source_url", ""),
                lead.get("qualification_score", 0),
                lead.get("qualification_status", "NEEDS_RESEARCH"),
                lead.get("observation", ""),
                lead.get("observation_url", ""),
                lead.get("opportunity", ""),
                lead.get("proof_project", ""),
                lead.get("timestamp", ""),
                lead.get("timestamp", ""),
            ]
            new_rows.append(row)
            existing_ids.add(lid)

        if new_rows:
            ws.append_rows(new_rows, value_input_option="RAW")
            logger.info("Appended %d new leads to '%s'", len(new_rows), TAB_LEAD_DATABASE)

        return len(new_rows)

    def upsert_approval_queue(self, drafts: List[Dict[str, Any]]) -> int:
        """Appends new AI drafted records into the human Approval Queue."""
        if not self.spreadsheet or not drafts:
            return 0

        ws = self.ensure_tab(TAB_APPROVAL_QUEUE, APPROVAL_QUEUE_HEADERS)
        existing_records = ws.get_all_records()
        existing_ids = {str(r.get("lead_id", "")).strip() for r in existing_records}

        new_rows = []
        for draft in drafts:
            lid = draft["lead_id"]
            if lid in existing_ids:
                continue

            row = [
                draft.get("lead_id", ""),
                draft.get("business", ""),
                draft.get("industry", ""),
                draft.get("website", ""),
                draft.get("public_email", ""),
                draft.get("subject", ""),
                draft.get("email_body", ""),
                draft.get("alt_opening_1", ""),
                draft.get("alt_opening_2", ""),
                draft.get("observation", ""),
                draft.get("observation_url", ""),
                draft.get("proof_project", ""),
                draft.get("proof_line", ""),
                draft.get("qualification_score", 0),
                "AWAITING_REVIEW",  # status
                "PENDING",  # approval
                "AI suggestion - human approval required before sending",
                draft.get("timestamp", ""),
                draft.get("timestamp", ""),
            ]
            new_rows.append(row)
            existing_ids.add(lid)

        if new_rows:
            ws.append_rows(new_rows, value_input_option="RAW")
            logger.info("Appended %d drafts to '%s'", len(new_rows), TAB_APPROVAL_QUEUE)

        return len(new_rows)

    def record_campaign_run(self, run_summary: Dict[str, Any]):
        """Logs execution metrics in Campaign Runs."""
        if not self.spreadsheet:
            return

        ws = self.ensure_tab(TAB_CAMPAIGN_RUNS, CAMPAIGN_RUNS_HEADERS)
        row = [
            run_summary.get("run_id", ""),
            run_summary.get("campaign_name", "OneFolk Pilot"),
            run_summary.get("start_time", ""),
            run_summary.get("end_time", ""),
            run_summary.get("duration_seconds", 0),
            run_summary.get("prospects_discovered", 0),
            run_summary.get("prospects_scraped", 0),
            run_summary.get("qualified_leads", 0),
            run_summary.get("needs_research", 0),
            run_summary.get("emails_drafted", 0),
            run_summary.get("ai_calls_used", 0),
            run_summary.get("http_fetches_used", 0),
            "₹0 (Free Tier)",
            run_summary.get("status", "COMPLETED"),
        ]
        ws.append_row(row, value_input_option="RAW")

    def update_dashboard(self, metrics: Optional[Dict[str, Any]] = None):
        """Aggregates data across tabs and updates the Dashboard tab."""
        if not self.spreadsheet:
            return

        ws_dash = self.ensure_tab(TAB_DASHBOARD, ["Metric", "Value", "Notes"])

        # Tally metrics across sheets
        discovered = 0
        qualified = 0
        needs_research = 0
        drafted = 0
        approved = 0
        sent = 0
        bounced = 0
        declined = 0
        positive_replies = 0
        calls_booked = proposals = clients = 0

        try:
            db_ws = self.spreadsheet.worksheet(TAB_LEAD_DATABASE)
            leads = db_ws.get_all_records()
            discovered = len(leads)
            for r in leads:
                qstatus = str(r.get("qualification_status", "")).upper()
                if qstatus in ("QUALIFIED", "QUALIFIED_CONTACTABLE"):
                    qualified += 1
                elif qstatus == "NEEDS_RESEARCH":
                    needs_research += 1
        except Exception as exc:
            raise RuntimeError('Dashboard source unavailable; retaining previous metrics') from exc

        try:
            app_ws = self.spreadsheet.worksheet(TAB_APPROVAL_QUEUE)
            approvals = app_ws.get_all_records()
            drafted = len(approvals)
            for r in approvals:
                app_val = str(r.get("approval", "")).upper()
                stat_val = str(r.get("status", "")).upper()
                if app_val == "APPROVED" and stat_val == "APPROVED":
                    approved += 1
                if stat_val in ("SENT", "BOUNCED", "DECLINED", "UNSUBSCRIBED", "POSITIVE_REPLY", "REPLY_REVIEW") + CONVERSION_STAGES:
                    sent += 1
                if stat_val == "POSITIVE_REPLY" or stat_val in CONVERSION_STAGES:
                    positive_replies += 1
                # Stages are cumulative: a converted client also had a call and a proposal.
                if stat_val in CONVERSION_STAGES:
                    stage = CONVERSION_STAGES.index(stat_val)
                    calls_booked += 1
                    proposals += stage >= 1
                    clients += stage >= 2
                elif stat_val == "BOUNCED":
                    bounced += 1
                elif stat_val in ("DECLINED", "UNSUBSCRIBED"):
                    declined += 1
        except Exception as exc:
            raise RuntimeError('Dashboard source unavailable; retaining previous metrics') from exc

        # Override with runtime metrics if provided
        if metrics:
            discovered = max(discovered, metrics.get("prospects_discovered", 0))
            qualified = max(qualified, metrics.get("qualified_leads", 0))
            drafted = max(drafted, metrics.get("emails_drafted", 0))

        dashboard_rows = [
            ["Metric", "Value", "Notes"],
            ["Prospects discovered", discovered, "Unique domains harvested from public sources"],
            ["Prospects scraped", metrics.get("prospects_scraped", discovered) if metrics else discovered, "Domains checked with SSRF-safe crawler"],
            ["Qualified leads", qualified, "Leads meeting scoring thresholds (>=60)"],
            ["Leads requiring research", needs_research, "Entities with incomplete signals"],
            ["Emails drafted", drafted, "Grounded 3-paragraph drafts in Approval Queue"],
            ["Emails approved", approved, "Human-authorized drafts ready for Gmail sender"],
            ["Emails sent", sent, "Dispatched via Apps Script (max 50/day)"],
            ["Bounced emails", bounced, "Verified delivery failures"],
            ["Positive replies", positive_replies, "Inquiries / meeting requests"],
            ["Negative replies / Opt-outs", declined, "Immediately suppressed"],
            ["Sales calls booked", calls_booked, "Commercial pipeline conversion"],
            ["Proposals requested", proposals, "Formal requirement submissions"],
            ["Clients converted", clients, "Signed engagements"],
            ["Conversion rate (Sent -> Qualified Reply)", f"{(positive_replies / sent * 100):.1f}%" if sent > 0 else "0.0%", "Primary pipeline efficiency metric"],
            ["Campaign execution duration", f"{metrics.get('duration_seconds', 0) if metrics else 0}s", "GitHub Actions runner execution time"],
            ["API quota usage (Groq)", f"{metrics.get('ai_calls_used', 0) if metrics else 0} calls", "Free tier budget (max 120 calls/run)"],
            ["Actual spending", "₹0.00", "Strictly zero cost across all services"],
        ]

        ws_dash.update(values=dashboard_rows, range_name="A1:C19", value_input_option="RAW")
        logger.info("Dashboard tab successfully updated with current outreach metrics.")
