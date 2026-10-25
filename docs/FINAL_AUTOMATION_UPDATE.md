# Local automation hardening — 2026-10-24

## Scope

This update covers the Python discovery/research/drafting pipeline, Google Sheets queue and reporting, Apps Script dashboard/approval/dispatch/replies, and GitHub Actions orchestration. The independent Vercel application was excluded. No production settings, mail, deployment, or Git push were performed.

## Corrections

- Dispatch rejects malformed quota counters and hourly limits. Safety-rate checks run before dispatch and on every business-hours watchdog invocation, even after the daily digest has already been delivered. Emergency-stop checks preserve coherent approval state while retaining conservative quota reservation.
- Batch approval and rejection write only selected decision cells, preserving concurrent appended rows and unrelated operator edits. Existing append-only queue revisions remain intact.
- Reply classification ignores quoted history, uses bounded phrases instead of loose substrings, examines the full reply, and routes uncertain wording to manual review.
- Dashboard lifecycle counts include sent leads that subsequently reply, bounce, or decline; positive replies are counted. Read failures preserve existing dashboard data.
- Browser editor validation uses the server validator source. Python and Apps Script normalize additional Unicode/control whitespace consistently and share explicit pronoun boundaries. Alternative opening edits preserve the greeting and practical relevance.
- Crawling pins verified public destinations, checks every redirect and robots permission, bounds DNS workers, streams bounded payloads, and applies a shared fetch deadline. Oversized and compressed responses are rejected rather than interpreted as partial evidence. HTML is capped at 1 MB, robots at 100 KB; the trusted discovery API has a separate 4 MB cap. urllib3 is constrained to the tested API family supporting read1.
- Research requires distinctive identity tokens and maps observations to relevant portfolio projects, verifying the selected proof anchor or title. Research version 3 invalidates older cached research. Restaurant discovery is enabled.
- Malformed queue field types are quarantined instead of aborting processing. Groq retry handling rejects invalid delays and supports HTTP-date Retry-After values.
- Scheduled attempts include GitHub run identity, preventing repeated cron expressions from incorrectly sharing a completion checkpoint. SHORTFALL returns a nonzero CLI exit code. Legacy live pipeline calls route through the morning queue.
- Supported production writer entry points require the serialized main-branch Morning Queue workflow. CI tests receive no production credentials, and Node is explicitly installed before Python tests that invoke JavaScript.

## Verification

Local automated suites: pytest, npm dashboard acceptance tests, and Apps Script sandbox runtime checks. Tests exercise malformed quota configuration, repeated watchdog checks, concurrent queue appends during batch decisions, Unicode validation, reply classification, payload bounds, robots redirects, malformed rows, scheduling identities, and dashboard counters. Final default run: 195 passed, 2 explicitly gated live integration tests skipped. All 20 dashboard acceptance scenarios and the standalone Apps Script runtime suite passed. The initial full run passed 197 tests, including a live read and a reversible integration write enabled by existing credentials; its temporary audit row was removed successfully. Live tests now require RUN_LIVE_SHEET_READ_TESTS=YES or RUN_LIVE_SHEET_WRITE_TESTS=YES respectively, in addition to credentials.

## Deployment and operational limits

Deploy the changed Apps Script files together (Code.gs, Morning.gs, WebApp.gs, Index.html) and publish a new dashboard deployment version. Deploy the Python code, requirements, configuration and workflow changes together through the normal repository release process. These local changes do not establish that the currently deployed scripts match this checkout.

The workflow restriction prevents accidental competing supported CLI writers; environment variables are not an authentication mechanism or a distributed Sheet lock. Protect service-account credentials and prohibit independent writers. GitHub concurrency serializes runs within a repository, not across repositories: if both allowed repository names exist, only one may operate against the production Sheet. Manual Sheet edits and external scripts remain outside Apps Script locking.

The fetch deadline rejects late responses; blocking network operations may return after the deadline by their bounded socket timeout. Sites refusing identity encoding, redirecting to another host, or requiring JavaScript-only evidence may be rejected and need research. Identity checks are deliberately conservative. Reply classification is heuristic and uncertain replies require human review.

Sending remains human-approved, fingerprint-checked and limited to the existing IST business window and daily ceiling. No live dispatch test was performed. Automated tests establish the covered behavior, not a guarantee against every external outage or concurrent manual mutation.
