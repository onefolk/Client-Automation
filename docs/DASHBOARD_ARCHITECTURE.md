# OneFolk Outreach OS — Web Dashboard Architecture & Integration Plan

## 1. Executive Summary & Audit of Existing Components

The **OneFolk Outreach OS** is a fully automated, cloud-orchestrated B2B sales development engine designed to run at zero recurring software costs using free-tier resources (GitHub Actions, Google Sheets API, Groq Free-Tier LLM, Google Apps Script V8 runtime, and GmailApp).

### 1.1 Preserved Working Components (Zero Unnecessary Rebuilds)
1. **Python Lead Discovery & Crawling (`src/discovery.py`, `src/research.py`, `src/verifier.py`)**:
   - SSRF-safe crawling, DNS pre-resolution, private IP blocking.
   - Strict contact provenance (domain-matched emails, source URLs, timestamps).
   - Domain MX record verification.
2. **Groq-Powered AI Drafting (`src/groq_client.py`)**:
   - Grounded cold email drafting with strict rule enforcement:
     - Exactly 3 body paragraphs.
     - Fewer than 70 words in body.
     - Truthful proof line (*"Our team designed and built the OneFolk website."*).
     - Low-commitment call-to-action without fabricated client metrics.
     - Two distinct alternative opening lines.
3. **Overnight GitHub Actions Orchestration (`.github/workflows/morning_queue.yml`)**:
   - Automated scheduled pipeline running Sunday–Thursday 22:00 IST with replenishment windows at 00:47, 04:47, 06:47 IST and final readback at 08:30 IST.
   - Synchronizes discovered candidates and grounded drafts into the master Google Sheet.
4. **Google Sheets Relational Store (`1U3JxQUcxSyqfZySnHNdLIwExtr3ikfcYlj0a3YY7ATM`)**:
   - Master tabs: `Dashboard`, `Lead Database`, `Approval Queue`, `Email Activity`, `Suppression List`, `Campaign Runs`, `Settings`, `Automation State`, `Morning Health`, `Approval Audit`.
5. **Apps Script Cloud Email Gateway (`apps-script/Code.gs`, `apps-script/Morning.gs`)**:
   - Atomic reservation state (`SENDING`) to prevent duplicate sends on timeout.
   - Multi-layer suppression checking against `Suppression List` and historical sends.
   - Hard cap of 50 recipients per Indian Standard Time (IST) calendar day.
   - Dual-key approval verification (`status == 'APPROVED'` and `approval == 'APPROVED'`).
   - Content integrity verification via SHA-256 fingerprint (`APPROVAL_<lead_id>`).
   - Implementation safety lock (`IMPLEMENTATION_SENDING_LOCK = true`) and kill switch (`ENABLE_SENDING = NO`).
   - Morning watchdog and reply/bounce monitor.

---

## 2. Web Dashboard Architecture (Google Apps Script HTMLService)

To eliminate the need for OneFolk operators to manually open GitHub Actions, use command-line tools, or edit spreadsheet cells, the web dashboard is built and deployed directly on **Google Apps Script HTMLService**.

```mermaid
flowchart TD
    subgraph "Client Browser (OneFolk Admin)"
        UI[OneFolk Web Dashboard\nSingle Page App via HTMLService]
        UI --> Nav[Tabs: Overview | Approval Queue | Detail & Editor | Campaigns | Sent & Replies | Health]
        UI --> State[Reactive Client-Side Store\nFilter / Search / Pagination / Inline Validation]
    end

    subgraph "Security & Authentication Barrier"
        AuthCheck{Server-Side Google Identity\nSession.getActiveUser().getEmail()}
        AuthCheck -->|Authorized Admin| Allowed[Execute Operation]
        AuthCheck -->|Unauthorized / Anonymous| Denied[403 Forbidden / Access Denied]
    end

    subgraph "Apps Script V8 Backend"
        DoGet[doGet Entrypoint\nHtmlService Template]
        API[Server-Side Controller: WebApp.gs]
        Lock[LockService.getScriptLock]
        Sec[Security.gs / Token & Admin Verification]
    end

    subgraph "Data Store (Master Google Sheet)"
        Sheet[(Master Google Sheet\nID: 1U3JxQUcxSyqfZySnHNdLIwExtr3ikfcYlj0a3YY7ATM)]
        T1[Approval Queue]
        T2[Dashboard KPIs]
        T3[Email Activity]
        T4[Suppression List]
        T5[Campaign Runs]
        T6[Morning Health]
        T7[Approval Audit]
    end

    subgraph "Gmail Gateway (Outbound Sending)"
        Sender[approvedSender Trigger\nLOCKED by default]
        Sender -.->|When Authorized| Gmail[GmailApp / Thread Dispatch]
    end

    UI -->|google.script.run| API
    DoGet --> AuthCheck
    API --> AuthCheck
    Allowed --> Lock
    Lock --> Sheet
    Sheet --> T1 & T2 & T3 & T4 & T5 & T6 & T7
```

---

## 3. Security, Authentication & Identity Model

### 3.1 Server-Side Identity Verification
- **Execution Mode**: Web App deployed with `executeAs: "USER_ACCESSING"` and `access: "ANYONE"` (or domain-restricted).
- In this configuration, Google requires the visiting user to authenticate with their Google account.
- The server retrieves the verified email via `Session.getActiveUser().getEmail()`.
- **Authorized Admin Whitelist**:
  - The script checks the email against `AUTHORIZED_ADMINS` stored in Script Properties (defaulting to `contact.onefolk@gmail.com`, `giridharane01@gmail.com`).
  - If `getActiveUser().getEmail()` is empty (e.g. unauthenticated session), or does not match the whitelist, the server immediately halts and returns an access-denied view.
  - Client-side code CANNOT override or fake this identity.
  - Every server-side endpoint called via `google.script.run` or HTTP calls `assertAuthorizedUser()` before reading or writing any data.

### 3.2 Approval Audit Trail & Cryptographic Fingerprinting
- When an administrator approves a draft in the web dashboard:
  1. The server acquires `LockService.getScriptLock(15000)`.
  2. The server re-validates that the lead exists, matches `reviewableRecord(r)`, and is not suppressed.
  3. The server computes the SHA-256 fingerprint across all 15 core draft fields (`draftFingerprint(r)`).
  4. The server stores `APPROVAL_<lead_id> = fingerprint` in Script Properties.
  5. The server records the reviewer's authenticated email, timestamp, action (`APPROVED` / `REJECTED` / `NEEDS_RESEARCH`), and fingerprint into the `Approval Audit` tab.
  6. The server sets both `status = 'APPROVED'` and `approval = 'APPROVED'` in the `Approval Queue` sheet.
- If an admin edits any word in the draft body or subject:
  - The email is re-validated against strict constraints.
  - Existing approval is cleared (`APPROVAL_<lead_id> = ''`) until explicitly re-approved.
  - An audit log entry is created.

### 3.3 Protection Against Attacks
- **Formula Injection Prevention**: Any string starting with `=`, `+`, `-`, or `@` is sanitized before writing to Google Sheets cells.
- **XSS Prevention**: All data injected into the DOM is sanitized with standard text escaping; HTML tags in prospect content are encoded.
- **CSRF & Unauthorized Modification**: Only verified Google sessions matching the admin whitelist can execute backend functions.
- **Secret Protection**: No API keys, service account JSON, or private keys are ever sent to or rendered in client HTML.

---

## 4. UI/UX Specifications (OneFolk Design System)

The UI embodies modern, premium agency aesthetics matching `https://onefolk.in/`:
- **Theme**: Clean dark-mode surface palette (`#0B0F17` background, `#111827` surface cards, `#1F2937` borders, `#F9FAFB` high-contrast typography, OneFolk Orange accent `#FF5500` / `#FF6B2B` with electric emerald `#10B981` status highlights).
- **Typography**: Clean sans-serif stack (`Inter`, system sans).
- **Layout**: Fluid responsive layout with mobile-first sidebar/navigation drawer, card grids, sticky action bars for review, and modal editors.

### 4.1 Section Layouts
1. **Overview (Command Center)**:
   - 12 real-time KPI tiles: Ready-to-Review, Discovered Today, Qualified Reserves, Drafts Generated, Awaiting Approval, Approved, Sent, Bounced, Positive Replies, Meetings Booked, Converted Clients, Conversion Rate.
   - Morning Target Progress Bar: Visual gauge of real eligible drafts against the 50-lead morning target.
   - Automation Health Monitor: Last overnight GitHub Actions run timestamp, trigger source, runner minutes used, shortage reasons.
2. **Approval Queue (Primary Workflow Screen)**:
   - Live searchable, filterable table/card list.
   - Filters: Status (`ALL`, `AWAITING_REVIEW`, `NEEDS_RESEARCH`, `APPROVED`, `REJECTED`), Industry, City, Minimum Qualification Score.
   - Row elements: Business name, Industry tag, City, Website (external link), Public Email, Qualification Score badge, Opportunity hook, Research freshness badge, Status pill.
   - Action controls: Instant review button, batch filter counters.
3. **Lead Detail & Cold Email Editor**:
   - Split-view review drawer/modal:
     - Left pane: Complete company metadata, verified website observation snippet, observation source URL link, contact source URL link, OneFolk proof reference (`https://onefolk.in/work`), verification confidence badge, and research age.
     - Right pane: Interactive cold email editor with live validation:
       - Subject line input with character counter.
       - Body textarea with live word count (< 70 words required) and paragraph counter (exactly 3 required).
       - Proof line lock badge: Highlights *"Our team designed and built the OneFolk website."* and confirms its presence.
       - Quick-swap buttons for `Alternative Opening 1` and `Alternative Opening 2`.
       - Action buttons: `Save Changes`, `Approve Draft` (green), `Reject Draft` (red), `Mark Needs Research` (amber).
4. **Campaigns**:
   - Historic execution log of scheduled runs from `Campaign Runs` tab.
   - Displays real execution run IDs, start/end timestamps, prospects discovered, qualified, AI calls used, HTTP fetches, and shortage explanations.
5. **Sent & Replies**:
   - Outbound and inbox activity from `Email Activity` and historical records.
   - Direct clickable Gmail thread links (`https://mail.google.com/mail/u/0/#inbox/<threadId>`).
   - Delivery classification: `SENT`, `BOUNCED`, `DECLINED`, `POSITIVE_REPLY`, `REPLY_REVIEW`.
6. **Settings & System Health**:
   - Master send kill switch state display (`IMPLEMENTATION_SENDING_LOCK: ACTIVE`, `ENABLE_SENDING: NO`).
   - Quota meters: Daily recipients used today vs 50 cap, Gmail remaining quota via `MailApp.getRemainingDailyQuota()`.
   - Groq API status & model name.
   - GitHub Actions runner minute budget tracking.
   - Whitelisted administrator management.

---

## 5. Backend Server-Side Methods (`apps-script/WebApp.gs`)

| Method Name | Parameters | Return Value | Purpose |
| :--- | :--- | :--- | :--- |
| `doGet(e)` | HTTP event | `HtmlOutput` | Serves dashboard UI or JSON API if `?api=1` |
| `getDashboardData()` | None | `Object` | Returns current user email, KPIs, queue items, health stats |
| `getApprovalQueue(page, filter, query)` | `page, pageSize, statusFilter, search` | `Object { leads, total, page }` | Efficient paginated queue fetching |
| `getLeadDetails(leadId)` | `leadId` | `Object` | Full record for detailed inspection |
| `saveLeadDraft(leadId, subject, body)` | `leadId, subject, body` | `Object { success, record, errors }` | Validates and persists edited draft |
| `approveLead(leadId)` | `leadId` | `Object { success, leadId, fingerprint }` | Dual-key approval with audit and fingerprint |
| `rejectLead(leadId, reason)` | `leadId, reason` | `Object { success, leadId }` | Sets status and approval to REJECTED |
| `markNeedsResearch(leadId, note)` | `leadId, note` | `Object { success, leadId }` | Moves lead to NEEDS_RESEARCH status |
| `getCampaignRuns()` | None | `Array<Object>` | Retrieves real run history |
| `getEmailActivity()` | `page, pageSize, statusFilter` | `Object { items, total }` | Retrieves sent emails and reply monitoring logs |
| `getSystemHealth()` | None | `Object` | Quotas, locks, triggers, and scheduler status |

---

## 6. Live Sheet Integration & Concurrency Strategy

- **Authoritative Identity**: Every update is keyed on unique `lead_id` (e.g. `lead_49c3141942e1577b`). Row index is dynamically resolved via `headers.indexOf('lead_id')` to protect against concurrent sheet row additions or sorting.
- **Script Lock**: Every write operation (`approveLead`, `rejectLead`, `saveLeadDraft`) wraps its execution in `LockService.getScriptLock().waitLock(15000)`.
- **Atomic Double-Write**: Approval writes to both `Approval Queue` (`status=APPROVED`, `approval=APPROVED`) and `Approval Audit` (`timestamp`, `lead_id`, `reviewer`, `action`, `fingerprint`), while updating Script Property `APPROVAL_<lead_id>`.
- **Pre-Dispatch Invalidation**: Any subsequent edit to an approved row clears `APPROVAL_<lead_id>` and sets `status=AWAITING_REVIEW`, `approval=PENDING`.
- **Sending Lock**: `IMPLEMENTATION_SENDING_LOCK = true` and `ENABLE_SENDING = NO` remain strictly enforced. Outbound prospecting is locked until explicit system authorization.
