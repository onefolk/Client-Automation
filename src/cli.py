"""Command-line interface and orchestrator for the OneFolk Outreach Engine."""

import argparse
from datetime import datetime, timezone
import json
import logging
import sys
import time
from typing import Any, Dict, List, Optional, Set, Tuple

from src.config import QUALIFIED_TARGET, get_active_campaign
from src.discovery import DiscoveryEngine
from src.groq_client import GroqClient
from src.network import SafeFetcher
from src.research import ProspectResearcher
from src.sheets import SheetsManager
from src.suppression import SuppressionManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("onefolk")


def run_pipeline(
    target_count: int = QUALIFIED_TARGET,
    dry_run: bool = False,
    campaign_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Executes the full discovery, research, drafting, and sheet sync pipeline."""
    start_time = datetime.now(timezone.utc)
    logger.info("Starting OneFolk Outreach Pipeline (target: %d leads, dry_run=%s)", target_count, dry_run)

    # 1. Initialize Managers
    campaign_cfg = get_active_campaign()
    if campaign_name:
        campaign_cfg["name"] = campaign_name

    fetcher = SafeFetcher()
    discovery = DiscoveryEngine(campaign_cfg)
    researcher = ProspectResearcher(fetcher)
    suppression = SuppressionManager()
    groq = GroqClient()
    sheets = SheetsManager()

    # 2. Validate Credentials & Connect to Sheets (if not in mock dry-run)
    if not dry_run:
        from src.config import validate_credentials
        validate_credentials(require_groq=True, require_sheets=True)

        if not sheets.connect():
            raise RuntimeError("CRITICAL: Failed to connect to Google Sheets with configured credentials.")

        sheets.initialize_schema()
        supp_rows, sent_rows, queue_rows = sheets.load_historical_suppression_data()
        suppression.load_from_sheet_data(supp_rows, sent_rows, queue_rows)
        logger.info(
            "Loaded suppression baseline: %d suppressed emails, %d historical contacts",
            len(suppression.suppressed_emails),
            len(suppression.contacted_emails),
        )

        if not groq.is_available():
            raise RuntimeError("CRITICAL: Groq API client is not configured or unavailable.")

    # 3. Discovery Phase
    candidates, disc_report = discovery.harvest_candidates(fetcher)
    logger.info("Harvested %d prospect candidates across target industries", len(candidates))

    # 4. Research & Qualification Phase
    researched_leads: List[Dict[str, Any]] = []
    drafts: List[Dict[str, Any]] = []
    qualified_count = 0
    needs_research_count = 0
    researched_count = 0
    duplicate_count = 0
    suppressed_count = 0
    rejected_count = 0
    api_failures_count = 0
    shortage_reasons: List[str] = []

    for candidate in candidates:
        if qualified_count >= target_count:
            logger.info("Reached qualification target of %d leads. Concluding research.", target_count)
            break

        website = candidate.get("website", "")
        # Check domain suppression / deduplication
        is_supp, reason = suppression.is_suppressed("", website)
        if is_supp:
            if "ALREADY_CONTACTED" in reason or "DUPLICATE" in reason:
                duplicate_count += 1
            else:
                suppressed_count += 1
            logger.debug("Skipping candidate: %s", reason)
            continue

        researched_count += 1
        # Conduct bounded crawl and signal extraction
        research_result = researcher.investigate(candidate)
        if not research_result:
            rejected_count += 1
            continue

        public_email = research_result["public_email"]
        is_supp, reason = suppression.is_suppressed(public_email, website)
        if is_supp:
            if "ALREADY_CONTACTED" in reason or "DUPLICATE" in reason:
                duplicate_count += 1
            else:
                suppressed_count += 1
            logger.debug("Skipping researched contact: %s", reason)
            continue

        researched_leads.append(research_result)

        if research_result["qualification_status"] == "QUALIFIED":
            qualified_count += 1
            # 5. Groq AI Drafting Phase
            if groq.is_available() and not dry_run:
                draft_data = groq.draft_outreach(candidate, research_result)
                if draft_data:
                    draft_record = {**research_result, **draft_data}
                    drafts.append(draft_record)
                else:
                    api_failures_count += 1
            elif dry_run:
                # Simulated draft for dry run
                drafts.append({
                    **research_result,
                    "subject": f"Web workflow inquiry for {research_result['business']}",
                    "email_body": (
                        f"I noticed your portal at {research_result['website']} handles admissions via standard mailto links.\n\n"
                        f"{research_result['proof_line']}\n\n"
                        "Would you be open to a 5-minute conversation on streamlining this workflow?"
                    ),
                    "alt_opening_1": f"I was reviewing {research_result['business']}'s online resources recently.",
                    "alt_opening_2": f"Your digital portal at {research_result['website']} came to my attention.",
                    "word_count": 48,
                })
        else:
            needs_research_count += 1
            rejected_count += 1

    end_time = datetime.now(timezone.utc)
    duration = int((end_time - start_time).total_seconds())

    if qualified_count < target_count:
        if rejected_count > 0:
            shortage_reasons.append(f"{rejected_count} candidates lacked verifiable public contact emails or failed qualification threshold")
        if suppressed_count > 0:
            shortage_reasons.append(f"{suppressed_count} candidates were excluded by suppression rules")
        if duplicate_count > 0:
            shortage_reasons.append(f"{duplicate_count} candidates were previously contacted duplicates")
        if api_failures_count > 0:
            shortage_reasons.append(f"{api_failures_count} drafting attempts failed due to rate limits or validation rejects")

    summary = {
        "run_id": f"run_{int(start_time.timestamp())}",
        "campaign_name": campaign_cfg.get("name", "OneFolk Pilot"),
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "duration_seconds": duration,
        "prospects_discovered": len(candidates),
        "prospects_researched": researched_count,
        "prospects_scraped": fetcher.count,
        "qualified_leads": qualified_count,
        "needs_research": needs_research_count,
        "emails_drafted": len(drafts),
        "duplicate_count": duplicate_count,
        "suppressed_count": suppressed_count,
        "rejected_count": rejected_count,
        "api_failures": api_failures_count,
        "ai_calls_used": groq.calls_used,
        "http_fetches_used": fetcher.count,
        "target_qualified": target_count,
        "shortage": max(0, target_count - qualified_count),
        "shortage_reasons": shortage_reasons,
        "status": "COMPLETED",
    }

    # 6. Synchronize to Master Google Sheets
    if not dry_run and sheets.spreadsheet:
        sheets.upsert_leads(researched_leads)
        sheets.upsert_approval_queue(drafts)
        sheets.record_campaign_run(summary)
        sheets.update_dashboard(summary)
        logger.info("Synchronized all discoveries and drafts to Google Sheet.")

    # 7. Print Comprehensive Campaign Metrics
    logger.info(
        "\n============================================================\n"
        "ONEFOLK CAMPAIGN EXECUTION METRICS\n"
        "============================================================\n"
        "  * Discovered:      %d candidates across target industries\n"
        "  * Researched:      %d candidate websites investigated\n"
        "  * Qualified:       %d leads met qualification criteria (Target: %d)\n"
        "  * Drafted:         %d emails in Approval Queue (Status: DRAFTED)\n"
        "  * Duplicate:       %d historical duplicate contacts prevented\n"
        "  * Suppressed:      %d contacts excluded by suppression list\n"
        "  * Rejected:        %d disqualified (no contact/unverifiable signals)\n"
        "  * API Failures:    %d\n"
        "  * Execution Time:  %ds\n"
        "  * Shortage:        %d %s\n"
        "============================================================",
        summary["prospects_discovered"],
        summary["prospects_researched"],
        summary["qualified_leads"],
        summary["target_qualified"],
        summary["emails_drafted"],
        summary["duplicate_count"],
        summary["suppressed_count"],
        summary["rejected_count"],
        summary["api_failures"],
        duration,
        summary["shortage"],
        f"({'; '.join(shortage_reasons)})" if shortage_reasons else "(None - Target Achieved)",
    )

    return summary


def preflight_check(require_groq: bool = True) -> bool:
    """Executes a fail-fast credential and connectivity check without printing secret values."""
    logger.info("Executing fail-fast credential preflight check (require_groq=%s)...", require_groq)
    from src.config import validate_credentials
    try:
        details = validate_credentials(require_groq=require_groq, require_sheets=True)
        logger.info(
            "Preflight syntax passed: Sheet ID length %d, Service Account: %s, Groq: %s.",
            details.get("sheet_id_length", 0),
            details.get("service_account_email", "N/A"),
            "configured" if details.get("groq_configured") else "skipped",
        )
    except ValueError as e:
        logger.error(str(e))
        return False

    # Connectivity checks
    from src.sheets import SheetsManager
    sheets = SheetsManager()
    if not sheets.connect():
        logger.error("Preflight failed: Could not connect to Google Sheets with configured GOOGLE_SERVICE_ACCOUNT_JSON.")
        return False
    logger.info("Google Sheets connection verified: '%s'", sheets.spreadsheet.title if sheets.spreadsheet else "OK")

    if require_groq:
        from src.groq_client import GroqClient
        groq = GroqClient()
        if not groq.test_connection():
            logger.error("Preflight failed: Groq API key could not authenticate with Groq API.")
            return False
        logger.info("Groq API authentication and connectivity verified.")

    logger.info("All preflight credential and API checks PASSED.")
    return True


def main():
    """CLI parser and router."""
    parser = argparse.ArgumentParser(description="OneFolk Outreach Engine CLI")
    subparsers = parser.add_subparsers(dest="command", help="Subcommand to execute")

    run_parser = subparsers.add_parser("run", help="Execute complete cloud discovery, research and drafting")
    run_parser.add_argument("--target", type=int, default=QUALIFIED_TARGET, help="Target qualified leads count")
    run_parser.add_argument("--dry-run", action="store_true", help="Run in mock/dry-run mode without external mutations")

    dry_parser = subparsers.add_parser("dry-run", help="Run simulated dry run with zero network/API side effects")
    dry_parser.add_argument("--target", type=int, default=10, help="Target lead count for dry run")

    morning = subparsers.add_parser("morning-queue", help="Durable scheduled discovery and drafting")
    morning.add_argument("--target", type=int, default=50)
    morning.add_argument("--publish-only", action="store_true")

    reconcile_parser = subparsers.add_parser("reconcile", help="Reconcile statuses, approvals and suppressions")

    preflight_parser = subparsers.add_parser("preflight", help="Validate credentials and API connectivity")
    preflight_parser.add_argument(
        "--no-groq",
        action="store_true",
        help="Skip Groq validation if not required by workflow",
    )

    args = parser.parse_args()

    if args.command in ("run", None):
        target = getattr(args, "target", QUALIFIED_TARGET)
        dry = getattr(args, "dry_run", False)
        run_pipeline(target_count=target, dry_run=dry)
    elif args.command == "dry-run":
        target = getattr(args, "target", 10)
        run_pipeline(target_count=target, dry_run=True)
    elif args.command == "morning-queue":
        from src.morning_queue import MorningQueueManager
        print(json.dumps(MorningQueueManager(args.target).run(publish_only=args.publish_only), indent=2))
    elif args.command == "reconcile":
        sheets = SheetsManager()
        if sheets.connect():
            sheets.update_dashboard()
            logger.info("Reconciliation complete.")
        else:
            logger.error("Could not connect to Google Sheets for reconciliation.")
            sys.exit(1)
    elif args.command == "preflight":
        require_groq = not getattr(args, "no_groq", False)
        success = preflight_check(require_groq=require_groq)
        sys.exit(0 if success else 1)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
