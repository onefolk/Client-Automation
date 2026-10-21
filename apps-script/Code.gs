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
      if (email) set.add(email);
    }
  }

  return set;
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
  if (wordCount > 70) return false;

  // Exactly 3 paragraphs
  const paragraphs = body.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  if (paragraphs.length !== 3) return false;

  return true;
}

/**
 * Core Approved Sender: Dispatches up to daily budget through authorized Gmail.
 */
function approvedSender() {
  const isEnabled = getProp('ENABLE_SENDING') === 'YES';
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
      queueSheet.getRange(rowIdx, headerMap.status + 1).setValue('SENDING');
      SpreadsheetApp.flush();

      try {
        const fullBody = String(v[headerMap.email_body]).trim() +
          '\n\nRegards,\nTeam OneFolk\nhttps://onefolk.in/work';
        const subject = String(v[headerMap.subject]).trim();

        // Dispatch via Gmail
        GmailApp.sendEmail(email, subject, fullBody, {
          name: 'Team OneFolk'
        });

        // Record successful dispatch
        incrementDailySendCount();
        remainingBudget--;
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
            'DISPATCHED_GMAIL_APP',
            '',
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
    if (['sent', 'sending', 'send_review'].includes(st)) {
      const email = normalizeKey(rows[i][emailCol]);
      if (email) sentMap.set(email, i + 1);
    }
  }

  if (sentMap.size === 0) return;

  // Search recent inbox threads
  const threads = GmailApp.search('in:inbox newer_than:7d', 0, 100);
  for (const thread of threads) {
    for (const msg of thread.getMessages()) {
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
}

/**
 * 9 AM Morning Outreach Queue Notification.
 * Delivers an idempotent morning digest to the reviewer's inbox via GmailApp/MailApp.
 */
function sendMorningQueueDigest() {
  const dateStr = getISTDateString();
  const dateKey = 'DIGEST_SENT_' + dateStr;

  // 1. Idempotency Check: Deliver only once per calendar date
  if (getProp(dateKey) === 'YES') {
    Logger.log(`Morning queue digest already delivered for date ${dateStr}. Skipping duplicate send.`);
    return { status: 'SKIPPED_ALREADY_SENT', date: dateStr };
  }

  const book = getSpreadsheet();
  const sheetId = book.getId();
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;

  // 2. Read Approval Queue
  const queueSheet = book.getSheetByName(TAB_APPROVAL_QUEUE) || book.getSheetByName(TAB_LEGACY_QUEUE);
  let readyDrafts = 0;
  let approvedCount = 0;
  let sentCount = 0;
  let rejectedCount = 0;

  if (queueSheet) {
    const data = queueSheet.getDataRange().getValues();
    if (data.length > 1) {
      const headers = data[0].map(h => normalizeKey(h));
      const statusCol = headers.indexOf('status');
      const emailCol = headers.indexOf('public_email');
      const bodyCol = headers.indexOf('email_body');

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const st = normalizeKey(row[statusCol]);
        const email = String(row[emailCol] || '').trim();
        const body = String(row[bodyCol] || '').trim();

        if (st === 'approved') {
          approvedCount++;
        } else if (st === 'sent') {
          sentCount++;
        } else if (st === 'rejected' || st === 'declined') {
          rejectedCount++;
        } else if ((st === 'drafted' || st === 'awaiting_review') && email && body) {
          readyDrafts++;
        }
      }
    }
  }

  // 3. Read Dashboard for Campaign Failures & Quota
  const dashSheet = book.getSheetByName(TAB_DASHBOARD);
  let groqUsage = '0 calls';
  if (dashSheet) {
    const dashData = dashSheet.getDataRange().getValues();
    for (let i = 0; i < dashData.length; i++) {
      const label = String(dashData[i][0] || '').toLowerCase();
      if (label.indexOf('groq') !== -1) {
        groqUsage = String(dashData[i][1] || '0 calls');
      }
    }
  }

  const targetQueue = 50;
  const shortage = Math.max(0, targetQueue - readyDrafts);
  const isTargetAchieved = readyDrafts >= targetQueue;

  // 4. Formulate Rich HTML Notification Email
  const recipient = getProp('NOTIFICATION_EMAIL') || Session.getEffectiveUser().getEmail() || 'contact.onefolk@gmail.com';
  const subject = `[OneFolk 9 AM Queue] ${readyDrafts}/${targetQueue} Leads Ready for Approval (${dateStr})`;

  const statusColor = isTargetAchieved ? '#0F9D58' : '#F4B400';
  const statusHeadline = isTargetAchieved
    ? 'All 50 Qualified Leads Ready for Human Review'
    : `Queue Shortfall Alert: ${readyDrafts} of ${targetQueue} Ready`;

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937; line-height: 1.5;">
      <div style="background-color: ${statusColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 20px;">OneFolk 9 AM Outreach Queue</h2>
        <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.95;">${statusHeadline} | Date: ${dateStr}</p>
      </div>

      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; background-color: #ffffff;">
        <p style="font-size: 15px; margin-top: 0;">Good morning! The automated overnight research pipeline has completed. Here is your outreach summary:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background-color: #f9fafb; border-bottom: 2px solid #e5e7eb;">
            <th style="padding: 10px; text-align: left; font-size: 13px; color: #4b5563;">Metric</th>
            <th style="padding: 10px; text-align: right; font-size: 13px; color: #4b5563;">Count</th>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 10px; font-weight: 600; color: #111827;">Ready for Human Approval at 9 AM</td>
            <td style="padding: 10px; text-align: right; font-weight: bold; color: ${statusColor}; font-size: 16px;">${readyDrafts}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 10px; color: #4b5563;">Target Queue Size</td>
            <td style="padding: 10px; text-align: right; color: #111827;">${targetQueue}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 10px; color: #4b5563;">Queue Shortage</td>
            <td style="padding: 10px; text-align: right; color: ${shortage > 0 ? '#DC2626' : '#059669'};">${shortage}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 10px; color: #4b5563;">Already Approved / In Transit</td>
            <td style="padding: 10px; text-align: right; color: #111827;">${approvedCount}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 10px; color: #4b5563;">Dispatched Historically</td>
            <td style="padding: 10px; text-align: right; color: #111827;">${sentCount}</td>
          </tr>
          <tr>
            <td style="padding: 10px; color: #4b5563;">Groq API Calls Used</td>
            <td style="padding: 10px; text-align: right; color: #111827;">${groqUsage}</td>
          </tr>
        </table>

        ${shortage > 0 ? `
          <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px; margin-bottom: 20px; font-size: 13px; color: #92400E;">
            <strong>Shortage Notice:</strong> ${shortage} leads below target. No leads were fabricated to artificially fill the queue. Only genuinely qualified institutions with verified business emails are presented.
          </div>
        ` : ''}

        <div style="text-align: center; margin: 30px 0;">
          <a href="${sheetUrl}" style="background-color: #2563EB; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
            Open Master Approval Queue Sheet
          </a>
        </div>

        <div style="background-color: #F3F4F6; padding: 14px; border-radius: 6px; font-size: 12px; color: #4B5563;">
          <strong>Review Instructions:</strong>
          <ul style="margin: 6px 0 0 0; padding-left: 20px;">
            <li>Review the draft in the <strong>Approval Queue</strong> tab.</li>
            <li>To authorize dispatch for the 1:00 PM IST sending window, set <code>status = APPROVED</code> and <code>approval = APPROVED</code>.</li>
            <li>Rejected drafts marked <code>REJECTED</code> will remain permanently unsent.</li>
            <li><strong>Safety Guarantee:</strong> Live Gmail sending remains strictly locked until dual approval and ENABLE_SENDING=YES.</li>
          </ul>
        </div>
      </div>
    </div>
  `;

  // 5. Send Notification via GmailApp or MailApp
  try {
    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      htmlBody: htmlBody
    });
    setProp(dateKey, 'YES');
    Logger.log(`Successfully sent morning queue digest to ${recipient} for ${dateStr}`);
    return { status: 'DELIVERED', recipient: recipient, date: dateStr, readyDrafts: readyDrafts };
  } catch (err) {
    Logger.log(`Failed to send morning queue digest: ${err}`);
    return { status: 'ERROR', error: String(err) };
  }
}

/**
 * Trigger installation utility.
 */
function installTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    const fn = t.getHandlerFunction();
    if (fn === 'approvedSender' || fn === 'monitorReplies' || fn === 'sendMorningQueueDigest') {
      ScriptApp.deleteTrigger(t);
    }
  }

  // Morning 9 AM digest (runs at 8:45 AM IST every morning)
  ScriptApp.newTrigger('sendMorningQueueDigest')
    .timeBased()
    .atHour(8)
    .nearMinute(45)
    .everyDays(1)
    .inTimezone(IST_TIMEZONE)
    .create();

  // Sender runs hourly
  ScriptApp.newTrigger('approvedSender')
    .timeBased()
    .everyHours(1)
    .create();

  // Monitor runs every 2 hours
  ScriptApp.newTrigger('monitorReplies')
    .timeBased()
    .everyHours(2)
    .create();

  Logger.log('Triggers successfully installed. Sending remains OFF until ENABLE_SENDING=YES.');
}

/**
 * Emergency stop utility.
 */
function emergencyStop() {
  setProp('ENABLE_SENDING', 'NO');
  Logger.log('EMERGENCY STOP ACTIVATED: ENABLE_SENDING set to NO.');
}
