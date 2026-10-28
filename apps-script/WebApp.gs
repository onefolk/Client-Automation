/**
 * OneFolk Outreach OS — Web Dashboard Controller & API Layer
 * Bound Google Apps Script for Spreadsheet: 1U3JxQUcxSyqfZySnHNdLIwExtr3ikfcYlj0a3YY7ATM
 */

const TAB_CAMPAIGN_RUNS = 'Campaign Runs';
const TAB_MORNING_HEALTH = 'Morning Health';
const TAB_APPROVAL_AUDIT = 'Approval Audit';
const TAB_LEAD_DATABASE = 'Lead Database';
const TAB_SETTINGS = 'Settings';
const TAB_AUTOMATION_STATE = 'Automation State';
const TAB_DASHBOARD_NAME = typeof TAB_DASHBOARD !== 'undefined' ? TAB_DASHBOARD : 'Dashboard';
const TAB_EMAIL_ACTIVITY_NAME = typeof TAB_EMAIL_ACTIVITY !== 'undefined' ? TAB_EMAIL_ACTIVITY : 'Email Activity';
const TAB_HISTORICAL_SENT_NAME = typeof TAB_HISTORICAL_SENT !== 'undefined' ? TAB_HISTORICAL_SENT : 'Sent Emails';
const TAB_SUPPRESSION_LIST_NAME = typeof TAB_SUPPRESSION_LIST !== 'undefined' ? TAB_SUPPRESSION_LIST : 'Suppression List';

/**
 * Resolves the primary queue worksheet, supporting both 'Approval Queue' and legacy 'Lead Queue'.
 */
function getQueueSheet(book) {
  if (!book) return null;
  const primary = typeof TAB_APPROVAL_QUEUE !== 'undefined' ? TAB_APPROVAL_QUEUE : 'Approval Queue';
  const legacy = typeof TAB_LEGACY_QUEUE !== 'undefined' ? TAB_LEGACY_QUEUE : 'Lead Queue';
  return book.getSheetByName(primary) || book.getSheetByName(legacy);
}

/**
 * Entry point for Google Apps Script HTMLService Web App.
 */
function doGet(e) {
  e = e || { parameter: {} };
  const userEmail = getAuthenticatedUserEmail();
  const authorized = isAuthorizedAdmin(userEmail);

  // JSON API router if requested
  if (e.parameter.api === 'true') {
    if (!authorized) {
      return ContentService.createTextOutput(JSON.stringify({
        error: 'Unauthorized: Access restricted to OneFolk administrators.',
        authenticated_user: userEmail || 'none'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    return handleApiRequest(e);
  }

  // HTML Service view router
  if (!authorized) {
    return HtmlService.createHtmlOutput(renderAccessDeniedView(userEmail))
      .setTitle('Access Denied — OneFolk Outreach OS')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  }

  let template;
  try {
    template = HtmlService.createTemplateFromFile('Index');
  } catch (err1) {
    try {
      template = HtmlService.createTemplateFromFile('Index.html');
    } catch (err2) {
      throw new Error('HTML file missing: In your Apps Script editor (+ > HTML), create a file named "Index" and paste the code from apps-script/Index.html.');
    }
  }
  template.userEmail = userEmail;
  template.appName = 'OneFolk Outreach OS';
  
  return template.evaluate()
    .setTitle('OneFolk Outreach OS — Private Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * Handles API requests sent via GET/POST parameters for headless or test access.
 */
function handleApiRequest(e) {
  const action = e.parameter.action || 'overview';
  let result = {};
  try {
    switch (action) {
      case 'overview':
        result = apiGetDashboardData();
        break;
      case 'queue':
        result = apiGetApprovalQueue({
          status: e.parameter.status || 'ALL',
          search: e.parameter.search || '',
          page: Number(e.parameter.page || 1),
          pageSize: Number(e.parameter.pageSize || 25)
        });
        break;
      case 'lead':
        result = apiGetLeadDetails(e.parameter.lead_id);
        break;
      case 'campaigns':
        result = apiGetCampaignRuns();
        break;
      case 'sent_activity':
        result = apiGetSentAndReplies();
        break;
      case 'health':
        result = apiGetSystemHealth();
        break;
      case 'cancel_approval':
        result = apiCancelApproval(e.parameter.lead_id);
        break;
      case 'emergency_stop':
        result = apiEmergencyStop();
        break;
      case 'authorize_sending':
        result = apiAuthorizeSystemSending();
        break;
      case 'internal_test':
        result = apiSendInternalTestEmail(e.parameter.recipient);
        break;
      default:
        result = { error: 'Unknown API action: ' + action };
    }
  } catch (err) {
    result = { error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Renders an access denied message when an unauthenticated or unauthorized account accesses the URL.
 */
function renderAccessDeniedView(email) {
  const displayEmail = email ? escapeHtml(email) : 'Unauthenticated / Anonymous';
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Access Denied — OneFolk Outreach OS</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: #0B0F17;
          color: #F9FAFB;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .card {
          background: #111827;
          border: 1px solid #1F2937;
          border-radius: 12px;
          padding: 36px;
          max-width: 480px;
          text-align: center;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
        }
        .badge {
          display: inline-block;
          background: rgba(239, 68, 68, 0.15);
          color: #EF4444;
          font-weight: 600;
          font-size: 12px;
          padding: 4px 12px;
          border-radius: 9999px;
          margin-bottom: 16px;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        h1 { font-size: 20px; margin-bottom: 8px; font-weight: 700; }
        p { color: #9CA3AF; font-size: 14px; line-height: 1.6; margin-bottom: 20px; }
        .user-box {
          background: #1F2937;
          padding: 10px 16px;
          border-radius: 8px;
          font-family: monospace;
          font-size: 13px;
          color: #E5E7EB;
          margin-bottom: 24px;
          word-break: break-all;
        }
        .instructions {
          font-size: 12px;
          color: #6B7280;
          text-align: left;
          background: #0B0F17;
          padding: 14px;
          border-radius: 8px;
          border-left: 3px solid #FF5500;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">SECURITY GATEWAY</div>
        <h1>Access Restricted</h1>
        <p>This private dashboard contains confidential outreach operations. Only verified OneFolk administrators are permitted.</p>
        <div class="user-box">Signed in as: ${displayEmail}</div>
        <div class="instructions">
          <strong>How to gain access:</strong>
          <br>1. Ensure you are signed in with an authorized OneFolk Google Account.
          <br>2. Contact the administrator to add your email to the authorized administrator list.
        </div>
      </div>
    </body>
    </html>
  `;
}

// -----------------------------------------------------------------------------
// CORE CLIENT-CALLABLE API METHODS (Protected via assertAuthorizedAdmin)
// -----------------------------------------------------------------------------

/**
 * Returns aggregated dashboard metrics, live counts, queue health, and quota.
 */
function apiGetDashboardData() {
  const userEmail = assertAuthorizedAdmin();
  const book = getSpreadsheet();
  
  // 1. Live count from Approval Queue
  const queueSheet = getQueueSheet(book);
  let readyToReview = 0;
  let awaitingApproval = 0;
  let needsResearch = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let sentCount = 0;
  let bouncedCount = 0;
  let positiveReplyCount = 0;
  let totalQueueRows = 0;
  let top10Priority = 0;
  let secondaryBacklog = 0;
  
  if (queueSheet) {
    const rows = queueSheet.getDataRange().getValues();
    if (rows.length > 1) {
      const headers = rows[0].map(h => normalizeKey(h));
      const statusCol = headers.indexOf('status');
      const approvalCol = headers.indexOf('approval');
      const scoreCol = headers.indexOf('priority_score') !== -1 ? headers.indexOf('priority_score') : headers.indexOf('qualification_score');

      totalQueueRows = rows.length - 1;
      for (let i = 1; i < rows.length; i++) {
        const st = statusCol !== -1 ? normalizeKey(rows[i][statusCol]) : '';
        const app = approvalCol !== -1 ? normalizeKey(rows[i][approvalCol]) : '';
        const sc = scoreCol !== -1 ? Number(rows[i][scoreCol] || 0) : 80;
        
        if (st === 'sent') {
          sentCount++;
        } else if (st === 'bounced') {
          bouncedCount++;
        } else if (st === 'positive_reply') {
          positiveReplyCount++;
        } else if (st === 'rejected' || app === 'rejected') {
          rejectedCount++;
        } else if (st === 'awaiting_review' && app === 'pending') {
          readyToReview++;
          awaitingApproval++;
          if (sc >= 80) top10Priority++;
          else secondaryBacklog++;
        } else if (st === 'needs_research') {
          needsResearch++;
        } else if (st === 'approved' || st === 'queued' || (app === 'approved' && !['sent', 'sending', 'bounced', 'positive_reply', 'declined'].includes(st))) {
          approvedCount++;
        }
      }
    }
  }

  // 2. Metrics from Dashboard sheet
  const dashSheet = book ? book.getSheetByName(TAB_DASHBOARD_NAME) : null;
  const sheetKpis = {};
  if (dashSheet) {
    try {
      const dRows = dashSheet.getDataRange().getValues();
      for (let i = 1; i < dRows.length; i++) {
        const metric = String(dRows[i][0] || '').trim();
        const val = String(dRows[i][1] || '').trim();
        if (metric) {
          sheetKpis[metric] = val;
        }
      }
    } catch (e) {
      Logger.log('Dashboard read error: ' + e);
    }
  }

  // 3. Automation & health snapshot
  let healthInfo = {};
  try {
    if (typeof automationSnapshot === 'function') {
      healthInfo = automationSnapshot();
    } else {
      healthInfo = {
        ready: readyToReview,
        needs: needsResearch,
        shortage: Math.max(0, DAILY_REVIEW_GOAL - top10Priority),
        failures: [],
        last_success: 'NONE'
      };
    }
  } catch (err) {
    healthInfo = {
      ready: readyToReview,
      needs: needsResearch,
      shortage: Math.max(0, DAILY_REVIEW_GOAL - top10Priority),
      failures: ['Snapshot error: ' + String(err)],
      last_success: 'NONE'
    };
  }

  // 4. Quotas & limits
  let mailQuota = 100;
  try {
    mailQuota = MailApp.getRemainingDailyQuota();
  } catch (e) {
    Logger.log('Quota error: ' + e);
  }

  let dailySentToday = 0;
  try {
    dailySentToday = typeof getDailySendCount === 'function' ? getDailySendCount() : 0;
  } catch (e) {
    Logger.log('Daily send count error: ' + e);
  }

  const maxDaily = typeof MAX_DAILY_RECIPIENTS !== 'undefined' ? MAX_DAILY_RECIPIENTS : 50;
  const sendingLock = typeof IMPLEMENTATION_SENDING_LOCK !== 'undefined' ? IMPLEMENTATION_SENDING_LOCK : false;
  const enableSendingFlag = typeof getProp === 'function' ? (getProp('ENABLE_SENDING') || 'NO') : 'NO';
  const isSendingActive = !sendingLock && enableSendingFlag === 'YES';

  return {
    userEmail: userEmail,
    timestamp: new Date().toISOString(),
    metrics: {
      readyToReview: readyToReview,
      top10Priority: top10Priority,
      secondaryBacklog: secondaryBacklog,
      awaitingApproval: awaitingApproval,
      needsResearch: needsResearch,
      approved: approvedCount,
      rejected: rejectedCount,
      sent: sentCount,
      bounced: bouncedCount,
      positiveReplies: positiveReplyCount,
      meetingsBooked: Number(sheetKpis['Sales calls booked'] || 0),
      proposalsRequested: Number(sheetKpis['Proposals requested'] || 0),
      convertedClients: Number(sheetKpis['Clients converted'] || 0),
      newLeadsDiscovered: healthInfo.newly_discovered || Number(sheetKpis['Prospects discovered'] || totalQueueRows),
      targetDailyGoal: 10,
      targetPriorityGoal: 10,
      maxDailyCapacity: 50
    },
    system: {
      sendingLocked: sendingLock,
      enableSending: enableSendingFlag,
      isSendingActive: isSendingActive,
      remainingMailQuota: mailQuota,
      dailySentToday: dailySentToday,
      dailySendCap: maxDaily,
      lastSuccess: healthInfo.last_success,
      shortage: healthInfo.shortage,
      healthFailures: healthInfo.failures || []
    }
  };
}

/**
 * Returns paginated, searchable, and filtered leads from the Approval Queue.
 */
function apiGetApprovalQueue(params) {
  assertAuthorizedAdmin();
  params = params || {};
  const statusFilter = normalizeKey(params.status || 'ALL');
  const searchQuery = normalizeKey(params.search || '');
  const page = Math.max(1, Number(params.page || 1));
  const pageSize = Math.min(100, Math.max(5, Number(params.pageSize || 25)));

  const book = getSpreadsheet();
  const sheet = getQueueSheet(book);
  if (!sheet) {
    return { leads: [], total: 0, page: 1, pageSize: pageSize, totalPages: 1, statuses: {} };
  }

  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) {
    return { leads: [], total: 0, page: 1, pageSize: pageSize, totalPages: 1, statuses: {} };
  }

  const headers = rows[0].map(h => normalizeKey(h));
  const statusCounts = { ALL: 0, TOP_10: 0, BACKLOG: 0, AWAITING_REVIEW: 0, NEEDS_RESEARCH: 0, APPROVED: 0, REJECTED: 0, SENT: 0, OTHER: 0 };

  const allLeads = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const item = {};
    headers.forEach((h, colIdx) => {
      let val = row[colIdx];
      if (val instanceof Date) {
        val = val.toISOString();
      } else if (val === null || val === undefined) {
        val = '';
      }
      item[h] = val;
    });

    const st = normalizeKey(item.status);
    const app = normalizeKey(item.approval);
    const score = Number(item.priority_score || item.qualification_score || 0);
    
    // Normalize status bucket for counter
    statusCounts.ALL++;
    if (st === 'awaiting_review' || (st === 'qualified' && app === 'pending')) {
      statusCounts.AWAITING_REVIEW++;
      if (score >= 80) statusCounts.TOP_10++;
      else statusCounts.BACKLOG++;
    } else if (st === 'needs_research') {
      statusCounts.NEEDS_RESEARCH++;
    } else if (st === 'approved' || st === 'queued') {
      statusCounts.APPROVED++;
    } else if (st === 'sending') {
      statusCounts.SENDING = (statusCounts.SENDING || 0) + 1;
    } else if (st === 'send_review') {
      statusCounts.SEND_REVIEW = (statusCounts.SEND_REVIEW || 0) + 1;
    } else if (st === 'rejected' || app === 'rejected') {
      statusCounts.REJECTED++;
    } else if (st === 'sent') {
      statusCounts.SENT++;
    } else if (st === 'bounced') {
      statusCounts.BOUNCED = (statusCounts.BOUNCED || 0) + 1;
    } else if (['positive_reply', 'reply_review', 'replied'].includes(st)) {
      statusCounts.REPLIED = (statusCounts.REPLIED || 0) + 1;
    } else {
      statusCounts.OTHER++;
    }

    // Filter by status
    if (statusFilter !== 'all') {
      if (statusFilter === 'top_10' && (st !== 'awaiting_review' || score < 80)) continue;
      if (statusFilter === 'backlog' && (st !== 'awaiting_review' || score >= 80)) continue;
      if (statusFilter === 'awaiting_review' && st !== 'awaiting_review') continue;
      if (statusFilter === 'needs_research' && st !== 'needs_research') continue;
      if ((statusFilter === 'approved' || statusFilter === 'queued') && st !== 'approved' && app !== 'approved' && st !== 'queued') continue;
      if (statusFilter === 'sending' && st !== 'sending') continue;
      if (statusFilter === 'send_review' && st !== 'send_review') continue;
      if (statusFilter === 'rejected' && st !== 'rejected' && app !== 'rejected') continue;
      if (statusFilter === 'sent' && st !== 'sent') continue;
      if (statusFilter === 'bounced' && st !== 'bounced') continue;
      if (statusFilter === 'replied' && !['positive_reply', 'reply_review', 'replied'].includes(st)) continue;
    }

    // Filter by search query (business, email, website, city, industry, opportunity)
    if (searchQuery) {
      const b = normalizeKey(item.business);
      const e = normalizeKey(item.public_email);
      const w = normalizeKey(item.website);
      const c = normalizeKey(item.city);
      const ind = normalizeKey(item.industry);
      const opp = normalizeKey(item.opportunity);
      if (!b.includes(searchQuery) && !e.includes(searchQuery) &&
          !w.includes(searchQuery) && !c.includes(searchQuery) &&
          !ind.includes(searchQuery) && !opp.includes(searchQuery)) {
        continue;
      }
    }

    // Compute live compliance indicator using single authoritative validator
    const body = String(item.email_body || '').trim();
    const val = typeof validateEmailStructure === 'function' 
      ? validateEmailStructure(body, item.proof_line)
      : { isValid: false, wordCount: body ? body.split(/\s+/).length : 0, paragraphCount: body ? body.split(/\n\s*\n/).length : 0 };
    
    item.computed_word_count = val.wordCount;
    item.computed_paragraphs = val.paragraphCount;
    item.is_compliant = val.isValid;

    allLeads.push(item);
  }

  // Sort: Awaiting review first, then by updated_at or lead_id
  allLeads.sort((a, b) => {
    if (a.status === 'AWAITING_REVIEW' && b.status !== 'AWAITING_REVIEW') return -1;
    if (b.status === 'AWAITING_REVIEW' && a.status !== 'AWAITING_REVIEW') return 1;
    return String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || ''));
  });

  const total = allLeads.length;
  const startIndex = (page - 1) * pageSize;
  const paginatedLeads = allLeads.slice(startIndex, startIndex + pageSize);

  return {
    leads: paginatedLeads,
    total: total,
    page: page,
    pageSize: pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
    statuses: statusCounts
  };
}

/**
 * Returns full details for a single lead by stable lead_id.
 */
function apiGetLeadDetails(leadId) {
  assertAuthorizedAdmin();
  if (!leadId) throw new Error('lead_id is required');

  const book = getSpreadsheet();
  const sheet = getQueueSheet(book);
  if (!sheet) throw new Error('Approval Queue sheet missing');

  const rows = sheet.getDataRange().getValues();
  const headers = rows[0].map(h => normalizeKey(h));
  const leadIdCol = headers.indexOf('lead_id');

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][leadIdCol]).trim() === String(leadId).trim()) {
      const record = {};
      headers.forEach((h, col) => {
        let val = rows[i][col];
        if (val instanceof Date) val = val.toISOString();
        else if (val === null || val === undefined) val = '';
        record[h] = val;
      });
      
      // Calculate validation errors using single authoritative validator
      const body = String(record.email_body || '').trim();
      const proofLine = String(record.proof_line || 'Our team designed and built the OneFolk website.').trim();
      const val = typeof validateEmailStructure === 'function'
        ? validateEmailStructure(body, proofLine)
        : { isValid: true, reason: 'VALID', wordCount: body ? body.split(/\s+/).length : 0, paragraphCount: body ? body.split(/\n\s*\n/).length : 0 };

      const validationErrors = [];
      if (!record.subject || !record.subject.trim()) {
        validationErrors.push('Subject line is missing.');
      }
      if (!val.isValid) {
        validationErrors.push(val.reason);
      }
      if (!record.public_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.public_email)) {
        validationErrors.push('Recipient email is invalid or missing.');
      }

      record.validationErrors = validationErrors;
      record.isValidDraft = validationErrors.length === 0;
      record.wordCount = val.wordCount;
      record.paragraphCount = val.paragraphCount;
      return record;
    }
  }

  throw new Error('Lead ID not found: ' + leadId);
}

/**
 * Validates and saves an edited cold email draft (subject and body).
 */
function apiSaveDraft(leadId, subject, emailBody) {
  const userEmail = assertAuthorizedAdmin();
  if (!leadId) throw new Error('lead_id is required');
  
  subject = String(subject || '').trim();
  emailBody = String(emailBody || '').trim();

  if (!subject) throw new Error('Subject line cannot be empty.');
  if (!emailBody) throw new Error('Email body cannot be empty.');
  const words = validateEmailStructure(emailBody).wordCount;

  // Validate strict requirements using single authoritative validator
  if (typeof validateEmailStructure === 'function') {
    const val = validateEmailStructure(emailBody);
    if (!val.isValid) {
      throw new Error(val.reason);
    }
  } else {
    const paras = emailBody.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    if (paras.length !== 4) {
      throw new Error('Draft must contain exactly 4 content paragraphs. Found ' + paras.length + '.');
    }
    if (words < 50 || words > 150) {
      throw new Error('Draft must target 70-120 words. Found ' + words + '.');
    }
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const book = getSpreadsheet();
    const sheet = getQueueSheet(book);
    if (!sheet) throw new Error('Approval Queue sheet missing');

    const rows = sheet.getDataRange().getValues();
    const headers = rows[0].map(h => normalizeKey(h));
    const leadIdCol = headers.indexOf('lead_id');
    const subjectCol = headers.indexOf('subject');
    const bodyCol = headers.indexOf('email_body');
    const wordCountCol = headers.indexOf('word_count');
    const updatedCol = headers.indexOf('updated_at');
    const statusCol = headers.indexOf('status');
    const approvalCol = headers.indexOf('approval');

    let targetRow = -1;
    let existingRecord = {};
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][leadIdCol]).trim() === String(leadId).trim()) {
        targetRow = i + 1;
        headers.forEach((h, c) => { existingRecord[h] = rows[i][c]; });
        break;
      }
    }

    if (targetRow === -1) throw new Error('Lead ID not found: ' + leadId);

    // Ensure proof line is preserved or OneFolk capability connected
    const proofLine = String(existingRecord.proof_line || 'Our team designed and built the OneFolk website.').trim();
    if (!emailBody.includes(proofLine) && !emailBody.toLowerCase().includes('onefolk')) {
      throw new Error('Draft must include the truthful OneFolk proof line or connect OneFolk capabilities: "' + proofLine + '"');
    }

    // Persist changes
    if (subjectCol !== -1) sheet.getRange(targetRow, subjectCol + 1).setValue(sanitizeCellValue(subject));
    if (bodyCol !== -1) sheet.getRange(targetRow, bodyCol + 1).setValue(sanitizeCellValue(emailBody));
    if (wordCountCol !== -1) sheet.getRange(targetRow, wordCountCol + 1).setValue(words);
    if (updatedCol !== -1) sheet.getRange(targetRow, updatedCol + 1).setValue(new Date().toISOString());

    // If draft was previously approved, editing invalidates approval
    if (statusCol !== -1 && normalizeKey(existingRecord.status) === 'approved') {
      sheet.getRange(targetRow, statusCol + 1).setValue('AWAITING_REVIEW');
      if (approvalCol !== -1) sheet.getRange(targetRow, approvalCol + 1).setValue('PENDING');
      setProp('APPROVAL_' + leadId, '');
    }

    // Record audit trail
    recordAuditEntry(leadId, userEmail, 'EDITED', '');

    return {
      success: true,
      lead_id: leadId,
      message: 'Draft saved successfully. Word count: ' + words + ' words.'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Executes double-key approval with cryptographic SHA-256 fingerprinting.
 */
function apiApproveLead(leadId, editedSubject, editedBody) {
  const userEmail = assertAuthorizedAdmin();
  if (!leadId) throw new Error('lead_id is required');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const book = getSpreadsheet();
    const sheet = getQueueSheet(book);
    if (!sheet) throw new Error('Approval Queue sheet missing');

    const rows = sheet.getDataRange().getValues();
    const headers = rows[0].map(h => normalizeKey(h));
    const leadIdCol = headers.indexOf('lead_id');
    const subjectCol = headers.indexOf('subject');
    const bodyCol = headers.indexOf('email_body');
    const wordCountCol = headers.indexOf('word_count');
    const statusCol = headers.indexOf('status');
    const approvalCol = headers.indexOf('approval');
    const notesCol = headers.indexOf('reviewer_notes') !== -1 ? headers.indexOf('reviewer_notes') : headers.indexOf('notes');
    const updatedCol = headers.indexOf('updated_at');

    let targetRow = -1;
    let r = {};
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][leadIdCol]).trim() === String(leadId).trim()) {
        targetRow = i + 1;
        headers.forEach((h, c) => { r[h] = rows[i][c]; });
        break;
      }
    }

    if (targetRow === -1) throw new Error('Lead ID not found: ' + leadId);

    // Apply edits if provided
    if (editedSubject && editedSubject.trim()) {
      r.subject = editedSubject.trim();
    }
    if (editedBody && editedBody.trim()) {
      r.email_body = editedBody.trim();
      const w = validateEmailStructure(r.email_body).wordCount;
      r.word_count = w;
    }

    // Check current status
    const currentStatus = normalizeKey(r.status);
    if (['sent', 'sending', 'bounced', 'declined', 'positive_reply'].includes(currentStatus)) {
      throw new Error(`Cannot approve lead in '${r.status}' status: email has already been dispatched or closed.`);
    }

    // Check suppression
    const blocked = buildSuppressionSet();
    const email = normalizeKey(r.public_email);
    const domain = extractDomain(r.website);
    if (blocked.has(email) || (domain && blocked.has(domain))) {
      throw new Error('Approval blocked: Recipient email or domain is on the Suppression List.');
    }

    const body = String(r.email_body || '').trim();
    const proofLine = String(r.proof_line || 'Our team designed and built the OneFolk website.').trim();

    if (typeof validateEmailStructure === 'function') {
      const val = validateEmailStructure(body, proofLine);
      if (!val.isValid) {
        throw new Error(val.reason);
      }
    } else {
      const paras = body ? body.split(/\n\s*\n/).filter(p => p.trim().length > 0) : [];
      if (paras.length !== 4) {
        throw new Error('Draft must contain exactly 4 content paragraphs (found ' + paras.length + ').');
      }
      const words = body ? body.split(/\s+/).length : 0;
      if (words < 50 || words > 150) {
        throw new Error('Draft must target 70-120 words (found ' + words + ').');
      }
    }

    if (!reviewableRecord(r)) {
      throw new Error('Approval blocked: complete, fresh research evidence and genuine alternative openings are required.');
    }

    // Persist only after the entire proposed record passes validation.
    if (subjectCol !== -1) sheet.getRange(targetRow, subjectCol + 1).setValue(sanitizeCellValue(r.subject));
    if (bodyCol !== -1) sheet.getRange(targetRow, bodyCol + 1).setValue(sanitizeCellValue(r.email_body));
    if (wordCountCol !== -1) sheet.getRange(targetRow, wordCountCol + 1).setValue(validateEmailStructure(r.email_body).wordCount);

    // Compute fingerprint
    const fingerprint = draftFingerprint(r);
    setProp('APPROVAL_' + leadId, fingerprint);

    const nowIso = new Date().toISOString();
    const meta = {
      approved_by: userEmail,
      approved_at: nowIso,
      recipient: email,
      subject: r.subject,
      fingerprint: fingerprint
    };
    setProp('APPROVAL_META_' + leadId, JSON.stringify(meta));

    // Write approval keys
    if (statusCol !== -1) sheet.getRange(targetRow, statusCol + 1).setValue('APPROVED');
    if (approvalCol !== -1) sheet.getRange(targetRow, approvalCol + 1).setValue('APPROVED');
    if (notesCol !== -1) {
      sheet.getRange(targetRow, notesCol + 1).setValue('Approved via OneFolk Dashboard by ' + userEmail);
    }
    if (updatedCol !== -1) {
      sheet.getRange(targetRow, updatedCol + 1).setValue(nowIso);
    }
    recordAuditEntry(leadId, userEmail, 'APPROVED', fingerprint);

    return {
      success: true,
      lead_id: leadId,
      fingerprint: fingerprint,
      status: 'APPROVED',
      approved_at: nowIso,
      message: 'Draft approved successfully.'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Rejects a lead draft.
 */
function apiRejectLead(leadId, reason) {
  const userEmail = assertAuthorizedAdmin();
  if (!leadId) throw new Error('lead_id is required');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const book = getSpreadsheet();
    const sheet = getQueueSheet(book);
    if (!sheet) throw new Error('Approval Queue sheet missing');

    const rows = sheet.getDataRange().getValues();
    const headers = rows[0].map(h => normalizeKey(h));
    const leadIdCol = headers.indexOf('lead_id');
    const statusCol = headers.indexOf('status');
    const approvalCol = headers.indexOf('approval');
    const notesCol = headers.indexOf('reviewer_notes') !== -1 ? headers.indexOf('reviewer_notes') : headers.indexOf('notes');
    const updatedCol = headers.indexOf('updated_at');

    let targetRow = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][leadIdCol]).trim() === String(leadId).trim()) {
        targetRow = i + 1;
        break;
      }
    }

    if (targetRow === -1) throw new Error('Lead ID not found: ' + leadId);

    // Clear approval fingerprint
    setProp('APPROVAL_' + leadId, '');

    const rejReason = reason ? String(reason).trim() : 'Rejected via OneFolk Dashboard';
    if (statusCol !== -1) sheet.getRange(targetRow, statusCol + 1).setValue('REJECTED');
    if (approvalCol !== -1) sheet.getRange(targetRow, approvalCol + 1).setValue('REJECTED');
    if (notesCol !== -1) sheet.getRange(targetRow, notesCol + 1).setValue(rejReason + ' by ' + userEmail);
    if (updatedCol !== -1) sheet.getRange(targetRow, updatedCol + 1).setValue(new Date().toISOString());

    // Record audit trail
    recordAuditEntry(leadId, userEmail, 'REJECTED', '');

    return {
      success: true,
      lead_id: leadId,
      message: 'Lead rejected.'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Batch approves a list of lead IDs with cryptographic SHA-256 fingerprinting.
 */
function apiBatchApproveLeads(leadIds) {
  const userEmail = assertAuthorizedAdmin();
  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    throw new Error('At least one lead ID is required for batch approval');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const book = getSpreadsheet();
    const sheet = getQueueSheet(book);
    if (!sheet) throw new Error('Approval Queue sheet missing');

    const rows = sheet.getDataRange().getValues();
    const headers = rows[0].map(h => normalizeKey(h));
    const leadIdCol = headers.indexOf('lead_id');
    const statusCol = headers.indexOf('status');
    const approvalCol = headers.indexOf('approval');
    const notesCol = headers.indexOf('reviewer_notes') !== -1 ? headers.indexOf('reviewer_notes') : headers.indexOf('notes');
    const updatedCol = headers.indexOf('updated_at');

    const blocked = buildSuppressionSet();
    const targetSet = new Set(leadIds.map(id => String(id).trim()));

    const results = {
      totalRequested: leadIds.length,
      approvedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      approvedIds: [],
      errors: []
    };

    const nowIso = new Date().toISOString();

    for (let i = 1; i < rows.length; i++) {
      const rowLeadId = String(rows[i][leadIdCol]).trim();
      if (!targetSet.has(rowLeadId)) continue;

      const r = {};
      headers.forEach((h, c) => { r[h] = rows[i][c]; });

      const currentStatus = normalizeKey(r.status);
      if (['sent', 'sending', 'bounced', 'declined', 'positive_reply'].includes(currentStatus)) {
        results.skippedCount++;
        results.errors.push({ lead_id: rowLeadId, reason: `Already in final status '${r.status}'` });
        continue;
      }

      const email = normalizeKey(r.public_email);
      const domain = extractDomain(r.website);
      if (blocked.has(email) || (domain && blocked.has(domain))) {
        results.skippedCount++;
        results.errors.push({ lead_id: rowLeadId, reason: 'Recipient or domain on Suppression List' });
        continue;
      }

      const body = String(r.email_body || '').trim();
      const proofLine = String(r.proof_line || 'Our team designed and built the OneFolk website.').trim();

      if (typeof validateEmailStructure === 'function') {
        const val = validateEmailStructure(body, proofLine);
        if (!val.isValid) {
          results.failedCount++;
          results.errors.push({ lead_id: rowLeadId, reason: val.reason });
          continue;
        }
      }

      if (!reviewableRecord(r)) {
        results.failedCount++;
        results.errors.push({lead_id: rowLeadId, reason: 'Complete, fresh research evidence and genuine alternative openings are required.'});
        continue;
      }

      // Fingerprint and approval properties
      const fingerprint = draftFingerprint(r);
      setProp('APPROVAL_' + rowLeadId, fingerprint);

      const meta = {
        approved_by: userEmail,
        approved_at: nowIso,
        recipient: email,
        subject: r.subject,
        fingerprint: fingerprint,
        batch: true
      };
      setProp('APPROVAL_META_' + rowLeadId, JSON.stringify(meta));

      // Update in-memory row array (single batch write after loop)
      if (statusCol !== -1) rows[i][statusCol] = 'APPROVED';
      if (approvalCol !== -1) rows[i][approvalCol] = 'APPROVED';
      if (notesCol !== -1) rows[i][notesCol] = sanitizeCellValue('Batch approved via OneFolk Dashboard by ' + userEmail);
      if (updatedCol !== -1) rows[i][updatedCol] = nowIso;
      [statusCol, approvalCol, notesCol, updatedCol].filter(c => c >= 0).forEach(c =>
        sheet.getRange(i + 1, c + 1).setValue(sanitizeCellValue(rows[i][c])));
      recordAuditEntry(rowLeadId, userEmail, 'APPROVED', fingerprint);
      results.approvedCount++;
      results.approvedIds.push(rowLeadId);
    }




    return {
      success: true,
      message: `Successfully approved ${results.approvedCount} leads.`,
      ...results
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Automatically approves all compliant unapproved leads in the Approval Queue.
 */
function apiApproveAllCompliantLeads() {
  const userEmail = assertAuthorizedAdmin();
  const book = getSpreadsheet();
  const sheet = getQueueSheet(book);
  if (!sheet) throw new Error('Approval Queue sheet missing');

  const rows = sheet.getDataRange().getValues();
  const headers = rows[0].map(h => normalizeKey(h));
  const leadIdCol = headers.indexOf('lead_id');
  const statusCol = headers.indexOf('status');
  const bodyCol = headers.indexOf('email_body');
  const proofLineCol = headers.indexOf('proof_line');
  const emailCol = headers.indexOf('public_email');

  const eligibleIds = [];
  const blocked = buildSuppressionSet();

  for (let i = 1; i < rows.length; i++) {
    const st = normalizeKey(rows[i][statusCol]);
    if (st !== 'awaiting_review' && st !== 'drafted' && st !== 'needs_research' && st !== 'needs_review') continue;

    const email = normalizeKey(rows[i][emailCol]);
    if (!email || blocked.has(email)) continue;

    const body = String(rows[i][bodyCol] || '').trim();
    const proofLine = String(rows[i][proofLineCol] || 'Our team designed and built the OneFolk website.').trim();

    if (typeof validateEmailStructure === 'function') {
      const val = validateEmailStructure(body, proofLine);
      if (!val.isValid) continue;
    }

    const leadId = String(rows[i][leadIdCol]).trim();
    if (leadId) eligibleIds.push(leadId);
  }

  if (eligibleIds.length === 0) {
    return {
      success: true,
      approvedCount: 0,
      message: 'No unapproved compliant leads found to approve.'
    };
  }

  return apiBatchApproveLeads(eligibleIds);
}

/**
 * Batch rejects a list of lead IDs.
 */
function apiBatchRejectLeads(leadIds, reason) {
  const userEmail = assertAuthorizedAdmin();
  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    throw new Error('At least one lead ID is required for batch rejection');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const book = getSpreadsheet();
    const sheet = getQueueSheet(book);
    if (!sheet) throw new Error('Approval Queue sheet missing');

    const rows = sheet.getDataRange().getValues();
    const headers = rows[0].map(h => normalizeKey(h));
    const leadIdCol = headers.indexOf('lead_id');
    const statusCol = headers.indexOf('status');
    const approvalCol = headers.indexOf('approval');
    const notesCol = headers.indexOf('reviewer_notes') !== -1 ? headers.indexOf('reviewer_notes') : headers.indexOf('notes');
    const updatedCol = headers.indexOf('updated_at');

    const targetSet = new Set(leadIds.map(id => String(id).trim()));
    const rejReason = reason ? String(reason).trim() : 'Batch rejected via OneFolk Dashboard';
    let rejectedCount = 0;

    for (let i = 1; i < rows.length; i++) {
      const rowLeadId = String(rows[i][leadIdCol]).trim();
      if (!targetSet.has(rowLeadId)) continue;

      if (['sent','sending','send_review','bounced','declined','unsubscribed','positive_reply'].includes(normalizeKey(rows[i][statusCol]))) continue;
      setProp('APPROVAL_' + rowLeadId, '');

      // In-memory update
      if (statusCol !== -1) rows[i][statusCol] = 'REJECTED';
      if (approvalCol !== -1) rows[i][approvalCol] = 'REJECTED';
      if (notesCol !== -1) rows[i][notesCol] = sanitizeCellValue(rejReason + ' by ' + userEmail);
      if (updatedCol !== -1) rows[i][updatedCol] = new Date().toISOString();

      [statusCol, approvalCol, notesCol, updatedCol].filter(c => c >= 0).forEach(c =>
        sheet.getRange(i + 1, c + 1).setValue(sanitizeCellValue(rows[i][c])));
      setProp('APPROVAL_META_' + rowLeadId, '');
      recordAuditEntry(rowLeadId, userEmail, 'REJECTED', '');
      rejectedCount++;
    }



    return {
      success: true,
      rejectedCount: rejectedCount,
      message: `Successfully rejected ${rejectedCount} leads.`
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Marks a lead as NEEDS_RESEARCH.
 */
function apiMarkNeedsResearch(leadId, note) {
  const userEmail = assertAuthorizedAdmin();
  if (!leadId) throw new Error('lead_id is required');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const book = getSpreadsheet();
    const sheet = getQueueSheet(book);
    if (!sheet) throw new Error('Approval Queue sheet missing');

    const rows = sheet.getDataRange().getValues();
    const headers = rows[0].map(h => normalizeKey(h));
    const leadIdCol = headers.indexOf('lead_id');
    const statusCol = headers.indexOf('status');
    const approvalCol = headers.indexOf('approval');
    const notesCol = headers.indexOf('reviewer_notes') !== -1 ? headers.indexOf('reviewer_notes') : headers.indexOf('notes');
    const updatedCol = headers.indexOf('updated_at');

    let targetRow = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][leadIdCol]).trim() === String(leadId).trim()) {
        targetRow = i + 1;
        break;
      }
    }

    if (targetRow === -1) throw new Error('Lead ID not found: ' + leadId);

    setProp('APPROVAL_' + leadId, '');
    const noteText = note ? String(note).trim() : 'Flagged for further research';

    if (statusCol !== -1) sheet.getRange(targetRow, statusCol + 1).setValue('NEEDS_RESEARCH');
    if (approvalCol !== -1) sheet.getRange(targetRow, approvalCol + 1).setValue('PENDING');
    if (notesCol !== -1) sheet.getRange(targetRow, notesCol + 1).setValue(noteText + ' (' + userEmail + ')');
    if (updatedCol !== -1) sheet.getRange(targetRow, updatedCol + 1).setValue(new Date().toISOString());

    recordAuditEntry(leadId, userEmail, 'NEEDS_RESEARCH', '');

    return {
      success: true,
      lead_id: leadId,
      message: 'Lead flagged for additional research.'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Cancels a previously authorized draft while still QUEUED or APPROVED, before dispatch.
 */
function apiCancelApproval(leadId) {
  const userEmail = assertAuthorizedAdmin();
  if (!leadId) throw new Error('lead_id is required');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const book = getSpreadsheet();
    const sheet = getQueueSheet(book);
    if (!sheet) throw new Error('Approval Queue sheet missing');

    const rows = sheet.getDataRange().getValues();
    const headers = rows[0].map(h => normalizeKey(h));
    const leadIdCol = headers.indexOf('lead_id');
    const statusCol = headers.indexOf('status');
    const approvalCol = headers.indexOf('approval');
    const notesCol = headers.indexOf('reviewer_notes') !== -1 ? headers.indexOf('reviewer_notes') : headers.indexOf('notes');
    const updatedCol = headers.indexOf('updated_at');

    let targetRow = -1;
    let currentStatus = '';
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][leadIdCol]).trim() === String(leadId).trim()) {
        targetRow = i + 1;
        currentStatus = String(rows[i][statusCol] || '').trim().toUpperCase();
        break;
      }
    }

    if (targetRow === -1) throw new Error('Lead ID not found: ' + leadId);
    if (['SENT', 'SENDING', 'BOUNCED', 'POSITIVE_REPLY', 'MEETING_BOOKED', 'PROPOSAL_REQUESTED', 'CLIENT_CONVERTED'].includes(currentStatus)) {
      throw new Error(`Cannot cancel lead in '${currentStatus}' status; dispatch has already commenced.`);
    }

    // Invalidate approval keys
    setProp('APPROVAL_' + leadId, '');
    setProp('APPROVAL_META_' + leadId, '');

    const nowIso = new Date().toISOString();
    if (statusCol !== -1) sheet.getRange(targetRow, statusCol + 1).setValue('AWAITING_REVIEW');
    if (approvalCol !== -1) sheet.getRange(targetRow, approvalCol + 1).setValue('PENDING');
    if (notesCol !== -1) sheet.getRange(targetRow, notesCol + 1).setValue('Authorization cancelled by ' + userEmail);
    if (updatedCol !== -1) sheet.getRange(targetRow, updatedCol + 1).setValue(nowIso);

    // Record audit trail
    recordAuditEntry(leadId, userEmail, 'CANCELLED_APPROVAL', '');

    return {
      success: true,
      lead_id: leadId,
      message: 'Sending authorization cancelled. Lead returned to review queue.'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Emergency stop: Immediately disarms all automatic outbound dispatching.
 */
function apiEmergencyStop() {
  const userEmail = assertAuthorizedAdmin();
  setProp('ENABLE_SENDING', 'NO');
  setProp('EMERGENCY_STOP_ACTIVE', 'YES');
  recordAuditEntry('SYSTEM', userEmail, 'EMERGENCY_STOP', 'Sending halted by admin');
  return {
    success: true,
    message: 'EMERGENCY STOP ACTIVATED: Outbound sending is immediately disarmed.'
  };
}

/**
 * System-level sending authorization: Enables production automatic dispatching.
 */
function apiAuthorizeSystemSending() {
  const userEmail = assertAuthorizedAdmin();
  setProp('ENABLE_SENDING', 'YES');
  setProp('EMERGENCY_STOP_ACTIVE', 'NO');
  const nowIso = new Date().toISOString();
  setProp('ACTIVATION_TIMESTAMP', nowIso);
  recordAuditEntry('SYSTEM', userEmail, 'SENDING_AUTHORIZED', 'System-level dispatch enabled for freshly approved leads');
  return {
    success: true,
    activation_timestamp: nowIso,
    message: 'System-level sending authorization active. Newly approved messages will be dispatched automatically.'
  };
}

/**
 * Sends a single explicitly authorized test email to an internal OneFolk admin address.
 * Validates Gmail connectivity, delivery acceptance, and Google Sheet activity synchronization.
 */
function apiSendInternalTestEmail(recipientEmail) {
  const userEmail = assertAuthorizedAdmin();
  const target = normalizeKey(recipientEmail || userEmail);
  const admins = getAuthorizedAdmins();

  if (!admins.includes(target)) {
    throw new Error(`Recipient '${target}' is not an authorized OneFolk administrator email. Internal test messages can only be sent to allowlisted admin accounts (${admins.join(', ')}).`);
  }

  const mailQuota = MailApp.getRemainingDailyQuota();
  if (mailQuota <= 0) {
    throw new Error('Google MailApp quota exhausted for today.');
  }

  const istTimeStr = (typeof Utilities !== 'undefined' && Utilities.formatDate)
    ? Utilities.formatDate(new Date(), 'Asia/Kolkata', 'HH:mm:ss') + ' IST'
    : new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }) + ' IST';
  const subject = '[OneFolk System Test] Live Outbound Verification ' + istTimeStr;
  const bodyText = 'This is an explicitly authorized test email from OneFolk Outreach Engine.\n\nOur team designed and built the OneFolk website.\n\nDoes this confirmation reach your inbox properly?';
  const formatted = formatOneFolkEmail(bodyText, 'OneFolk Operations');

  const draft = GmailApp.createDraft(target, subject, formatted.plainText, {
    name: 'Team OneFolk',
    htmlBody: formatted.htmlBody
  });
  const message = draft.send();
  const msgId = message.getId();
  const threadId = message.getThread().getId();
  const now = new Date();

  // Synchronize to Email Activity
  const book = getSpreadsheet();
  const activitySheet = book ? book.getSheetByName(TAB_EMAIL_ACTIVITY_NAME) : null;
  if (activitySheet) {
    const actId = 'test_' + Math.floor(Math.random() * 1000000);
    activitySheet.appendRow([
      actId,
      'internal_test_lead',
      'OneFolk Internal Verification',
      target,
      subject,
      'SENT',
      now,
      msgId,
      threadId,
      'NONE',
      '',
      '',
      'Internal test verified by ' + userEmail,
      now
    ]);
  }

  setProp('INTERNAL_TEST_VERIFIED', 'YES');
  setProp('INTERNAL_TEST_TIMESTAMP', now.toISOString());
  recordAuditEntry('internal_test_lead', userEmail, 'INTERNAL_TEST_SENT', msgId);

  return {
    success: true,
    recipient: target,
    messageId: msgId,
    threadId: threadId,
    subject: subject,
    sentAt: now.toISOString(),
    message: 'Internal test message dispatched successfully to ' + target
  };
}

/**
 * Returns historical campaign execution logs from Campaign Runs tab.
 */
function apiGetCampaignRuns() {
  assertAuthorizedAdmin();
  const book = getSpreadsheet();
  const sheet = book.getSheetByName(TAB_CAMPAIGN_RUNS);
  if (!sheet) return [];

  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const headers = rows[0].map(h => normalizeKey(h));
  const runs = [];
  for (let i = rows.length - 1; i >= 1; i--) {
    const item = {};
    headers.forEach((h, col) => {
      let val = rows[i][col];
      if (val instanceof Date) val = val.toISOString();
      else if (val === null || val === undefined) val = '';
      item[h] = val;
    });
    // Parse JSON fields if present
    if (item.shortage_reasons && typeof item.shortage_reasons === 'string') {
      try { item.shortage_reasons = JSON.parse(item.shortage_reasons); } catch (e) {}
    }
    runs.push(item);
  }
  return runs;
}

/**
 * Returns sent email records and reply monitoring activity.
 */
function apiGetSentAndReplies() {
  assertAuthorizedAdmin();
  const book = getSpreadsheet();
  const activitySheet = book ? book.getSheetByName(TAB_EMAIL_ACTIVITY_NAME) : null;
  const sentSheet = book ? book.getSheetByName(TAB_HISTORICAL_SENT_NAME) : null;

  const activities = [];

  // 1. From Email Activity tab
  if (activitySheet) {
    const rows = activitySheet.getDataRange().getValues();
    if (rows.length > 1) {
      const headers = rows[0].map(h => normalizeKey(h));
      for (let i = rows.length - 1; i >= 1; i--) {
        const item = {};
        headers.forEach((h, col) => {
          let val = rows[i][col];
          if (val instanceof Date) val = val.toISOString();
          else if (val === null || val === undefined) val = '';
          item[h] = val;
        });
        item.source_tab = 'Email Activity';
        activities.push(item);
      }
    }
  }

  // 2. From historical Sent Emails tab
  if (sentSheet) {
    const rows = sentSheet.getDataRange().getValues();
    if (rows.length > 1) {
      for (let i = rows.length - 1; i >= 1; i--) {
        const item = {
          sent_at: rows[i][0] instanceof Date ? rows[i][0].toISOString() : String(rows[i][0] || ''),
          recipient_email: String(rows[i][1] || ''),
          subject: String(rows[i][2] || ''),
          campaign: String(rows[i][3] || ''),
          status: String(rows[i][4] || ''),
          reply_status: String(rows[i][5] || ''),
          gmail_thread_id: String(rows[i][6] || ''),
          source_tab: 'Historical Sent'
        };
        activities.push(item);
      }
    }
  }

  return activities;
}

/**
 * Returns complete system health, locks, quotas, and admin status.
 */
function apiGetSystemHealth() {
  const userEmail = assertAuthorizedAdmin();
  let mailQuota = 100;
  try {
    mailQuota = MailApp.getRemainingDailyQuota();
  } catch (e) {
    Logger.log('Quota error: ' + e);
  }

  let dailySentToday = 0;
  try {
    dailySentToday = typeof getDailySendCount === 'function' ? getDailySendCount() : 0;
  } catch (e) {
    Logger.log('Daily send count error: ' + e);
  }

  const sendingLock = typeof IMPLEMENTATION_SENDING_LOCK !== 'undefined' ? IMPLEMENTATION_SENDING_LOCK : false;
  const enableSending = typeof getProp === 'function' ? (getProp('ENABLE_SENDING') || 'NO') : 'NO';
  const maxDaily = typeof MAX_DAILY_RECIPIENTS !== 'undefined' ? MAX_DAILY_RECIPIENTS : 50;

  let snapshot = {};
  try {
    snapshot = typeof automationSnapshot === 'function' ? automationSnapshot() : {};
  } catch (err) {
    snapshot = { error: String(err) };
  }

  let triggers = [];
  try {
    triggers = ScriptApp.getProjectTriggers().map(t => ({
      handler: t.getHandlerFunction(),
      type: t.getEventType().toString()
    }));
  } catch (e) {
    Logger.log('Triggers error: ' + e);
  }

  return {
    userEmail: userEmail,
    authorizedAdmins: typeof getAuthorizedAdmins === 'function' ? getAuthorizedAdmins() : [],
    quotas: {
      mailAppRemainingQuota: mailQuota,
      dailySendsToday: dailySentToday,
      maxDailyRecipients: maxDaily,
      groqTier: 'Groq Free Tier (llama-3.3-70b-versatile / 30 requests per batch)',
      runnerMinutesLimit: '1,500 mins/mo free tier (Soft limit 1,200 mins)'
    },
    safetyGates: {
      implementationLockActive: sendingLock,
      enableSendingValue: enableSending,
      liveDispatchActive: !sendingLock && enableSending === 'YES',
      emergencyStopActive: getProp('EMERGENCY_STOP_ACTIVE') === 'YES',
      activationTimestamp: getProp('ACTIVATION_TIMESTAMP') || 'NONE',
      internalTestVerified: getProp('INTERNAL_TEST_VERIFIED') === 'YES',
      internalTestTimestamp: getProp('INTERNAL_TEST_TIMESTAMP') || 'NONE',
      killSwitchFunction: 'emergencyStop()'
    },
    triggersInstalled: triggers,
    automationSnapshot: snapshot
  };
}

/**
 * Appends an entry into the Approval Audit sheet.
 */
function recordAuditEntry(leadId, reviewer, action, fingerprint) {
  try {
    const book = getSpreadsheet();
    let audit = book.getSheetByName(TAB_APPROVAL_AUDIT);
    if (!audit) {
      audit = book.insertSheet(TAB_APPROVAL_AUDIT);
      audit.appendRow(['timestamp', 'lead_id', 'reviewer', 'action', 'fingerprint']);
    }
    audit.appendRow([
      new Date().toISOString(),
      leadId,
      reviewer || 'ANONYMOUS',
      action,
      fingerprint || ''
    ]);
  } catch (err) {
    Logger.log('Failed to write audit entry: ' + err);
  }
}


function clientValidationSource() {
  return [normalizeWhitespace, splitSentences, validateEmailStructure, formatOneFolkEmail].map(fn => fn.toString()).join('\n');
}
