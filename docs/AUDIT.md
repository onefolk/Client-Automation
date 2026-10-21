# OneFolk Outreach Engine — Technical Audit & Gap Analysis

**Date:** October 2026  
**Auditor:** Senior Automation Engineer, Cloud Architect & B2B Sales-Operations Specialist  
**Target Repository:** `https://github.com/onefolk/Client-Automation`  
**Reference Starter Package:** `OneFolk_Outreach_Engine_Starter.zip`  
**Target Master Spreadsheet:** `https://docs.google.com/spreadsheets/d/1U3JxQUcxSyqfZySnHNdLIwExtr3ikfcYlj0a3YY7ATM/edit`

---

## 1. Executive Summary

This audit evaluates the existing `Client-Automation` repository and the provided `OneFolk_Outreach_Engine_Starter.zip` starter package. The primary business objective is to establish the **OneFolk Outreach Engine**: a fully cloud-hosted, zero-additional-cost (₹0 / $0) B2B prospecting, website research, and email outreach system operating without requiring any local user computer, privately hosted server, or paid API subscription.

### Key Audit Findings:
1. **Existing Repo (`Client-Automation`)**:
   - Contains a legacy Next.js 14 web dashboard (`apps/web`), legacy Rust crates (`crates/`), and a local Node.js SQLite integration (`data/onefolk.db`).
   - Requires a developer's workstation or paid hosting (e.g., Railway/Vercel) to run, contradicting the core requirement of running **entirely in the cloud at zero additional cost**.
   - Relies on manual CSV downloads, manual copy-pasting to Google Sheets, and manual ChatGPT prompts for drafting and sending emails.
   - Contains solid SSRF DNS validation patterns, institutional lead models, and test fixtures that should be ported and refactored into Python.

2. **Supplied Starter Package (`OneFolk_Outreach_Engine_Starter.zip`)**:
   - Outlines an appropriate cloud topology (GitHub Actions + Google Sheets API + Google Apps Script / Gmail + Groq API).
   - **Critical Architectural Flaws in Starter**:
     - *Monolithic Design*: A single 200-line script (`src/discover.py`) attempting discovery, research, AI drafting, and Sheets synchronization in a single brittle loop.
     - *SSRF Vulnerability*: `safe_url()` tests IP strings with `ipaddress.ip_address()`, but on actual domain names it catches `ValueError` and returns `True`, allowing DNS rebinding and internal IP access (`127.0.0.1`, AWS metadata `169.254.169.254`).
     - *No DNS/MX Verification*: `valid_email()` performs only basic regex and domain string matching, lacking mail exchange (MX) DNS verification.
     - *Empty Sources*: `seeds.csv` and `directories.csv` are empty templates; no multi-industry directory parsing exists.
     - *Unstable Groq Integration*: Uses non-standard model ID `openai/gpt-oss-20b`, has no retry/exponential backoff for HTTP 429/503 errors, and terminates the entire workflow on rate limits instead of gracefully processing completed items.
     - *Lack of Spreadsheet Tabs*: Only creates a single `Lead Queue` tab instead of the required 7 logical tabs (`Dashboard`, `Lead Database`, `Approval Queue`, `Email Activity`, `Suppression List`, `Campaign Runs`, `Settings`).
     - *Broken Test Harness*: `tests/test_core.py` fails when invoked via `pytest` because `PYTHONPATH` does not include `src`.
     - *Missing Alternative Openings*: Does not generate two alternative opening lines for review as required by business guidelines.

---

## 2. Comparative Matrix: Existing Repository vs. Starter Package

| Aspect | Existing Repo (`Client-Automation`) | Starter Package (`onefolk-outreach-engine`) | Production System Decision |
| :--- | :--- | :--- | :--- |
| **Runtime Environment** | Node.js / Rust / Local Workstation / Railway | GitHub Actions (Ubuntu runner) + Google Apps Script | **GitHub Actions + Google Apps Script** (Zero cost, fully cloud-hosted) |
| **Primary Language** | TypeScript / Rust | Python 3.11+ / Google Apps Script | **Python 3.11+ & Apps Script** (Lean, robust, standard for automation) |
| **Persistent Storage** | Local SQLite (`./data/onefolk.db`) | Google Sheets (`Lead Queue` single tab) | **Google Sheets (7 structured tabs)** preserving historical logs |
| **Email Gateway** | Manual ChatGPT + Gmail session | Google Apps Script (`GmailApp.sendEmail`) | **Google Apps Script** with strict two-key human approval (`APPROVED`) |
| **Lead Discovery** | Manual CSV upload / synthetic fixture | Basic CSV seeds / directory link grabber | **Multi-industry configurable discovery engine** with public directories |
| **SSRF Safeguards** | DNS pre-resolution & private IP blocks in TS | Incomplete string check in Python | **Port TS DNS pre-resolution to Python** with full link-local/RFC1918 blocking |
| **Contact Validation** | Regex syntax match | Regex + domain match | **Syntax + Domain Match + DNS/MX Verification** with caching |
| **AI LLM Engine** | Optional / Not wired | Groq API (`openai/gpt-oss-20b`) | **Groq Free Tier** (`llama-3.3-70b-versatile` / `llama-3.1-8b-instant`) |
| **Portfolio Proof** | Hardcoded in prompts | `config/portfolio.json` (incomplete) | **Approved `config/portfolio.json`** with 6 authentic OneFolk projects |
| **Suppression** | In-memory / SQLite | Hardcoded array of 8 emails | **Dynamic Suppression Tab + Historical Sent Log + Real-time Apps Script check** |
| **Workflows** | None (Node test runner) | Single `.github/workflows/discover.yml` | **5 distinct GitHub Actions workflows** (CI, Discover, Draft, SendSync, Reconcile) |

---

## 3. Detailed Component Audit

### 3.1 Lead Discovery & Multi-Industry Support
- **Current State:**
  - Existing repo: Only handles education leads via CSV import.
  - Starter: `candidates()` function scans links on directory pages, but `directories.csv` and `seeds.csv` are empty. No industry classification or campaign configuration.
- **Defects & Gaps:**
  - Cannot reach 100 qualified leads without pre-configured, reputable public industry directories.
  - No campaign parameterization for targeting specific industries (Education, Events, Hospitality, Professional Services, Creative, Retail).
- **Remediation:**
  - Create modular `src/discovery.py` supporting configurable campaigns in `config/campaigns.json`.
  - Populate `config/seeds.csv` and `config/directories.csv` with legitimate, public business and institutional directories.
  - Support campaign filters: industry, region, target keywords, negative exclusions.

### 3.2 Website Research & Factual Grounding
- **Current State:**
  - Starter fetches up to 4 pages per target and pulls text up to 6500 characters.
  - No distinction between confirmed defects (e.g., HTTP 404 assets, missing SSL) and suggested improvements (e.g., no online booking form).
- **Defects & Gaps:**
  - Potential for LLM hallucination if the prompt allows speculative claims about lost customers or unseen issues.
  - No automated validation confirming that the AI's `observation_url` and extracted claim actually appear in the crawled content.
- **Remediation:**
  - Implement heuristic signal detection in `src/research.py` to extract verifiable facts before invoking AI.
  - Enforce factual grounding verification in `src/groq_client.py`: every observation must cite a verified crawled page, and the observation text must be grounded in page context.

### 3.3 Contact Verification & Suppression
- **Current State:**
  - Starter contains a hardcoded list of 8 blocked contacts (`info@drkumudiniaestheticgynae.com`, `team@studioamamumbai.com`, etc.).
  - Reads `Sent Emails` tab, but crashes or behaves inconsistently if the tab structure deviates.
  - Does not perform MX record DNS lookups.
- **Defects & Gaps:**
  - High bounce risk if emails are syntactically valid but have nonexistent domains or missing MX records.
  - No dedicated `Suppression List` tab in the spreadsheet.
- **Remediation:**
  - Implement `src/verifier.py` with DNS/MX lookup using Python's `dnspython` (with graceful fallback).
  - Implement `src/suppression.py` to read and maintain the `Suppression List` tab, cross-checking normalized domains and emails against historical `Sent Emails`.

### 3.4 Groq Integration & Rate-Limit Resilience
- **Current State:**
  - Direct HTTP POST to Groq completions API with `model: openai/gpt-oss-20b`.
  - Raises unhandled exception on HTTP 429.
  - No token budget tracker or exponential backoff.
- **Defects & Gaps:**
  - If Groq's free tier rate limit is reached (30 requests/minute or 6,000 tokens/minute on free models), the run abruptly fails.
  - Missing generation of two alternative opening lines for human review.
- **Remediation:**
  - Build `src/groq_client.py` using official Groq-supported models (`llama-3.3-70b-versatile`, fallback `llama-3.1-8b-instant`).
  - Implement jittered exponential backoff and rate-limit parsing (`x-ratelimit-reset`).
  - Maintain session token counter; stop gracefully when budget is reached, preserving all generated leads without failing the job.
  - Generate primary draft + 2 alternative opening lines saved in internal review fields.

### 3.5 Master Google Sheet Structure
- **Current State:**
  - Starter only manages a single tab `Lead Queue`.
- **Defects & Gaps:**
  - Violates requirement 10 requiring 7 distinct logical tabs:
    1. `Dashboard` (KPIs, conversion metrics, execution duration, API quota usage, spending = ₹0).
    2. `Lead Database` (Master repository of discovered prospects).
    3. `Approval Queue` (Actionable review queue for human sign-off).
    4. `Email Activity` (Detailed audit trail of sent messages, threads, replies, bounces).
    5. `Suppression List` (Permanent blacklist of bounced, declined, opted-out emails/domains).
    6. `Campaign Runs` (Historical log of discovery and drafting runs).
    7. `Settings` (Operational configuration, caps, rules).
- **Remediation:**
  - Implement `src/sheets.py` with multi-tab initialization and atomic, idempotent updates.

### 3.6 Google Apps Script & Gmail Sending Safety
- **Current State:**
  - Starter's `Code.gs` handles sending via `GmailApp.sendEmail` with a daily limit of 50.
  - Inbox monitoring looks at `in:inbox newer_than:14d`.
- **Defects & Gaps:**
  - Hardcoded blocked array duplicates Python logic.
  - Does not log sent emails to `Email Activity` or update `Dashboard`.
  - Ambiguous sends flag `SEND_REVIEW` but don't record actionable triage info.
- **Remediation:**
  - Enhance `apps-script/Code.gs` to interface with `Approval Queue`, `Email Activity`, `Suppression List`, and `Dashboard`.
  - Enforce strict two-key approval: both `status` and `approval` must equal `APPROVED`.
  - Track IST calendar day quota (max 50) and stop immediately on consecutive errors.

---

## 4. Implementation Checklist

- [x] **Audit & Documentation**:
  - [x] Produce `docs/AUDIT.md` (this document).
  - [x] Produce `docs/ARCHITECTURE.md`.
  - [x] Produce `docs/DEPLOYMENT.md`.
  - [x] Produce `docs/SECURITY.md`.
  - [x] Produce `docs/TEST_RESULTS.md`.
  - [x] Overhaul `README.md` and `.env.example`.
- [x] **Configuration**:
  - [x] Create authentic `config/portfolio.json` with 6 real OneFolk projects.
  - [x] Create `config/campaigns.json` supporting multiple industries.
  - [x] Populate `config/seeds.csv` and `config/directories.csv` with legitimate public sources.
- [x] **Core Python Engine (`src/`)**:
  - [x] `src/config.py`: Environment and campaign configurations.
  - [x] `src/network.py`: SSRF-safe fetcher with pre-request DNS resolution and RFC 1918 blocking.
  - [x] `src/verifier.py`: Email syntax, domain matching, and MX DNS verification.
  - [x] `src/suppression.py`: Historical suppression and deduplication manager.
  - [x] `src/discovery.py`: Multi-industry public directory and seed harvester.
  - [x] `src/research.py`: Deep website investigator and verifiable signal extractor.
  - [x] `src/groq_client.py`: Groq free-tier client with backoff, token budgeting, groundedness verification, and alternative openings.
  - [x] `src/sheets.py`: Master Google Sheets sync manager for all 7 tabs.
  - [x] `src/cli.py`: Unified CLI entry point for workflows.
- [x] **Google Apps Script**:
  - [x] Upgrade `apps-script/Code.gs` with multi-tab support, IST daily 50-limit, atomic locking, and reply/bounce classification.
- [x] **GitHub Actions Workflows**:
  - [x] `.github/workflows/ci.yml`: Unit tests, linting, and quality gates.
  - [x] `.github/workflows/discover.yml`: Scheduled & manual multi-industry lead discovery.
  - [x] `.github/workflows/draft.yml`: Groq AI drafting and approval queue population.
  - [x] `.github/workflows/send_sync.yml`: Send synchronization and Google Sheet reconciliation.
  - [x] `.github/workflows/reconcile.yml`: Reply/bounce reconciliation and suppression update.
- [x] **Testing & Quality Assurance**:
  - [x] Build comprehensive unit and integration test suite (`tests/`).
  - [x] Execute end-to-end mocked run confirming complete data lifecycle.
  - [x] Verify email sending remains disabled by default.
