# OneFolk Outreach Engine — Production Cloud System

[![CI Quality Gate](https://github.com/onefolk/Client-Automation/actions/workflows/ci.yml/badge.svg)](https://github.com/onefolk/Client-Automation/actions/workflows/ci.yml)
[![Tests Passing](https://img.shields.io/badge/Tests-33%20Passed-success?style=flat)](docs/TEST_RESULTS.md)
[![Runtime](https://img.shields.io/badge/Runtime-Python%203.11%20%2B%20Apps%20Script-blue?style=flat)](docs/ARCHITECTURE.md)
[![Database](https://img.shields.io/badge/Database-Google%20Sheets-green?style=flat)](https://docs.google.com/spreadsheets/d/1U3JxQUcxSyqfZySnHNdLIwExtr3ikfcYlj0a3YY7ATM/edit)
[![Outreach](https://img.shields.io/badge/Outreach-GmailApp%20(Max%2050%2Fday)-red?style=flat)](docs/DEPLOYMENT.md)
[![Additional Cost](https://img.shields.io/badge/Cost-₹0%20(Free%20Tier)-brightgreen?style=flat)](docs/ARCHITECTURE.md)
[![Live Sending Status](https://img.shields.io/badge/Sending-DISABLED%20BY%20DEFAULT-critical?style=flat)](docs/DEPLOYMENT.md)

---

## 1. Executive Overview
The **OneFolk Outreach Engine** is an autonomous, cloud-hosted, zero-additional-cost (₹0 / $0) B2B prospecting, website research, and email outreach system. It operates entirely in the cloud without requiring any local user computer, privately rented server, or paid API subscription.

### Key Capabilities
- **Multi-Industry Discovery**: Automatically discovers business prospects across Educational Institutions, Events & Conferences, Hospitality & Dining, Professional Services, Creative & Architecture Studios, and Retail/Consumer brands.
- **SSRF-Guarded Research**: Pre-resolves DNS and blocks loopback, private subnets (RFC 1918), and cloud metadata (`169.254.169.254`), preventing server-side network pivoting.
- **Verifiable Factual Observations**: Detects concrete technical opportunities (HTTPS, mobile responsiveness, structured inquiry forms vs. mailto links, portal workflows) without speculating or inventing negative business claims.
- **Grounded AI Email Drafting**: Uses Groq's free-tier LLM (`llama-3.3-70b-versatile`) to produce strict, 3-paragraph cold emails (<70 words) with verbatim authentic OneFolk portfolio proof and two alternative opening lines for review.
- **Master Google Sheet Integration**: Persists all records into a single master spreadsheet across 7 structured tabs (`Dashboard`, `Lead Database`, `Approval Queue`, `Email Activity`, `Suppression List`, `Campaign Runs`, `Settings`), fully preserving historical `Sent Emails`.
- **Dual-Key Human Authorization**: Email sending is **disabled by default**. Sending requires explicit manual approval (`status == APPROVED` AND `approval == APPROVED`).
- **Transactional Gmail Gateway**: Bound Google Apps Script dispatches authorized emails up to **50 recipients per IST day**, monitors inbox replies, auto-suppresses declines/bounces, and prevents duplicate sends.

---

## 2. Master Google Sheet

All operations synchronize to the existing master spreadsheet:  
👉 **[Open OneFolk Master Outreach Sheet](https://docs.google.com/spreadsheets/d/1U3JxQUcxSyqfZySnHNdLIwExtr3ikfcYlj0a3YY7ATM/edit)**

The spreadsheet contains 7 logical tabs:
1. **`Dashboard`**: Live operational metrics, pipeline funnel, conversion rates, run duration, and actual spending (**₹0.00**).
2. **`Lead Database`**: Master prospect inventory with qualification scores and technical observations.
3. **`Approval Queue`**: Actionable human review queue for approving or rejecting outbound drafts.
4. **`Email Activity`**: Full audit log of all sent messages, timestamps, and thread tracking.
5. **`Suppression List`**: Permanent blacklist of bounced, declined, and unsubscribed domains and emails.
6. **`Campaign Runs`**: Historical execution ledger tracking duration, quota usage, and lead yields.
7. **`Settings`**: System constants, caps, and campaign preset definitions.

---

## 3. Cloud Architecture & Workflows

```mermaid
flowchart LR
    A[Public Seeds & Directories] --> B[GitHub Actions: Discovery & SSRF-Safe Crawl]
    B --> C[DNS / MX Verification & Signal Detection]
    C --> D[Groq Free LLM: Grounded 3-Paragraph Drafts]
    D --> E[(Google Sheet: Approval Queue)]
    E --> F{Human Reviewer: APPROVE?}
    F -->|Yes: status=APPROVED & approval=APPROVED| G[Apps Script: GmailApp Sender]
    F -->|No: REJECT / HOLD| H[Hold State]
    G --> I[Gmail Recipient: Max 50/day IST]
    I --> J[Apps Script: Inbox Monitor]
    J -->|Bounce / Unsubscribe| K[(Google Sheet: Suppression List)]
    J -->|Positive Reply| L[(Google Sheet: Dashboard Conversion)]
```

### GitHub Actions Workflows (`.github/workflows/`)
- [ci.yml](file:///.github/workflows/ci.yml): Automated test runner, syntax compiler, and quality gate.
- [discover.yml](file:///.github/workflows/discover.yml): Scheduled weekdays at 03:30 UTC (~09:00 IST) for multi-industry discovery and website research.
- [draft.yml](file:///.github/workflows/draft.yml): Grounded Groq AI drafting populating the `Approval Queue`.
- [send_sync.yml](file:///.github/workflows/send_sync.yml): Scheduled synchronization between Google Sheets, Apps Script, and the Dashboard.
- [reconcile.yml](file:///.github/workflows/reconcile.yml): Bounce and reply reconciliation updating the `Suppression List`.

---

## 4. Documentation Index

Detailed architectural and operational documentation is available in `docs/`:
- **[docs/AUDIT.md](docs/AUDIT.md)**: Technical audit comparing the legacy codebase vs. the starter package, identified gaps, and implementation checklist.
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**: Comprehensive cloud topology, component accounting, state machine, and tool evaluations (`google-maps-scraper`, `crawl4ai`).
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**: Step-by-step deployment guide for GitHub Actions secrets, Google Cloud Service Account, Google Apps Script, and Groq API.
- **[docs/SECURITY.md](docs/SECURITY.md)**: Security specification covering SSRF prevention, secrets isolation, least privilege, anti-spam safeguards, and factual grounding.
- **[docs/TEST_RESULTS.md](docs/TEST_RESULTS.md)**: Automated test execution report detailing 100% pass rate across 33 test suites.

---

## 5. Local Quickstart & Verification

### Running Automated Tests
```bash
# Install dependencies
pip install -r requirements.txt

# Run full test suite (33 unit & integration tests)
pytest -v
```

### Running an End-to-End Dry Run
To test the complete discovery, crawling, signal extraction, and drafting pipeline without external mutations:
```bash
python -m src.cli dry-run --target 5
```

---

## 6. Safety & Sending Kill-Switch Notice

> [!CAUTION]
> **Live email sending is DISABLED BY DEFAULT.**  
> In `apps-script/Code.gs`, sending will strictly refuse to execute unless the Script Property `ENABLE_SENDING` is set to `YES`.  
> To trigger an immediate emergency halt, run `emergencyStop()` inside Apps Script or set `ENABLE_SENDING` to `NO`.
