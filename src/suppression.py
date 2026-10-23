"""Suppression management, deduplication, and exclusion rules."""

import logging
from typing import Dict, List, Optional, Set, Tuple
from src.config import PRE_SEEDED_SUPPRESSIONS
from src.network import extract_domain
from src.verifier import clean_email

logger = logging.getLogger(__name__)


class SuppressionManager:
    """Manages suppression lists across emails, domains, and historical outreach."""

    def __init__(self):
        self.suppressed_emails: Set[str] = set()
        self.suppressed_domains: Set[str] = set()
        self.contacted_emails: Set[str] = set()
        self.contacted_domains: Set[str] = set()
        self.suppression_records: List[Dict[str, str]] = []

        # Load pre-seeded suppression entries
        self._load_pre_seeded()

    def _load_pre_seeded(self):
        """Initializes pre-seeded known bounces and explicit rejections."""
        for val, kind, reason in PRE_SEEDED_SUPPRESSIONS:
            cleaned = clean_email(val)
            self.suppressed_emails.add(cleaned)
            dom = cleaned.split("@")[-1]
            if dom:
                self.suppressed_domains.add(dom)
            self.suppression_records.append({
                "suppression_id": f"pre_{abs(hash(cleaned)) % 1000000}",
                "type": kind,
                "value": cleaned,
                "reason": reason,
                "source": "pre_seeded_audit",
                "added_at": "2026-10-21T00:00:00Z",
            })

    def load_from_sheet_data(
        self,
        suppression_rows: List[Dict[str, str]],
        sent_rows: List[List[str]],
        queue_rows: Optional[List[Dict[str, str]]] = None,
    ):
        """Loads and consolidates suppression data from Google Sheet tabs."""
        # 1. From Suppression List tab
        for row in suppression_rows:
            stype = str(row.get("type", "")).upper().strip()
            val = str(row.get("value", "")).strip().lower()
            if not val:
                continue
            if stype == "EMAIL" or "@" in val:
                email = clean_email(val)
                self.suppressed_emails.add(email)
                dom = email.split("@")[-1]
                if dom:
                    self.suppressed_domains.add(dom)
            elif stype == "DOMAIN" or "." in val:
                dom = extract_domain(val) or val
                self.suppressed_domains.add(dom)

        # 2. From historical Sent Emails tab
        for row in sent_rows:
            if not row or len(row) < 2:
                continue
            # Sent Emails columns typically: [timestamp, recipient_email, ...]
            email = clean_email(row[1]) if len(row) > 1 else ""
            if email and "@" in email:
                self.contacted_emails.add(email)
                dom = email.split("@")[-1]
                if dom:
                    self.contacted_domains.add(dom)

        # 3. From active Queue rows (if status indicates sent, bounce/decline/opt-out)
        if queue_rows:
            for row in queue_rows:
                status = str(row.get("status", "")).upper().strip()
                email = clean_email(str(row.get("public_email", "")))
                dom = extract_domain(str(row.get("website", "")))
                if status in ("SENT", "CONTACTED", "EMAILED", "SENDING", "SEND_REVIEW", "POSITIVE_REPLY", "REPLY_REVIEW"):
                    if email:
                        self.contacted_emails.add(email)
                    if dom:
                        self.contacted_domains.add(dom)

                if status in ("BOUNCED", "DECLINED", "UNSUBSCRIBED", "OPTED_OUT", "SUPPRESSED", "REJECTED"):
                    if email:
                        self.suppressed_emails.add(email)
                    if dom:
                        self.suppressed_domains.add(dom)

    def is_suppressed(self, email: str, domain_or_url: str = "") -> Tuple[bool, str]:
        """Checks if an email or domain is suppressed. Returns (is_suppressed, reason)."""
        clean_addr = clean_email(email)
        target_domain = extract_domain(domain_or_url) if domain_or_url else ""
        if not target_domain and clean_addr:
            target_domain = clean_addr.split("@")[-1]

        # Check suppressed emails
        if clean_addr in self.suppressed_emails:
            return True, f"Email '{clean_addr}' is in active suppression list"

        # Check suppressed domains
        if target_domain and target_domain in self.suppressed_domains:
            return True, f"Domain '{target_domain}' is in active suppression list"

        if target_domain in self.contacted_domains:
            return True, "Previously contacted company"

        # Check previously contacted emails (prevent double-contacting without re-approval)
        if clean_addr in self.contacted_emails:
            return True, f"Email '{clean_addr}' was previously contacted in historical campaigns"

        return False, ""

    def add_suppression(self, value: str, kind: str, reason: str, source: str = "runtime") -> Dict[str, str]:
        """Adds a new suppression record dynamically."""
        val = value.strip().lower()
        if kind == "EMAIL" or "@" in val:
            val = clean_email(val)
            self.suppressed_emails.add(val)
            dom = val.split("@")[-1]
            if dom:
                self.suppressed_domains.add(dom)
        else:
            val = extract_domain(val) or val
            self.suppressed_domains.add(val)

        from datetime import datetime
        from zoneinfo import ZoneInfo
        record = {
            "suppression_id": f"sup_{abs(hash(val)) % 1000000}",
            "type": kind,
            "value": val,
            "reason": reason,
            "source": source,
            "added_at": datetime.now(ZoneInfo("Asia/Kolkata")).isoformat(),
        }
        self.suppression_records.append(record)
        return record
