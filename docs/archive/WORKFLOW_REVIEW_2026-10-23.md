# Google automation workflow review — 23 October 2026

Reviewed local main through `d9686ee`, the Python pipeline, GitHub workflow definitions, Apps Script server and HTML dashboard, tests, and connected master Sheet. The independent Vercel deployment and `apps/web` code were excluded. This is an audit, not an implementation or deployment change.

Production requirements supplied by the operator: preserve intentional live sending; human review goal is 10/day; dispatch ceiling is 50 recipients/IST day; business hours are weekdays 09:00–18:00 IST. These are distinct settings, not inherently conflicting requirements.

## Observed live state

Read-only snapshot of [the master Sheet](https://docs.google.com/spreadsheets/d/1U3JxQUcxSyqfZySnHNdLIwExtr3ikfcYlj0a3YY7ATM/edit):

| Surface | Observed value |
|---|---|
| Approval Queue | 51 records: 25 SENT, 26 APPROVED; no pending review records |
| Email Activity | 26 SENT records, including one internal test; all reply_status values NONE |
| Latest Morning Health | Run 39909139570, schedule, SHORTFALL; completed 23 October 11:34:11 IST |
| Latest run counters | 16 discovered, 0 qualified overnight, 0 ready, 95 needing research, 0 qualified reserve, shortage 50 |
| Dashboard Sheet | 50 qualified, 0 requiring research, 0 approved, 0 sent — stale against the queue |
| Approval Audit | One fingerprint cell reads #ERROR! for lead_ce9dc2dc73a29604 |

These are recorded Sheet states, not independent confirmation of Gmail delivery or of the currently deployed Apps Script version. Earlier campaign timestamps remain UTC offsets; converting them to IST is correct and does not require rewriting historical instants. The latest source uses Asia/Kolkata for campaign dates and checkpoint writes, and the dashboard explicitly formats IST.

## Required updates, by priority

### P1 — Make stops persist without disabling normal authorized production

`apps-script/Code.gs:417` automatically changes ENABLE_SENDING to YES whenever the compile-time lock is false. `emergencyStop()` at line 704 and `disableProductionSendingNow()` only set ENABLE_SENDING to NO. Therefore the watchdog's bounce/decline stop and the trigger installer's stop are undone on the next sender execution. The dashboard's separate emergency-stop endpoint additionally sets EMERGENCY_STOP_ACTIVE and does persist.

Reproduced with shipped code and mocked services: emergencyStop → ENABLE_SENDING=NO → approvedSender → ENABLE_SENDING=YES. No Gmail service was available in this probe.

Update: remove sender-side auto-activation; use one persistent stop state for all stop paths and an explicit authenticated resume action. Preserve the currently authorized live configuration. Recheck stop state immediately before each send; the dashboard stop currently does not interrupt a sender already inside its loop. Make the business-hours check fail closed on formatting errors and enforce the closing boundary consistently.

### P1 — Stop manufacturing evidence during approval

`apps-script/Morning.gs:8` substitutes missing qualification, MX status, proof verification, evidence URLs, alternate openings and verification time. `WebApp.gs:729` and `:919` also manufacture qualification metadata during approval. Neither approval method calls reviewableRecord before committing approval. This diverges from `src/quality.py`, which requires explicit evidence.

Reproduced: a draft missing company ID, source URLs, verification timestamp, MX status, qualification/proof verification and alternate openings still passes reviewableRecord when updated_at is recent. This is a code defect demonstration, not a claim that the current 26 approved records lack those columns.

Update: run the same strict evidence contract before approval and dispatch; missing research must stay missing. Validate portfolio project/proof/URL combinations against the approved configuration. Require valid approval metadata whenever activation freshness is enforced: `Code.gs:274` currently skips the freshness check when metadata is absent. Retire the fingerprint-sync helper's fabricated reviewer and fresh batch approval timestamps.

### P1 — Restrict callable helpers and state-changing HTTP routes

`Code.gs:38–42` exposes getProp/setProp without authorization, as well as unguarded activation and fingerprint helpers. Apps Script top-level functions are client-callable unless private; protecting only api-prefixed methods does not protect these helpers. Google documents the trailing-underscore private-function convention in its [HTML communication guide](https://developers.google.com/apps-script/guides/html/communication#private_functions).

Update: make internal helpers private and guard public entrypoints; preserve the trigger entrypoints with appropriate execution checks. Remove authorize_sending, internal_test, emergency_stop and cancel_approval mutations from the GET router (`WebApp.gs:104–114`). Use authenticated mutation calls with deliberate user intent. Review effective-user fallback against the actual deployment execution mode; the checked-in manifest is USER_ACCESSING, so owner-mode exposure is conditional, not established here.

### P1 — Prevent lost human edits across Python and Apps Script writers

`src/reserve.py:41` reads rows and later overwrites whole pending rows. Apps Script uses a script lock, which Python does not acquire. A human approval after Python's read can consequently be overwritten by a pending-draft refresh. Batch approval/rejection (`WebApp.gs:970`, `:1078`) rewrites the entire table snapshot, also risking overwriting intervening pipeline updates or failing after concurrent row additions.

Update: use one mutation gateway or shared coordination protocol, row versions, and compare-before-commit semantics; update only owned cells. Resolve IDs at commit time. The workflow also allows both original and production repositories; narrow it to the intended production writer. Two recorded scheduled runs, 39909069749 and 39909139570, have overlapping execution intervals. Verify the actual deployed workflows; Sheet timestamps alone do not identify the cause.

### P1 — Reprocess the old research backlog after the research upgrade

The commercial and hospitality patterns and navigation keywords are present. However `src/morning_queue.py:127` skips every NEEDS_RESEARCH prospect for 14 days after its last attempt. Updating the researcher does not invalidate these stored failures. The observed 95-item backlog therefore cannot be considered resolved just from the source update.

Update: store a research-version identifier and reason-specific retry times. Requeue failures from the older researcher; distinguish transient network/robots/source failures from genuine absence of evidence. Verify the migration and resulting yield on live readback before declaring the backlog fixed.

### P1 — Complete commercial opportunity and portfolio mapping

`src/strict_research.py:78` still turns every DIRECT_EMAIL_INTAKE observation into an admissions/inquiry portal recommendation. Manual menu downloads receive a manual-form submission recommendation. At line 84, the strict researcher overrides the base researcher's selected portfolio with OneFolk website for every prospect.

Update: retain evidence-based workflow categories for ordering, reservations, events, accommodation and other operations; select a relevant supported portfolio entry with its exact proof. Align the score's service-fit explanation with the final selected project. Six configured portfolio entries do not currently mean six are used by the scheduled strict pipeline.

### P2 — Apply the 10-review goal separately from the 50-send ceiling

The desired distinction is valid, but `.github/workflows/morning_queue.yml` passes --target 50 in both branches. `src/morning_queue.py:206` uses that value as the high-priority review shortage target. `Morning.gs:144` and the digest also hardcode 50. Consequently 10 eligible high-priority drafts can satisfy the dashboard while the pipeline/watchdog still reports shortage 40.

Update: centralize review_goal=10, send_cap=50 and reserve_goal independently. Pass the review goal to the queue calculation and digest, retaining the sender's 50-recipient ceiling. Remove the missing-score fallback of 85 in the Python priority calculation. Update residual documentation that still describes 50 as the review goal.

### P2 — Make dashboard metrics authoritative and current

The live Dashboard Sheet is demonstrably stale. The scheduled morning manager updates Morning Health but not Dashboard; sender and reply monitor do not refresh Dashboard either. `WebApp.gs:252` counts ready rows from status alone, without the eligibility/suppression checks used by automationSnapshot. Its discovery fallback can replace a legitimate zero discovered today with total inventory. Several CRM counters default to zero without a tracked source. The HTML fabricates score breakdown components when missing (`Index.html:2428`).

Update: define metric sources, date windows and eligibility once; refresh the Sheet and UI from that aggregation. Separate sent-ever, sent-today, replies, approved-but-not-sendable and pending-review. Report unavailable values explicitly. Add last-refreshed time and polling or a clearly visible manual refresh. Local mock fallback (`Index.html:1904`) must be explicitly labeled demo mode and must not simulate successful production actions without that distinction.

### P2 — Protect final states and make audits reliable

`apiSaveDraft` does not prohibit editing already-sent records. `apiApproveLead` writes subject/body before checking final status. Reject and mark-needs-research actions do not consistently prohibit terminal-state changes. Preserve immutable sent content and restrict state transitions server-side.

The single-approval setCell helper at `WebApp.gs:765` tests !r[name] after filling r[name], so it fails to persist those defaults and can hash a different record from the one stored. Remove evidence defaults, then fingerprint the actual validated persisted record.

`recordAuditEntry` catches failures and returns normally; approval may succeed without a durable audit. The observed #ERROR! fingerprint cell needs investigation and reconciliation against Script Properties; its cause was not established from the readable Sheet export. Persist fingerprints as explicit text, fail approval closed on audit failure, and avoid claiming atomicity across separate property and Sheet writes.

### P2 — Harden reply reconciliation and operational alerts

`Code.gs:630` searches with -in:sent, even though replies often belong to conversations containing sent messages. Verify this against real threads; prefer recorded thread IDs and inbound-message filtering. Classification scans quoted text and keyword matches, allowing quoted outreach language to influence reply classification. Only 250 message IDs are retained; older messages within the 14-day search window can be processed again. Matching is by recipient email rather than send/message identity.

Update: use durable message checkpoints, chronological inbound processing, quoted-text removal and thread/message correlation. Reconcile delivery and reply fields consistently and expose the last successful reply-monitor execution. No independent inbox inspection was performed, so NONE values do not prove that replies were missed.

`morning_queue.py:56` treats only READY slots as completed; SHORTFALL reruns can reserve another batch. Failed runs do not append a Campaign Runs failure row. Health last_success is also written for SHORTFALL, which should be labeled execution success separately from target readiness. Update slot completion semantics, failure telemetry, and watchdog status accordingly.

## Validation and deployment limits

- Python: 71 passed, 2 live integration tests deliberately deselected; credentials blanked for the test process.
- Apps Script dashboard Node harness: all 15 backend acceptance scenarios passed.
- Additional isolated shipped-code probes reproduced stop auto-reactivation and missing-evidence acceptance. Existing passing tests do not cover these failures.
- Read-only GitHub Actions API request returned 404; deployment SHA, actual workflow inventory and logs were not independently verified.
- The connected Sheet is readable, but Apps Script deployment version, Script Properties, installed triggers, trigger owner and execution history were not inspected. Source and Sheet observations must not be presented as confirmation of those settings.
- No production data, sending configuration, trigger, deployment or outbound message was changed. Only this audit document was added.

Recommended implementation order: persistent stops and callable-surface protection; evidence/approval consistency and write coordination; versioned backlog retries and portfolio mapping; shared targets/metrics; reply monitoring, audits and deployment verification. Preserve authorized live sending throughout routine changes and validate behavioral fixes with isolated fixtures before deployment.
