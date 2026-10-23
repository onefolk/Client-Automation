# Production operations and acceptance

Production is `Giridharan-E/Client-Automation`, default branch `main`. Only
`morning_queue.yml` performs scheduled Sheet writes. Former discovery, draft,
send-sync and reconcile workflows are inert dispatch-only notices. All operational
jobs require the exact production repository and branch. The original repository
is not a deployment target.

## Runtime

Sunday–Thursday 22:00 IST starts research for the following weekday. Monday–Friday
00:47, 04:47 and 06:47 IST continue bounded batches. At 08:30 IST a read-only queue
audit republishes current counts. UTC cron expressions encode these IST times;
Python uses `Asia/Kolkata` for campaign dates. The shared concurrency group prevents
competing pipeline writers. An already-completed slot re-audits instead of spending
another AI batch. No workflow dispatch is required for routine use.

The Sheet `Automation State` stores source cursors, company IDs, research, draft
outboxes, reserved budgets, and heartbeat records. Persisted drafts survive Sheet
write failures; failed discovery partitions resume without duplicate candidates.
The inventory is replenished toward 100 fresh pending drafts, with 50 as the morning
review target. Research expires after seven days; stale pending records are excluded
and automatically researched again. Rejected/contacted companies are suppressed.
Missing evidence or failed AI output never becomes READY.

Each batch is limited to 25 research candidates, 160 HTTP requests and ten minutes
of pipeline work (12-minute runner timeout). At most 30 AI attempts per batch and
120 reserved attempts per campaign day are allowed, including retries. A failed
process does not refund reserved quota. Pipeline runner reservations stop at 1,500
minutes per month and warn at 1,200. CI and other repositories also consume account
allowances; verify account budgets separately and keep paid overage disabled.

`config/public_sources.json` controls permitted source endpoint, cities, bounding
boxes and industry selectors. `config/campaigns.json` controls industry/location
filters and exclusions. The source rotates industries/cities and four subareas;
do not treat map tags as proof of official identity or contact validity.

`Morning Health`, `Campaign Runs`, and `Source Performance` expose actual live
readback counts, source failures, quota reservations, campaign IDs, trigger type,
workflow URL, and timestamps. A Step Summary is not an email notification.

## One-time cloud deployment

1. Push reviewed code to fork `main`; ensure the morning workflow is enabled.
2. Environment `scraper` must contain `SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, and
   `GROQ_API_KEY`; unattended scheduling must not require an environment approval.
   Preflight tests authentication; an unreadable safety/history tab fails closed.
3. Deploy both `apps-script/Code.gs` and `apps-script/Morning.gs`, plus the manifest,
   to the existing bound project. Run `installTriggers` once as the authorized
   OneFolk account. This installer forces sending OFF and installs an edit audit,
   five-minute watchdog, hourly sender, and two-hour reply monitor.
4. Verify the installed trigger list, a real watchdog execution and an internal
   digest delivery to `contact.onefolk@gmail.com`. Google may require owner OAuth
   consent for GmailApp/MailApp scopes. A service-account Sheet login cannot replace
   the owner's Apps Script authorization. Do not call this deployed before verification.
5. Let the native schedule execute. Record its `event=schedule` run URL, timestamps,
   live records and subsequent checkpoint progress. A local run or workflow_dispatch
   is deployment testing only.

## Review and sending

Use the existing Approval Queue. Read the evidence and complete draft, optionally
edit, then set that row's `approval` to APPROVED or REJECTED. The installed edit
handler validates each row, requires an identifiable reviewer, writes `Approval
Audit`, binds approval to a SHA-256 content fingerprint and sets the second status
key. Bulk edits cannot approve. Content changes invalidate the approval. Existing
human notes are preserved by pending-draft refreshes. If Google does not expose
reviewer identity, approval fails closed; resolve account identity before use.

Sending is actively unlocked (`IMPLEMENTATION_SENDING_LOCK = false`, `ENABLE_SENDING = YES`)
and operates during business hours (09:00 - 18:00 IST Mon-Fri) for leads with dual approval.
The gateway reserves recipient quota before contacting Gmail, caps at 50 per IST day (with
a 10-lead daily review target), checks actual Google quota and suppression, and holds
uncertain outcomes in SEND_REVIEW. No automatic retry of ambiguous sends. Gmail message/thread
IDs are recorded. Reply classification never sends replies, negotiates or quotes prices.

The independent watchdog runs around 08:45–09:00 IST, reads current eligibility
and cloud heartbeats, and reports failures/shortages to the authorized internal
account. It also detects stale/missing cloud execution without GitHub running.
Ambiguous digest delivery is held for review, not resent automatically. Apps Script
timers and GitHub cron have no hard delivery-time SLA; delayed/skipped execution is
detected and reported, not described as a guaranteed 09:00 delivery.

Missing credentials, source failure, stale research and Sheet failures surface via
heartbeats and failed Actions runs. Bounce >=5% or decline >=10% with at least ten
contacted rows halts sending when the watchdog evaluates the queue. Provider spam
complaints cannot be inferred reliably from Gmail/MX and remain an observability
gap. The web app remains a separate local tool; it is not a production approval UI.
