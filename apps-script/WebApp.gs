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
  const queueSheet = book.getSheetByName(TAB_APPROVAL_QUEUE);
  let readyToReview = 0;
  let awaitingApproval = 0;
  let needsResearch = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let sentCount = 0;
  let bouncedCount = 0;
  let positiveReplyCount = 0;
  let totalQueueRows = 0;
  
  if (queueSheet) {
    const rows = queueSheet.getDataRange().getValues();
    if (rows.length > 1) {
      const headers = rows[0].map(h => normalizeKey(h));
      const statusCol = headers.indexOf('status');
      const approvalCol = headers.indexOf('approval');
      
      totalQueueRows = rows.length - 1;
      for (let i = 1; i < rows.length; i++) {
        const st = statusCol !== -1 ? normalizeKey(rows[i][statusCol]) : '';
        const app = approvalCol !== -1 ? normalizeKey(rows[i][approvalCol]) : '';
        
        if (st === 'awaiting_review' && app === 'pending') {
          readyToReview++;
          awaitingApproval++;
        } else if (st === 'needs_research') {
          needsResearch++;
        } else if (st === 'approved' || app === 'approved') {
          approvedCount++;
        } else if (st === 'rejected' || app === 'rejected') {
          rejectedCount++;
        } else if (st === 'sent') {
          sentCount++;
        } else if (st === 'bounced') {
          bouncedCount++;
        } else if (st === 'positive_reply') {
          positiveReplyCount++;
        }
      }
    }
  }

  // 2. Metrics from Dashboard sheet
  const dashSheet = book.getSheetByName(TAB_DASHBOARD);
  const sheetKpis = {};
  if (dashSheet) {
    const dRows = dashSheet.getDataRange().getValues();
    for (let i = 1; i < dRows.length; i++) {
      const metric = String(dRows[i][0] || '').trim();
      const val = String(dRows[i][1] || '').trim();
      if (metric) {
        sheetKpis[metric] = val;
      }
    }
  }

  // 3. Automation & health snapshot
  let healthInfo = {};
  try {
    healthInfo = automationSnapshot();
  } catch (err) {
    healthInfo = {
      ready: readyToReview,
      needs: needsResearch,
      shortage: Math.max(0, 50 - readyToReview),
      failures: ['Snapshot error: ' + String(err)],
      last_success: 'NONE'
    };
  }

  // 4. Quotas & limits
  const mailQuota = MailApp.getRemainingDailyQuota();
  const dailySentToday = getDailySendCount();
  const maxDaily = MAX_DAILY_RECIPIENTS;
  const isSendingActive = !IMPLEMENTATION_SENDING_LOCK && getProp('ENABLE_SENDING') === 'YES';

  return {
    userEmail: userEmail,
    timestamp: new Date().toISOString(),
    metrics: {
      readyToReview: readyToReview,
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
      targetDailyGoal: 50
    },
    system: {
      sendingLocked: IMPLEMENTATION_SENDING_LOCK,
      enableSending: getProp('ENABLE_SENDING') || 'NO',
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
  const sheet = book.getSheetByName(TAB_APPROVAL_QUEUE);
  if (!sheet) {
    return { leads: [], total: 0, page: 1, pageSize: pageSize, statuses: {} };
  }

  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) {
    return { leads: [], total: 0, page: 1, pageSize: pageSize, statuses: {} };
  }

  const headers = rows[0].map(h => normalizeKey(h));
  const statusCounts = { ALL: 0, AWAITING_REVIEW: 0, NEEDS_RESEARCH: 0, APPROVED: 0, REJECTED: 0, SENT: 0, OTHER: 0 };

  const allLeads = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const item = {};
    headers.forEach((h, colIdx) => {
      item[h] = row[colIdx];
    });

    const st = normalizeKey(item.status);
    const app = normalizeKey(item.approval);
    
    // Normalize status bucket for counter
    statusCounts.ALL++;
    if (st === 'awaiting_review' || (st === 'qualified' && app === 'pending')) {
      statusCounts.AWAITING_REVIEW++;
    } else if (st === 'needs_research') {
      statusCounts.NEEDS_RESEARCH++;
    } else if (st === 'approved' || app === 'approved') {
      statusCounts.APPROVED++;
    } else if (st === 'rejected' || app === 'rejected') {
      statusCounts.REJECTED++;
    } else if (st === 'sent') {
      statusCounts.SENT++;
    } else {
      statusCounts.OTHER++;
    }

    // Filter by status
    if (statusFilter !== 'all') {
      if (statusFilter === 'awaiting_review' && st !== 'awaiting_review') continue;
      if (statusFilter === 'needs_research' && st !== 'needs_research') continue;
      if (statusFilter === 'approved' && st !== 'approved' && app !== 'approved') continue;
      if (statusFilter === 'rejected' && st !== 'rejected' && app !== 'rejected') continue;
      if (statusFilter === 'sent' && st !== 'sent') continue;
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

    // Compute live compliance indicator
    const body = String(item.email_body || '').trim();
    const wordCount = body ? body.split(/\s+/).length : 0;
    const paragraphs = body ? body.split(/\n\s*\n/).filter(p => p.trim().length > 0).length : 0;
    const hasProof = body.includes(String(item.proof_line || 'Our team designed and built the OneFolk website.'));
    
    item.computed_word_count = wordCount;
    item.computed_paragraphs = paragraphs;
    item.is_compliant = (wordCount > 0 && wordCount < 70 && paragraphs === 3 && hasProof);

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
  const sheet = book.getSheetByName(TAB_APPROVAL_QUEUE);
  if (!sheet) throw new Error('Approval Queue sheet missing');

  const rows = sheet.getDataRange().getValues();
  const headers = rows[0].map(h => normalizeKey(h));
  const leadIdCol = headers.indexOf('lead_id');

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][leadIdCol]).trim() === String(leadId).trim()) {
      const record = {};
      headers.forEach((h, col) => {
        record[h] = rows[i][col];
      });
      
      // Calculate validation errors if any
      const body = String(record.email_body || '').trim();
      const words = body ? body.split(/\s+/).length : 0;
      const paras = body ? body.split(/\n\s*\n/).filter(p => p.trim().length > 0) : [];
      const proofLine = String(record.proof_line || 'Our team designed and built the OneFolk website.').trim();

      const validationErrors = [];
      if (!record.subject || !record.subject.trim()) {
        validationErrors.push('Subject line is missing.');
      }
      if (paras.length !== 3) {
        validationErrors.push('Email body must have exactly 3 paragraphs (found ' + paras.length + ').');
      }
      if (words >= 70) {
        validationErrors.push('Email body must be fewer than 70 words (currently ' + words + ').');
      }
      if (!body.includes(proofLine)) {
        validationErrors.push('Email body must contain the exact truthful OneFolk proof line.');
      }
      if (!record.public_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.public_email)) {
        validationErrors.push('Recipient email is invalid or missing.');
      }

      record.validationErrors = validationErrors;
      record.isValidDraft = validationErrors.length === 0;
      record.wordCount = words;
      record.paragraphCount = paras.length;
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

  // Validate strict requirements
  const words = emailBody.split(/\s+/).length;
  const paras = emailBody.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  if (paras.length !== 3) {
    throw new Error('Draft must contain exactly 3 paragraphs. Found ' + paras.length + '.');
  }
  if (words >= 70) {
    throw new Error('Draft must be fewer than 70 words. Found ' + words + '.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const book = getSpreadsheet();
    const sheet = book.getSheetByName(TAB_APPROVAL_QUEUE);
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

    // Ensure proof line is preserved
    const proofLine = String(existingRecord.proof_line || 'Our team designed and built the OneFolk website.').trim();
    if (!emailBody.includes(proofLine)) {
      throw new Error('Draft must include the truthful OneFolk proof line: "' + proofLine + '"');
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
    const sheet = book.getSheetByName(TAB_APPROVAL_QUEUE);
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
      if (subjectCol !== -1) sheet.getRange(targetRow, subjectCol + 1).setValue(sanitizeCellValue(r.subject));
    }
    if (editedBody && editedBody.trim()) {
      r.email_body = editedBody.trim();
      if (bodyCol !== -1) sheet.getRange(targetRow, bodyCol + 1).setValue(sanitizeCellValue(r.email_body));
      const w = r.email_body.split(/\s+/).length;
      r.word_count = w;
      if (wordCountCol !== -1) sheet.getRange(targetRow, wordCountCol + 1).setValue(w);
    }

    // Check suppression
    const blocked = buildSuppressionSet();
    const email = normalizeKey(r.public_email);
    const domain = extractDomain(r.website);
    if (blocked.has(email) || (domain && blocked.has(domain))) {
      throw new Error('Approval blocked: Recipient email or domain is on the Suppression List.');
    }

    // Strict validation
    const body = String(r.email_body || '').trim();
    const words = body ? body.split(/\s+/).length : 0;
    const paras = body ? body.split(/\n\s*\n/).filter(p => p.trim().length > 0) : [];
    const proofLine = String(r.proof_line || 'Our team designed and built the OneFolk website.').trim();

    if (paras.length !== 3) {
      throw new Error('Draft must contain exactly 3 paragraphs (found ' + paras.length + ').');
    }
    if (words >= 70) {
      throw new Error('Draft must be fewer than 70 words (found ' + words + ').');
    }
    if (!body.includes(proofLine)) {
      throw new Error('Draft must include the truthful proof line: "' + proofLine + '"');
    }

    // Set qualification requirements for reviewableRecord check
    if (!r.qualification_status) r.qualification_status = 'QUALIFIED';
    if (!r.proof_verified) r.proof_verified = 'YES';
    if (!r.mail_domain_status) r.mail_domain_status = 'MX_VALID_MAILBOX_UNCONFIRMED';
    if (!r.proof_project) r.proof_project = 'OneFolk website';
    if (!r.proof_url) r.proof_url = 'https://onefolk.in/work';

    // Compute fingerprint
    const fingerprint = draftFingerprint(r);
    setProp('APPROVAL_' + leadId, fingerprint);

    // Write approval keys
    if (statusCol !== -1) sheet.getRange(targetRow, statusCol + 1).setValue('APPROVED');
    if (approvalCol !== -1) sheet.getRange(targetRow, approvalCol + 1).setValue('APPROVED');
    if (notesCol !== -1) {
      sheet.getRange(targetRow, notesCol + 1).setValue('Approved via OneFolk Dashboard by ' + userEmail);
    }
    if (updatedCol !== -1) {
      sheet.getRange(targetRow, updatedCol + 1).setValue(new Date().toISOString());
    }

    // Record audit trail
    recordAuditEntry(leadId, userEmail, 'APPROVED', fingerprint);

    return {
      success: true,
      lead_id: leadId,
      fingerprint: fingerprint,
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
    const sheet = book.getSheetByName(TAB_APPROVAL_QUEUE);
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
 * Marks a lead as NEEDS_RESEARCH.
 */
function apiMarkNeedsResearch(leadId, note) {
  const userEmail = assertAuthorizedAdmin();
  if (!leadId) throw new Error('lead_id is required');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const book = getSpreadsheet();
    const sheet = book.getSheetByName(TAB_APPROVAL_QUEUE);
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
      item[h] = rows[i][col];
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
  const activitySheet = book.getSheetByName(TAB_EMAIL_ACTIVITY);
  const sentSheet = book.getSheetByName(TAB_HISTORICAL_SENT);

  const activities = [];

  // 1. From Email Activity tab
  if (activitySheet) {
    const rows = activitySheet.getDataRange().getValues();
    if (rows.length > 1) {
      const headers = rows[0].map(h => normalizeKey(h));
      for (let i = rows.length - 1; i >= 1; i--) {
        const item = {};
        headers.forEach((h, col) => { item[h] = rows[i][col]; });
        item.source_tab = 'Email Activity';
        activities.push(item);
      }
    }
  }

  // 2. From historical Sent Emails tab
  if (sentSheet) {
    const rows = sentSheet.getDataRange().getValues();
    if (rows.length > 1) {
      const headers = rows[0].map(h => normalizeKey(h));
      for (let i = rows.length - 1; i >= 1; i--) {
        const item = {
          sent_at: rows[i][0],
          recipient_email: rows[i][1],
          subject: rows[i][2],
          campaign: rows[i][3],
          status: rows[i][4],
          reply_status: rows[i][5],
          gmail_thread_id: rows[i][6],
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
  const mailQuota = MailApp.getRemainingDailyQuota();
  const dailySentToday = getDailySendCount();
  const sendingLock = IMPLEMENTATION_SENDING_LOCK;
  const enableSending = getProp('ENABLE_SENDING') || 'NO';

  let snapshot = {};
  try {
    snapshot = automationSnapshot();
  } catch (err) {
    snapshot = { error: String(err) };
  }

  const triggers = ScriptApp.getProjectTriggers().map(t => ({
    handler: t.getHandlerFunction(),
    type: t.getEventType().toString()
  }));

  return {
    userEmail: userEmail,
    authorizedAdmins: getAuthorizedAdmins(),
    quotas: {
      mailAppRemainingQuota: mailQuota,
      dailySendsToday: dailySentToday,
      maxDailyRecipients: MAX_DAILY_RECIPIENTS,
      groqTier: 'Groq Free Tier (llama-3.3-70b-versatile / 30 requests per batch)',
      runnerMinutesLimit: '1,500 mins/mo free tier (Soft limit 1,200 mins)'
    },
    safetyGates: {
      implementationLockActive: sendingLock,
      enableSendingValue: enableSending,
      liveDispatchActive: !sendingLock && enableSending === 'YES',
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
