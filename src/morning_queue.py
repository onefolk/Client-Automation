"""OneFolk 9 AM Morning Outreach Queue Orchestrator.

Maintains an evergreen reserve of qualified leads and personalized drafts,
ensuring at least 50 fresh, reviewable leads are available in the master
Google Sheet by 9:00 AM IST every business day.
"""

from datetime import datetime, timezone, timedelta
import json
import logging
import os
from typing import Any, Dict, List, Optional, Set, Tuple

from src.config import (
    APPROVAL_QUEUE_HEADERS,
    DEFAULT_SPREADSHEET_ID,
    LEAD_DATABASE_HEADERS,
    SHEET_ID,
    TAB_APPROVAL_QUEUE,
    TAB_DASHBOARD,
    TAB_LEAD_DATABASE,
    get_active_campaign,
    validate_credentials,
)
from src.discovery import DiscoveryEngine
from src.groq_client import GroqClient
from src.network import SafeFetcher
from src.research import ProspectResearcher
from src.sheets import SheetsManager
from src.suppression import SuppressionManager

logger = logging.getLogger("onefolk.morning_queue")

DEFAULT_TARGET_QUEUE = 50
MAX_DRAFT_AGE_DAYS = 14


def validate_queued_draft(record: Dict[str, Any]) -> Tuple[bool, str]:
    """Strictly validates that a queued record is complete, compliant, and ready for human review."""
    business = str(record.get("business", "")).strip()
    if not business:
        return False, "Missing business name"

    website = str(record.get("website", "")).strip()
    if not website or not website.startswith(("http://", "https://")):
        return False, "Missing or invalid official website URL"

    public_email = str(record.get("public_email", "")).strip().lower()
    if not public_email or "@" not in public_email or "." not in public_email.split("@")[-1]:
        return False, "Missing or invalid public contact email"

    # Contact source URL must be present
    email_src = str(record.get("email_source_url", "")).strip() or str(record.get("source_url", "")).strip()
    if not email_src or not email_src.startswith(("http://", "https://")):
        return False, "Missing contact provenance source URL"

    # Observation and observation evidence URL must be present
    observation = str(record.get("observation", "")).strip()
    if not observation:
        return False, "Missing verified website technical observation"

    obs_url = str(record.get("observation_url", "")).strip() or website
    if not obs_url or not obs_url.startswith(("http://", "https://")):
        return False, "Missing observation evidence URL"

    # Email body must be non-empty, exactly 3 paragraphs, under 70 words
    body = str(record.get("email_body", "")).strip()
    if not body:
        return False, "Missing personalized email body"

    paragraphs = [p.strip() for p in body.split("\n\n") if p.strip()]
    if len(paragraphs) != 3:
        paragraphs = [p.strip() for p in body.split("\n") if p.strip()]
        if len(paragraphs) != 3:
            return False, f"Email body must have exactly 3 paragraphs (found {len(paragraphs)})"

    words = body.split()
    if len(words) > 70:
        return False, f"Email body exceeds 70-word limit ({len(words)} words)"

    # Subject and alternative opening lines
    subject = str(record.get("subject", "")).strip()
    if not subject:
        return False, "Missing email subject"

    alt1 = str(record.get("alt_opening_1", "")).strip()
    alt2 = str(record.get("alt_opening_2", "")).strip()
    if not alt1 or not alt2:
        return False, "Missing required alternative opening lines for review"

    return True, "READY"


class MorningQueueManager:
    """Manages the overnight discovery, qualification, drafting, and 9 AM queue publishing."""

    def __init__(
        self,
        target_queue: int = DEFAULT_TARGET_QUEUE,
        dry_run: bool = False,
    ):
        self.target_queue = target_queue
        self.dry_run = dry_run
        self.campaign_cfg = get_active_campaign()
        self.fetcher = SafeFetcher()
        self.discovery = DiscoveryEngine(self.campaign_cfg)
        self.researcher = ProspectResearcher(self.fetcher)
        self.suppression = SuppressionManager()
        self.groq = GroqClient()
        self.sheets = SheetsManager()

    def audit_existing_queue(self) -> Tuple[List[Dict[str, Any]], int, int, int]:
        """Audits the Approval Queue for existing valid drafts, stale records, retro-suppressions, and readiness.

        Returns:
            Tuple of (valid_ready_drafts, stale_count, suppressed_count, unready_count)
        """
        if not self.sheets.spreadsheet:
            return [], 0, 0, 0

        try:
            ws = self.sheets.spreadsheet.worksheet(TAB_APPROVAL_QUEUE)
            records = ws.get_all_records()
        except Exception as e:
            logger.warning("Could not read Approval Queue tab: %s", str(e))
            return [], 0, 0, 0

        valid_drafts: List[Dict[str, Any]] = []
        stale_count = 0
        suppressed_count = 0
        unready_count = 0
        now = datetime.now(timezone.utc)

        # Lookup provenance URL from Lead Database for Approval Queue records if not present in tab
        lead_src_map = {}
        try:
            ws_ld = self.sheets.spreadsheet.worksheet(TAB_LEAD_DATABASE)
            for l_rec in ws_ld.get_all_records():
                lid = str(l_rec.get("lead_id", "")).strip()
                esrc = str(l_rec.get("email_source_url", "")).strip() or str(l_rec.get("source_url", "")).strip()
                if lid and esrc:
                    lead_src_map[lid] = esrc
        except Exception:
            pass

        for r in records:
            lid = str(r.get("lead_id", "")).strip()
            if not r.get("email_source_url") and lid in lead_src_map:
                r["email_source_url"] = lead_src_map[lid]

            status = str(r.get("status", "")).strip().upper()
            approval = str(r.get("approval", "")).strip().upper()

            # Only review pending un-sent drafts
            if status in ("SENT", "BOUNCED", "DECLINED", "UNSUBSCRIBED", "APPROVED"):
                continue

            # Check suppression
            email = str(r.get("public_email", "")).strip()
            website = str(r.get("website", "")).strip()
            is_supp, _ = self.suppression.is_suppressed(email, website)
            if is_supp:
                suppressed_count += 1
                continue

            # Check freshness
            created_str = str(r.get("created_at", "")).strip()
            if created_str:
                try:
                    created_dt = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
                    if (now - created_dt).days > MAX_DRAFT_AGE_DAYS:
                        stale_count += 1
                        continue
                except Exception:
                    pass

            # Readiness check: Every queued record must meet all evidence & drafting criteria
            is_ready, reason = validate_queued_draft(r)
            if not is_ready:
                logger.info("Draft for '%s' failed readiness check: %s", r.get("business", "Unknown"), reason)
                unready_count += 1
                continue

            valid_drafts.append(r)

        return valid_drafts, stale_count, suppressed_count, unready_count

    def get_undrafted_leads(self, existing_draft_ids: Set[str]) -> List[Dict[str, Any]]:
        """Retrieves qualified leads from the Lead Database that have not yet been drafted."""
        if not self.sheets.spreadsheet:
            return []

        try:
            ws = self.sheets.spreadsheet.worksheet(TAB_LEAD_DATABASE)
            records = ws.get_all_records()
        except Exception:
            return []

        undrafted = []
        for r in records:
            lid = str(r.get("lead_id", "")).strip()
            qstatus = str(r.get("qualification_status", "")).strip().upper()
            if qstatus == "QUALIFIED" and lid and lid not in existing_draft_ids:
                undrafted.append(r)

        return undrafted

    def run(self) -> Dict[str, Any]:
        """Executes the complete end-to-end morning queue orchestration pipeline."""
        start_time = datetime.now(timezone.utc)
        logger.info(
            "Starting 9 AM Morning Outreach Queue Pipeline (Target Ready: %d, Dry-Run: %s)",
            self.target_queue,
            self.dry_run,
        )

        # 1. Connect & Validate Credentials
        if not self.dry_run:
            validate_credentials(require_groq=True, require_sheets=True)
            if not self.sheets.connect():
                raise RuntimeError("Failed to connect to Google Sheets with configured credentials.")
            self.sheets.initialize_schema()
            supp_rows, sent_rows, queue_rows = self.sheets.load_historical_suppression_data()
            self.suppression.load_from_sheet_data(supp_rows, sent_rows, queue_rows)

        # 2. Audit Existing Reserve & Backlog
        existing_ready_drafts: List[Dict[str, Any]] = []
        stale_count = 0
        suppressed_in_queue = 0
        unready_in_queue = 0
        existing_draft_ids: Set[str] = set()

        if self.sheets.spreadsheet:
            existing_ready_drafts, stale_count, suppressed_in_queue, unready_in_queue = self.audit_existing_queue()
            existing_draft_ids = {str(d.get("lead_id", "")).strip() for d in existing_ready_drafts}
            logger.info(
                "Existing queue audit: %d drafts ready for approval, %d stale skipped, %d retro-suppressed, %d unready skipped",
                len(existing_ready_drafts),
                stale_count,
                suppressed_in_queue,
                unready_in_queue,
            )

        drawn_from_backlog = len(existing_ready_drafts)
        deficit = max(0, self.target_queue - drawn_from_backlog)

        new_qualified_leads: List[Dict[str, Any]] = []
        new_drafts: List[Dict[str, Any]] = []
        newly_discovered_count = 0
        needs_research_count = 0
        rejected_count = 0
        duplicate_count = 0
        suppressed_count = 0
        api_failures = 0
        shortage_reasons: List[str] = []

        # 3. If needed, draw from un-drafted qualified leads in Lead Database
        if deficit > 0 and not self.dry_run:
            undrafted = self.get_undrafted_leads(existing_draft_ids)
            logger.info("Found %d un-drafted qualified leads in Lead Database backlog.", len(undrafted))
            for lead in undrafted:
                if len(new_drafts) >= deficit:
                    break
                draft_data = self.groq.draft_outreach(lead, lead)
                if draft_data:
                    draft_record = {**lead, **draft_data}
                    is_ready, reason = validate_queued_draft(draft_record)
                    if is_ready:
                        new_drafts.append(draft_record)
                        existing_draft_ids.add(lead["lead_id"])
                    else:
                        logger.warning("Backlog draft failed readiness validation: %s", reason)
                        api_failures += 1
                else:
                    api_failures += 1

            deficit = max(0, self.target_queue - (drawn_from_backlog + len(new_drafts)))

        # 4. If deficit remains, execute live multi-industry discovery & research
        if deficit > 0:
            logger.info("Deficit of %d leads remains. Executing live candidate discovery...", deficit)
            candidates, _ = self.discovery.harvest_candidates(self.fetcher)
            newly_discovered_count = len(candidates)
            logger.info("Discovered %d candidates across target industries.", newly_discovered_count)

            for candidate in candidates:
                if len(new_drafts) + drawn_from_backlog >= self.target_queue:
                    logger.info("Target queue of %d ready leads achieved.", self.target_queue)
                    break

                website = candidate.get("website", "")
                is_supp, reason = self.suppression.is_suppressed("", website)
                if is_supp:
                    if "ALREADY_CONTACTED" in reason or "DUPLICATE" in reason:
                        duplicate_count += 1
                    else:
                        suppressed_count += 1
                    continue

                research_result = self.researcher.investigate(candidate)
                if not research_result:
                    rejected_count += 1
                    continue

                public_email = research_result["public_email"]
                is_supp, reason = self.suppression.is_suppressed(public_email, website)
                if is_supp:
                    if "ALREADY_CONTACTED" in reason or "DUPLICATE" in reason:
                        duplicate_count += 1
                    else:
                        suppressed_count += 1
                    continue

                new_qualified_leads.append(research_result)

                if research_result["qualification_status"] == "QUALIFIED":
                    if self.groq.is_available() and not self.dry_run:
                        draft_data = self.groq.draft_outreach(candidate, research_result)
                        if draft_data:
                            draft_record = {**research_result, **draft_data}
                            is_ready, reason = validate_queued_draft(draft_record)
                            if is_ready:
                                new_drafts.append(draft_record)
                                existing_draft_ids.add(research_result["lead_id"])
                            else:
                                logger.warning("New draft failed readiness validation: %s", reason)
                                api_failures += 1
                        else:
                            api_failures += 1
                    elif self.dry_run:
                        # Simulated draft for dry run
                        sim_record = {
                            **research_result,
                            "subject": f"Web workflow inquiry for {research_result['business']}",
                            "email_body": (
                                f"I noticed your portal at {research_result['website']} handles inquiries via standard mailto links.\n\n"
                                f"{research_result['proof_line']}\n\n"
                                "Would you be open to a 5-minute conversation on streamlining this workflow?"
                            ),
                            "alt_opening_1": f"I was reviewing {research_result['business']}'s online resources recently.",
                            "alt_opening_2": f"Your digital portal at {research_result['website']} came to my attention.",
                            "word_count": 48,
                        }
                        is_ready, reason = validate_queued_draft(sim_record)
                        if is_ready:
                            new_drafts.append(sim_record)
                            existing_draft_ids.add(research_result["lead_id"])
                else:
                    needs_research_count += 1
                    rejected_count += 1

        end_time = datetime.now(timezone.utc)
        duration = int((end_time - start_time).total_seconds())

        total_ready_for_approval = drawn_from_backlog + len(new_drafts)
        qualified_overnight = len(new_drafts)
        shortage = max(0, self.target_queue - total_ready_for_approval)

        if shortage > 0:
            if rejected_count > 0:
                shortage_reasons.append(f"{rejected_count} candidates lacked verifiable public business emails or missed technical criteria")
            if suppressed_count > 0:
                shortage_reasons.append(f"{suppressed_count} candidates excluded by suppression rules")
            if duplicate_count > 0:
                shortage_reasons.append(f"{duplicate_count} candidates were previously contacted duplicates")
            if api_failures > 0:
                shortage_reasons.append(f"{api_failures} drafts failed Groq validation or rate limits")

        summary = {
            "run_id": f"morning_{int(start_time.timestamp())}",
            "campaign_name": self.campaign_cfg.get("name", "OneFolk Multi-Industry Pilot 2026"),
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "duration_seconds": duration,
            "target_queue": self.target_queue,
            "ready_for_approval": total_ready_for_approval,
            "drawn_from_backlog": drawn_from_backlog,
            "qualified_overnight": qualified_overnight,
            "newly_discovered_today": newly_discovered_count,
            "needs_research": needs_research_count,
            "rejected": rejected_count,
            "suppressed_or_duplicate": suppressed_count + duplicate_count,
            "api_failures": api_failures,
            "shortage": shortage,
            "shortage_reasons": shortage_reasons,
            "is_campaign_ready": total_ready_for_approval >= self.target_queue,
            "status": "COMPLETED",
        }

        # 5. Synchronize with Master Google Sheet
        if not self.dry_run and self.sheets.spreadsheet:
            if new_qualified_leads:
                self.sheets.upsert_leads(new_qualified_leads)
            if new_drafts:
                self.sheets.upsert_approval_queue(new_drafts)
            self.sheets.record_campaign_run({
                "duration_seconds": duration,
                "prospects_discovered": newly_discovered_count,
                "prospects_scraped": self.fetcher.count,
                "qualified_leads": total_ready_for_approval,
                "needs_research": needs_research_count,
                "emails_drafted": total_ready_for_approval,
                "ai_calls_used": self.groq.calls_used,
                "http_fetches_used": self.fetcher.count,
                "status": "READY" if summary["is_campaign_ready"] else "SHORTAGE",
            })
            self.sheets.update_dashboard({
                "prospects_discovered": newly_discovered_count,
                "prospects_scraped": self.fetcher.count,
                "qualified_leads": total_ready_for_approval,
                "emails_drafted": total_ready_for_approval,
                "duration_seconds": duration,
                "ai_calls_used": self.groq.calls_used,
            })
            logger.info("Synchronized morning queue to Master Google Sheet.")

        # 6. Generate GitHub Step Summary and Log Output
        markdown_report = self._format_markdown_report(summary)
        try:
            print(markdown_report)
        except UnicodeEncodeError:
            print(markdown_report.encode("ascii", errors="replace").decode("ascii"))
        self._write_github_step_summary(markdown_report)

        return summary

    def _format_markdown_report(self, summary: Dict[str, Any]) -> str:
        """Formats the 9 AM morning digest as a rich GitHub Markdown summary."""
        sheet_url = f"https://docs.google.com/spreadsheets/d/{self.sheets.spreadsheet_id}/edit"
        status_badge = "[STATUS: READY FOR 9 AM APPROVAL]" if summary["is_campaign_ready"] else "[STATUS: QUEUE SHORTAGE ALERT]"

        lines = [
            f"# {status_badge}",
            "",
            f"**Campaign:** {summary['campaign_name']}  ",
            f"**Target Queue:** {summary['target_queue']} leads  ",
            f"**Ready in Queue:** **{summary['ready_for_approval']} leads**  ",
            f"**Master Google Sheet:** [Open Approval Queue]({sheet_url})  ",
            "",
            "## Morning Queue Breakdown",
            "",
            "| Metric | Count | Operational Notes |",
            "| :--- | :---: | :--- |",
            f"| **Ready for Human Approval at 9 AM** | **{summary['ready_for_approval']}** | Human review required; dual-key sending locked |",
            f"| Drawn from Validated Backlog | {summary['drawn_from_backlog']} | Evergreen reserve verified and fresh |",
            f"| Qualified Overnight | {summary['qualified_overnight']} | Newly researched and drafted overnight |",
            f"| Newly Discovered Today | {summary['newly_discovered_today']} | Total public candidates harvested |",
            f"| Needs Research | {summary['needs_research']} | Incomplete technical signals or no contact |",
            f"| Disqualified / Rejected | {summary['rejected']} | Unverifiable domain or score < 60 |",
            f"| Suppressed or Duplicate | {summary['suppressed_or_duplicate']} | Previously contacted or on suppression list |",
            f"| API / Validation Failures | {summary['api_failures']} | Rate limit or grounding filter rejects |",
            "",
        ]

        if summary["shortage"] > 0:
            lines.extend([
                "### Shortfall Diagnostic",
                f"- **Shortage:** {summary['shortage']} leads below target of {summary['target_queue']}.",
                f"- **Reasons:** {'; '.join(summary['shortage_reasons']) if summary['shortage_reasons'] else 'Limited public candidates matching criteria'}",
                "- *Quality Guarantee: No leads were fabricated to artificially fill the queue.*",
                "",
            ])

        lines.extend([
            "## Safety & Authorization Protocols",
            "- **Live Gmail Sending:** `STRICTLY DISABLED` (Requires double-key `'APPROVED'` in Sheet and `ENABLE_SENDING=YES`).",
            "- **Daily Send Cap:** 50 recipients per Indian Standard Time (IST) calendar day.",
            "- **Email Quality:** Strictly 3 paragraphs, under 70 words, approved portfolio proof line included verbatim.",
            "",
            f"*[OneFolk Outreach Engine](https://onefolk.in) • Execution duration: {summary['duration_seconds']}s*",
        ])

        return "\n".join(lines)

    def _write_github_step_summary(self, markdown_text: str):
        """Appends the formatted report to $GITHUB_STEP_SUMMARY if available."""
        summary_path = os.getenv("GITHUB_STEP_SUMMARY")
        if summary_path:
            try:
                with open(summary_path, "a", encoding="utf-8") as f:
                    f.write("\n" + markdown_text + "\n")
            except Exception as e:
                logger.debug("Could not write to GITHUB_STEP_SUMMARY: %s", str(e))
