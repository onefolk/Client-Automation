# OneFolk Outreach Engine — Deployment & Operations Guide

This guide details the exact one-time setup required to deploy and run the OneFolk Outreach Engine in the cloud with **zero ongoing computer requirements** and **₹0 additional cost**.

---

## 1. Prerequisites Checklist

- [ ] A free **GitHub** account with access to a private repository.
- [ ] A free **Google Cloud Platform** account (no billing account required for Sheets API free tier).
- [ ] The existing OneFolk master Google Sheet:  
  `https://docs.google.com/spreadsheets/d/1U3JxQUcxSyqfZySnHNdLIwExtr3ikfcYlj0a3YY7ATM/edit`
- [ ] A free **Groq** account (`https://console.groq.com`).
- [ ] Access to the OneFolk Gmail account (`contact.onefolk@gmail.com`).

---

## 2. Step-by-Step Setup Procedure

### Step 2.1: Google Cloud Service Account Setup
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named **OneFolk-Automation** (or select an existing project).
3. In the sidebar, go to **APIs & Services > Library**.
4. Search for **Google Sheets API** and click **Enable**.
5. Go to **APIs & Services > Credentials** and click **Create Credentials > Service Account**.
6. Set the Service Account name to `onefolk-sheets-sync` and click **Create and Continue**.
7. Skip the role assignment (the service account only accesses the specific shared sheet). Click **Done**.
8. Click on the newly created service account in the list, navigate to the **Keys** tab, and click **Add Key > Create new key > JSON**.
9. Save the downloaded JSON key file securely.
10. Open the master Google Sheet, click **Share**, and paste the service account email (`onefolk-sheets-sync@...iam.gserviceaccount.com`). Grant the **Editor** role and uncheck "Notify people".

> [!IMPORTANT]
> Do NOT grant any Gmail, Drive, or Google Workspace domain-wide delegation scopes to this service account. It only needs permission to read and edit the designated Google Sheet.

---

### Step 2.2: Groq Free-Tier API Key Setup
1. Log in to [Groq Console](https://console.groq.com/).
2. Navigate to **API Keys** and click **Create API Key**.
3. Name the key `onefolk-outreach-free`.
4. Copy the key (prefix `gsk_...`).
5. Ensure your account is on the free tier. Do not add payment details.

---

### Step 2.3: GitHub Actions Secrets & Variables
1. Open your private repository: `https://github.com/onefolk/Client-Automation`.
2. Navigate to **Settings > Secrets and variables > Actions**.
3. Under **Repository secrets**, click **New repository secret** and add:
   - `SHEET_ID`: `1U3JxQUcxSyqfZySnHNdLIwExtr3ikfcYlj0a3YY7ATM`
   - `GOOGLE_SERVICE_ACCOUNT_JSON`: The entire minified JSON string of the downloaded service account key.
   - `GROQ_API_KEY`: The Groq API key (`gsk_...`).
4. Under **Repository variables**, click **New repository variable** (optional):
   - `GROQ_MODEL`: `llama-3.3-70b-versatile`

---

### Step 2.4: Google Apps Script Installation (One-Time)
1. Open the master spreadsheet:  
   `https://docs.google.com/spreadsheets/d/1U3JxQUcxSyqfZySnHNdLIwExtr3ikfcYlj0a3YY7ATM/edit`
2. In the top menu, navigate to **Extensions > Apps Script**.
3. Replace the contents of `Code.gs` with the code in `apps-script/Code.gs` from this repository.
4. In the left sidebar, click the gear icon (**Project Settings**).
5. Check **Show "appsscript.json" manifest file in editor**.
6. Switch to the editor, open `appsscript.json`, and paste the contents of `apps-script/appsscript.json`. Ensure `timeZone` is set to `Asia/Kolkata`.
7. Scroll down to **Script Properties** under Project Settings and click **Edit script properties**:
   - `SPREADSHEET_ID`: `1U3JxQUcxSyqfZySnHNdLIwExtr3ikfcYlj0a3YY7ATM`
   - `ENABLE_SENDING`: `NO`  *(Strictly disabled during installation!)*
8. In the Apps Script toolbar, select the function `installTriggers` and click **Run**.
9. Google will present an authorization modal:
   - Click **Review Permissions**.
   - Select the OneFolk Google account.
   - Click **Advanced > Go to Untitled project (unsafe)**.
   - Click **Allow** to grant standard Gmail sending, reading, and spreadsheet permissions to your own bound script.
10. The execution log will print:  
    `Triggers successfully installed. Sending remains OFF until ENABLE_SENDING=YES.`

> [!NOTE]
> This one-time consent is handled entirely through Google's native OAuth modal. You will never be asked for your Gmail password.

---

## 3. Operational Workflow & Daily Execution

### 3.1 Step 1: Automated Discovery & Drafting (GitHub Actions)
- Runs automatically on weekdays at 03:30 UTC (~09:00 IST).
- Can also be triggered manually anytime:
  1. Go to **Actions > Multi-Industry Lead Discovery & Research**.
  2. Click **Run workflow**, optionally choose a target lead count (default: 100).
  3. The workflow discovers candidates across target industries, crawls them with SSRF protection, extracts contacts, verifies DNS/MX records, drafts personalized 3-paragraph cold emails via Groq, and updates the `Lead Database` and `Approval Queue` tabs in Google Sheets.

### 3.2 Step 2: Human Review & Approval (Google Sheets)
1. Open the master Google Sheet and navigate to the **Approval Queue** tab.
2. Review the drafted messages, verified technical observations, and evidence URLs.
3. For each prospect you wish to approve for dispatch:
   - Change the `status` column to: `APPROVED`
   - Change the `approval` column to: `APPROVED`
4. For drafts you wish to discard:
   - Change `status` to `REJECTED` or `HOLD`.

> [!WARNING]
> No email will ever be sent unless **BOTH** `status` and `approval` are set to `APPROVED`.

### 3.3 Step 3: Outbound Dispatch via Gmail (Google Apps Script)
- The bound Apps Script runs `approvedSender` automatically every hour.
- When `ENABLE_SENDING=YES`, it dispatches approved drafts up to the daily budget (**maximum 50 recipients per IST day**).
- Status is immediately updated to `SENT`, and details are recorded in the `Email Activity` tab.

### 3.4 Step 4: Reply & Bounce Reconciliation
- The bound Apps Script runs `monitorReplies` automatically every 2 hours.
- It detects bounces and delivery failures, immediately marking the lead `BOUNCED` and adding the address to `Suppression List`.
- It detects replies in the inbox:
  - Opt-outs or declines are marked `DECLINED` and permanently suppressed.
  - Positive inquiries are marked `POSITIVE_REPLY` and highlighted on the `Dashboard`.
  - Ambiguous responses are marked `REPLY_REVIEW`.

---

## 4. Activating Live Sending & Emergency Stop

### How to Activate Live Email Sending
Once you have reviewed the initial dry-run results and approved your first batch of drafts:
1. In the master Google Sheet, open **Extensions > Apps Script**.
2. Go to **Project Settings > Script Properties**.
3. Change `ENABLE_SENDING` from `NO` to `YES`.
4. Click **Save script properties**.

### How to Trigger an Immediate Emergency Stop
If you need to halt all outbound email sending immediately:
1. Open **Extensions > Apps Script**.
2. Select the function `emergencyStop` from the function dropdown and click **Run**.
3. Alternatively, edit Script Properties and set `ENABLE_SENDING` to `NO`.
4. All further dispatches will halt immediately.
