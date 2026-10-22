/**
 * OneFolk Outreach Engine — Production Cloud Sender & Inbox Monitor
 * Bound Google Apps Script for Spreadsheet: 1U3JxQUcxSyqfZySnHNdLIwExtr3ikfcYlj0a3YY7ATM
 *
 * SAFETY GUARANTEES:
 * 1. Sending is strictly DISABLED by default (ENABLE_SENDING != 'YES').
 * 2. Requires double human authorization: 'status' == 'APPROVED' AND 'approval' == 'APPROVED'.
 * 3. Hard cap of 50 recipients per Indian Standard Time (IST) calendar day.
 * 4. Multi-tab synchronization: Approval Queue, Email Activity, Suppression List, Dashboard.
 * 5. Atomic reservation state (SENDING) to prevent duplicate sends upon provider timeout.
 * 6. Emergency halt upon consecutive transmission errors.
 */

const TAB_APPROVAL_QUEUE = 'Approval Queue';
const TAB_LEGACY_QUEUE = 'Lead Queue';
const TAB_EMAIL_ACTIVITY = 'Email Activity';
const TAB_SUPPRESSION_LIST = 'Suppression List';
const TAB_HISTORICAL_SENT = 'Sent Emails';
const TAB_DASHBOARD = 'Dashboard';

const MAX_DAILY_RECIPIENTS = 50;
// Deployment interlock: remove only after separate explicit live-send authorization.
const IMPLEMENTATION_SENDING_LOCK = true;
const IST_TIMEZONE = 'Asia/Kolkata';

// Historical known bounces and explicit rejections
const HARD_SUPPRESSED = [
  'info@drkumudiniaestheticgynae.com',
  'team@studioamamumbai.com',
  'contact@amazeoneinteriors.com',
  'riointeriorsdesigner@gmail.com',
  'studioha@gmail.com',
  'hello@goristore.com',
  'info@arch4foundation.com',
  'dbs4mee@gmail.com'
];

function getProp(k) {
  return PropertiesService.getScriptProperties().getProperty(k) || '';
}

function setProp(k, v) {
  PropertiesService.getScriptProperties().setProperty(k, String(v));
}

function getSpreadsheet() {
  const id = getProp('SPREADSHEET_ID') || '1U3JxQUcxSyqfZySnHNdLIwExtr3ikfcYlj0a3YY7ATM';
  return SpreadsheetApp.openById(id);
}

function getISTDateString() {
  return Utilities.formatDate(new Date(), IST_TIMEZONE, 'yyyy-MM-dd');
}

function getDailySendCount() {
  const key = 'SENT_' + getISTDateString();
  return Number(getProp(key) || 0);
}

function incrementDailySendCount() {
  const key = 'SENT_' + getISTDateString();
  const current = getDailySendCount();
  setProp(key, current + 1);
}

function normalizeKey(str) {
  return String(str || '').trim().toLowerCase();
}

function extractDomain(urlOrEmail) {
  try {
    let s = String(urlOrEmail || '').trim().toLowerCase();
    if (s.indexOf('@') !== -1) {
      return s.split('@')[1];
    }
    s = s.replace(/^https?:\/\//, '').split('/')[0];
    return s.replace(/^www\./, '');
  } catch (e) {
    return '';
  }
}

/**
 * Builds the comprehensive suppression set from hardcoded rules,
 * Suppression List tab, and historical Sent Emails.
 */
function buildSuppressionSet() {
  const set = new Set(HARD_SUPPRESSED.map(normalizeKey));
  const book = getSpreadsheet();

  // 1. From Suppression List tab
  const suppSheet = book.getSheetByName(TAB_SUPPRESSION_LIST);
  if (suppSheet) {
    const data = suppSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const val = normalizeKey(data[i][2]); // value column
      if (val) {
        set.add(val);
        const dom = extractDomain(val);
        if (dom) set.add(dom);
      }
    }
  }

  // 2. From historical Sent Emails
  const sentSheet = book.getSheetByName(TAB_HISTORICAL_SENT);
  if (sentSheet) {
    const data = sentSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const email = normalizeKey(data[i][1]); // recipient email
      if (email) { set.add(email); set.add(extractDomain(email)); }
    }
  }

  for (const tab of [TAB_APPROVAL_QUEUE, TAB_EMAIL_ACTIVITY]) {
    const sheet = book.getSheetByName(tab);
    if (!sheet) throw new Error('Required safety tab missing: ' + tab);
    const values = sheet.getDataRange().getValues();
    const h = values[0].map(normalizeKey);
    for (const row of values.slice(1)) {
      const st = normalizeKey(row[h.indexOf('status')]);
      if (tab === TAB_EMAIL_ACTIVITY || ['sent','sending','send_review','bounced','declined','unsubscribed','rejected','positive_reply','reply_review','suppressed'].includes(st)) {
        const email = normalizeKey(row[h.indexOf(tab === TAB_EMAIL_ACTIVITY ? 'recipient_email' : 'public_email')]);
        if (email) { set.add(email); set.add(extractDomain(email)); }
      }
    }
  }
  if (!suppSheet || !sentSheet) throw new Error('Suppression/history unavailable');
  return set;
}

/**
 * Formats outreach emails with strict paragraph spacing, greeting, and signature.
 * Generates both clean plainText and HTML representation for high-fidelity rendering.
 */
function formatOneFolkEmail(rawBody, businessName) {
  const raw = String(rawBody || '').trim();
  const paras = raw
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const biz = businessName || 'Prospect';
  const hasSalutation = paras.length > 0 && /^dear\b/i.test(paras[0]);
  
  const salutation = hasSalutation ? paras[0] : `Dear ${biz} Team,`;
  let contentParas = hasSalutation ? paras.slice(1) : paras;

  // Filter out any duplicate footer lines if previously embedded
  contentParas = contentParas.filter(p => 
    !/^work:\s*https?:\/\//i.test(p) && 
    !/^regards,/i.test(p) && 
    !/^team onefolk/i.test(p) && 
    !/^https?:\/\/onefolk\.in\/?$/i.test(p)
  );

  const plainText = [
    salutation,
    '',
    contentParas.join('\n\n'),
    '',
    'Work: https://onefolk.in/work',
    '',
    'Regards,',
    'Team OneFolk',
    'https://onefolk.in/'
  ].join('\n');

  const escapeHtml = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const htmlBody = [
    '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; font-size: 14.5px; line-height: 1.65; color: #1C1B18; max-width: 600px;">',
    `  <p style="margin: 0 0 16px 0; font-weight: 500;">${escapeHtml(salutation)}</p>`,
    contentParas.map(p => `  <p style="margin: 0 0 16px 0; line-height: 1.65;">${escapeHtml(p)}</p>`).join('\n'),
    '  <p style="margin: 20px 0 14px 0; color: #4A4843;">Work: <a href="https://onefolk.in/work" style="color: #1C1B18; text-decoration: underline;">https://onefolk.in/work</a></p>',
    '  <p style="margin: 14px 0 0 0; line-height: 1.5; color: #1C1B18;">Regards,<br><strong>Team OneFolk</strong><br><a href="https://onefolk.in/" style="color: #1C1B18; text-decoration: underline;">https://onefolk.in/</a></p>',
    '</div>'
  ].join('\n');

  return { plainText, htmlBody };
}

/**
 * Validates strict formatting and human approval requirements.
 */
function isValidApprovedDraft(v, headerMap) {
  const email = normalizeKey(v[headerMap.public_email]);
  const status = normalizeKey(v[headerMap.status]);
  const approval = normalizeKey(v[headerMap.approval]);
  const subject = String(v[headerMap.subject] || '').trim();
  const body = String(v[headerMap.email_body] || '').trim();
  const proofLine = String(v[headerMap.proof_line] || '').trim();

  // Strict email syntax
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;

  // Explicit dual human approval
  if (status !== 'approved' || approval !== 'approved') return false;

  // Content requirements
  if (!subject || !body || !proofLine) return false;

  // Maximum 70 words in body
  const wordCount = body.trim().split(/\s+/).length;
  if (wordCount >= 70) return false;

  // Exactly 3 paragraphs
  const paragraphs = body.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  if (paragraphs.length !== 3) return false;

  const record = Object.fromEntries(Object.keys(headerMap).map(k => [k, v[headerMap[k]]]));
  if (!reviewableRecord(record)) return false;
  if (getProp('APPROVAL_' + record.lead_id) !== draftFingerprint(record)) return false;
  return true;
}

/**
 * Core Approved Sender: Dispatches up to daily budget through authorized Gmail.
 */
function approvedSender() {
  const isEnabled = !IMPLEMENTATION_SENDING_LOCK && getProp('ENABLE_SENDING') === 'YES';
  if (!isEnabled) {
    Logger.log('DRY RUN: Sending is disabled. Set ENABLE_SENDING=YES in Script Properties to activate.');
    return;
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    Logger.log('Could not acquire lock; sender is already running.');
    return;
  }

  try {
    const book = getSpreadsheet();
    let queueSheet = book.getSheetByName(TAB_APPROVAL_QUEUE);
    if (!queueSheet) {
      queueSheet = book.getSheetByName(TAB_LEGACY_QUEUE);
    }
    if (!queueSheet) {
      Logger.log('No Approval Queue found.');
      return;
    }

    const activitySheet = book.getSheetByName(TAB_EMAIL_ACTIVITY);
    const blocked = buildSuppressionSet();
    const usedToday = getDailySendCount();
    const mailQuota = MailApp.getRemainingDailyQuota();
    let remainingBudget = Math.min(MAX_DAILY_RECIPIENTS - usedToday, mailQuota);

    if (remainingBudget <= 0) {
      Logger.log(`Daily send limit reached (Used: ${usedToday}/${MAX_DAILY_RECIPIENTS}, MailApp Quota: ${mailQuota})`);
      return;
    }

    const rows = queueSheet.getDataRange().getValues();
    if (rows.length <= 1) return;

    // Map column headers dynamically
    const headers = rows[0].map(h => normalizeKey(h));
    const headerMap = {
      lead_id: headers.indexOf('lead_id'),
      business: headers.indexOf('business'),
      public_email: headers.indexOf('public_email'),
      website: headers.indexOf('website'),
      subject: headers.indexOf('subject'),
      email_body: headers.indexOf('email_body'),
      proof_line: headers.indexOf('proof_line'),
      status: headers.indexOf('status'),
      approval: headers.indexOf('approval'),
      notes: headers.indexOf('reviewer_notes') !== -1 ? headers.indexOf('reviewer_notes') : headers.indexOf('notes'),
      updated_at: headers.indexOf('updated_at'),
    };

    headers.forEach((h, i) => { headerMap[h] = i; });
    let consecutiveErrors = 0;
    const dispatchedInBatch = new Set();

    for (let i = 1; i < rows.length; i++) {
      if (remainingBudget <= 0 || consecutiveErrors >= 2) break;

      const rowIdx = i + 1;
      const v = rows[i];
      const email = normalizeKey(v[headerMap.public_email]);
      const dom = extractDomain(v[headerMap.website]);
      const leadId = String(v[headerMap.lead_id] || '');

      // Re-check suppression and batch uniqueness
      if (blocked.has(email) || (dom && blocked.has(dom)) || dispatchedInBatch.has(email)) {
        continue;
      }

      if (!isValidApprovedDraft(v, headerMap)) {
        continue;
      }

      // Transition to atomic SENDING state
      dispatchedInBatch.add(email);
      blocked.add(dom);
      incrementDailySendCount(); // Reserve quota BEFORE the external side effect; ambiguous sends consume budget.
      remainingBudget--;
      queueSheet.getRange(rowIdx, headerMap.status + 1).setValue('SENDING');
      SpreadsheetApp.flush();

      try {
        const formatted = formatOneFolkEmail(v[headerMap.email_body], v[headerMap.business]);
        const subject = String(v[headerMap.subject]).trim();

        // Dispatch via Gmail with proper paragraph spacing, HTML structure, and plaintext fallback
        const message = GmailApp.createDraft(email, subject, formatted.plainText, {
          name: 'Team OneFolk',
          htmlBody: formatted.htmlBody
        }).send();

        // Record successful dispatch
        blocked.add(email);
        consecutiveErrors = 0;

        const now = new Date();
        queueSheet.getRange(rowIdx, headerMap.status + 1).setValue('SENT');
        if (headerMap.notes !== -1) {
          queueSheet.getRange(rowIdx, headerMap.notes + 1).setValue('Dispatched via GmailApp');
        }
        if (headerMap.updated_at !== -1) {
          queueSheet.getRange(rowIdx, headerMap.updated_at + 1).setValue(now);
        }

        // Append to Email Activity
        if (activitySheet) {
          const actId = 'act_' + Math.floor(Math.random() * 1000000);
          activitySheet.appendRow([
            actId,
            leadId,
            v[headerMap.business],
            email,
            subject,
            'SENT',
            now,
            message.getId(),
            message.getThread().getId(),
            'NONE',
            '',
            '',
            'Sent successfully',
            now
          ]);
        }

        Utilities.sleep(1500); // Polite rate control delay
      } catch (err) {
        consecutiveErrors++;
        const errMsg = String(err).slice(0, 300);
        Logger.log(`Failed sending to ${email}: ${errMsg}`);
        queueSheet.getRange(rowIdx, headerMap.status + 1).setValue('SEND_REVIEW');
        if (headerMap.notes !== -1) {
          queueSheet.getRange(rowIdx, headerMap.notes + 1).setValue('Send failure: ' + errMsg);
        }
      }
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * Scheduled Reply and Bounce Monitoring.
 */
function monitorReplies() {
  const lock=LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try { monitorRepliesLocked(); } finally { lock.releaseLock(); }
}

function monitorRepliesLocked() {
  const book = getSpreadsheet();
  let queueSheet = book.getSheetByName(TAB_APPROVAL_QUEUE) || book.getSheetByName(TAB_LEGACY_QUEUE);
  const suppSheet = book.getSheetByName(TAB_SUPPRESSION_LIST);
  const activitySheet = book.getSheetByName(TAB_EMAIL_ACTIVITY);

  if (!queueSheet) return;

  const rows = queueSheet.getDataRange().getValues();
  if (rows.length <= 1) return;

  const headers = rows[0].map(h => normalizeKey(h));
  const emailCol = headers.indexOf('public_email');
  const statusCol = headers.indexOf('status');
  const notesCol = headers.indexOf('reviewer_notes') !== -1 ? headers.indexOf('reviewer_notes') : headers.indexOf('notes');

  const sentMap = new Map();
  for (let i = 1; i < rows.length; i++) {
    const st = normalizeKey(rows[i][statusCol]);
    if (['sent', 'sending', 'send_review', 'positive_reply', 'reply_review'].includes(st)) {
      const email = normalizeKey(rows[i][emailCol]);
      if (email) sentMap.set(email, i + 1);
    }
  }

  if (sentMap.size === 0) return;

  // Search recent inbox threads
  const page = Number(getProp('INBOX_PAGE') || 0);
  const threads = GmailApp.search('in:anywhere -in:sent newer_than:14d', page, 100);
  const processed = new Set(JSON.parse(getProp('PROCESSED_MESSAGES') || '[]'));
  for (const thread of threads) {
    for (const msg of thread.getMessages()) {
      if (processed.has(msg.getId())) continue;
      processed.add(msg.getId());
      const fromHeader = String(msg.getFrom() || '');
      const match = fromHeader.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      const sender = match ? normalizeKey(match[0]) : '';
      const subject = String(msg.getSubject() || '');
      const body = msg.getPlainBody().slice(0, 1500);

      // 1. Check direct replies from recipients
      if (sender && sentMap.has(sender)) {
        const rowIdx = sentMap.get(sender);
        const isDeclined = /not interested|unsubscribe|remove me|please remove|do not contact|stop/i.test(body);
        const isPositive = /schedule|meeting|call|discuss (?:further|details|options|project)|interested|rates|quote|pricing|price|portfolio/i.test(body);

        const newStatus = isDeclined ? 'DECLINED' : (isPositive ? 'POSITIVE_REPLY' : 'REPLY_REVIEW');
        queueSheet.getRange(rowIdx, statusCol + 1).setValue(newStatus);
        recordReplyActivity(activitySheet, sender, newStatus, thread, msg);
        if (isDeclined) sentMap.delete(sender);
        if (notesCol !== -1) {
          queueSheet.getRange(rowIdx, notesCol + 1).setValue(`Reply received (${newStatus}): ${body.slice(0, 120)}`);
        }

        // Add to suppression if declined/opted-out
        if (isDeclined && suppSheet) {
          suppSheet.appendRow([
            'sup_' + Math.floor(Math.random() * 1000000),
            'EMAIL',
            sender,
            'DECLINED_INBOX_REPLY',
            'apps_script_monitor',
            new Date().toISOString()
          ]);
        }
      }

      // 2. Check delivery failure notices (bounces)
      if (/delivery status notification|undelivered mail|failure notice/i.test(subject)) {
        const bounceMatch = body.match(/(?:Final-Recipient:\s*rfc822;\s*|couldn't be delivered to\s*|wasn't delivered to\s*)([\w.+-]+@[\w.-]+)/i);
        if (bounceMatch) {
          const bouncedEmail = normalizeKey(bounceMatch[1]);
          if (sentMap.has(bouncedEmail)) {
            const rowIdx = sentMap.get(bouncedEmail);
            queueSheet.getRange(rowIdx, statusCol + 1).setValue('BOUNCED');
            recordReplyActivity(activitySheet, bouncedEmail, 'BOUNCED', thread, msg);
            sentMap.delete(bouncedEmail);
            if (notesCol !== -1) {
              queueSheet.getRange(rowIdx, notesCol + 1).setValue('Delivery failure notice detected in inbox');
            }
            if (suppSheet) {
              suppSheet.appendRow([
                'sup_' + Math.floor(Math.random() * 1000000),
                'EMAIL',
                bouncedEmail,
                'BOUNCED_DELIVERY_FAILURE',
                'apps_script_monitor',
                new Date().toISOString()
              ]);
            }
          }
        }
      }
    }
  }
  setProp('INBOX_PAGE', threads.length === 100 ? page + 100 : 0);
  setProp('PROCESSED_MESSAGES', JSON.stringify(Array.from(processed).slice(-250)));
}

/**
 * Emergency stop utility.
 */
function emergencyStop() {
  setProp('ENABLE_SENDING', 'NO');
  Logger.log('EMERGENCY STOP ACTIVATED: ENABLE_SENDING set to NO.');
}
