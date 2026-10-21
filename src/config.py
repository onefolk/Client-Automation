"""Configuration and settings manager for OneFolk Outreach Engine."""

import json
import os
from pathlib import Path
from typing import Any, Dict, List
from dotenv import load_dotenv

load_dotenv()

ROOT_DIR = Path(__file__).resolve().parents[1]
CONFIG_DIR = ROOT_DIR / "config"

# Spreadsheet configuration
DEFAULT_SPREADSHEET_ID = "1U3JxQUcxSyqfZySnHNdLIwExtr3ikfcYlj0a3YY7ATM"
SHEET_ID = os.getenv("SHEET_ID", DEFAULT_SPREADSHEET_ID)

# Tab names in Master Google Sheet
TAB_DASHBOARD = "Dashboard"
TAB_LEAD_DATABASE = "Lead Database"
TAB_APPROVAL_QUEUE = "Approval Queue"
TAB_EMAIL_ACTIVITY = "Email Activity"
TAB_SUPPRESSION_LIST = "Suppression List"
TAB_CAMPAIGN_RUNS = "Campaign Runs"
TAB_SETTINGS = "Settings"
TAB_LEGACY_LEAD_QUEUE = "Lead Queue"
TAB_HISTORICAL_SENT = "Sent Emails"

# Table Schemas
LEAD_DATABASE_HEADERS = [
    "lead_id",
    "business",
    "industry",
    "city",
    "website",
    "source_url",
    "public_email",
    "email_source_url",
    "qualification_score",
    "qualification_status",
    "observation",
    "observation_url",
    "opportunity",
    "proof_project",
    "discovered_at",
    "updated_at",
]

APPROVAL_QUEUE_HEADERS = [
    "lead_id",
    "business",
    "industry",
    "website",
    "public_email",
    "subject",
    "email_body",
    "alt_opening_1",
    "alt_opening_2",
    "observation",
    "observation_url",
    "proof_project",
    "proof_line",
    "qualification_score",
    "status",
    "approval",
    "reviewer_notes",
    "created_at",
    "updated_at",
]

EMAIL_ACTIVITY_HEADERS = [
    "activity_id",
    "lead_id",
    "business",
    "recipient_email",
    "subject",
    "status",
    "sent_at",
    "gmail_message_id",
    "gmail_thread_id",
    "reply_status",
    "reply_snippet",
    "bounce_reason",
    "notes",
    "updated_at",
]

SUPPRESSION_HEADERS = [
    "suppression_id",
    "type",  # EMAIL, DOMAIN, KEYWORD
    "value",
    "reason",  # BOUNCED, DECLINED, UNSUBSCRIBED, HISTORICAL_BOUNCE, EXPLICIT_REJECTION
    "source",
    "added_at",
]

CAMPAIGN_RUNS_HEADERS = [
    "run_id",
    "campaign_name",
    "start_time",
    "end_time",
    "duration_seconds",
    "prospects_discovered",
    "prospects_scraped",
    "qualified_leads",
    "needs_research",
    "emails_drafted",
    "ai_calls_used",
    "http_fetches_used",
    "cost_incurred",
    "status",
]

# Historical known bounces and explicit rejections
PRE_SEEDED_SUPPRESSIONS = [
    ("info@drkumudiniaestheticgynae.com", "EMAIL", "HISTORICAL_BOUNCE"),
    ("team@studioamamumbai.com", "EMAIL", "HISTORICAL_BOUNCE"),
    ("contact@amazeoneinteriors.com", "EMAIL", "HISTORICAL_BOUNCE"),
    ("riointeriorsdesigner@gmail.com", "EMAIL", "HISTORICAL_BOUNCE"),
    ("studioha@gmail.com", "EMAIL", "HISTORICAL_BOUNCE"),
    ("hello@goristore.com", "EMAIL", "HISTORICAL_BOUNCE"),
    ("info@arch4foundation.com", "EMAIL", "HISTORICAL_BOUNCE"),
    ("dbs4mee@gmail.com", "EMAIL", "EXPLICIT_REJECTION"),
]

# AI and HTTP constraints
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_FALLBACK_MODEL = "openai/gpt-oss-20b"
MAX_AI_CALLS = int(os.getenv("MAX_AI_CALLS", "120"))
QUALIFIED_TARGET = int(os.getenv("QUALIFIED_TARGET", "100"))
MAX_HTTP_FETCHES = int(os.getenv("MAX_HTTP_FETCHES", "500"))
MAX_DIRECTORY_LINKS = int(os.getenv("MAX_DIRECTORY_LINKS", "600"))
HTTP_TIMEOUT_SECONDS = int(os.getenv("HTTP_TIMEOUT_SECONDS", "10"))
MAX_DAILY_SENDS = int(os.getenv("MAX_DAILY_SENDS", "50"))
ENABLE_SENDING = os.getenv("ENABLE_SENDING", "false").lower() in ("true", "yes", "1")

USER_AGENT = "OneFolk research bot (public pages; contact: contact.onefolk@gmail.com)"


def load_portfolio() -> List[Dict[str, Any]]:
    """Loads approved OneFolk portfolio configuration."""
    portfolio_file = CONFIG_DIR / "portfolio.json"
    if not portfolio_file.exists():
        return []
    with portfolio_file.open(encoding="utf-8") as f:
        return json.load(f)


def load_campaigns() -> Dict[str, Any]:
    """Loads campaign configurations."""
    campaigns_file = CONFIG_DIR / "campaigns.json"
    if not campaigns_file.exists():
        return {"active_campaign": "all_industries_pilot", "campaigns": {}}
    with campaigns_file.open(encoding="utf-8") as f:
        return json.load(f)


def get_active_campaign() -> Dict[str, Any]:
    """Retrieves the active campaign parameters."""
    cfg = load_campaigns()
    active_key = os.getenv("ACTIVE_CAMPAIGN", cfg.get("active_campaign", "all_industries_pilot"))
    return cfg.get("campaigns", {}).get(
        active_key,
        {
            "name": "Default Pilot",
            "target_lead_count": QUALIFIED_TARGET,
            "min_qualification_score": 60,
            "industries": ["education", "events", "hospitality", "professional-services", "creative", "architecture", "retail", "other"],
            "target_cities": [],
            "keywords": [],
            "exclusions": ["gov.in", "nic.in"],
        },
    )
