/**
 * Test Suite: OneFolk Web Dashboard & Apps Script Backend Engine
 * Tests authentication, RBAC, API endpoints, email validation,
 * dual-key approvals, fingerprinting, and concurrency locks in Node.js VM.
 */

const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

console.log('=== RUNNING ONEFOLK WEB DASHBOARD TEST SUITE ===\n');

// 1. Build Mock Apps Script Environment
const scriptProps = new Map();
scriptProps.set('SPREADSHEET_ID', '1U3JxQUcxSyqfZySnHNdLIwExtr3ikfcYlj0a3YY7ATM');
scriptProps.set('ENABLE_SENDING', 'NO');
scriptProps.set('NOTIFICATION_EMAIL', 'contact.onefolk@gmail.com');
scriptProps.set('AUTHORIZED_ADMINS', 'team.onefolk@gmail.com,contact.onefolk@gmail.com,giridharane01@gmail.com');

let currentActiveUser = 'contact.onefolk@gmail.com';
let currentEffectiveUser = 'contact.onefolk@gmail.com';

// Mock Spreadsheet Data Store
const sheetStore = new Map();

function createMockSheet(name, headers, initialRows = []) {
  const rows = headers && headers.length ? [headers, ...initialRows] : [...initialRows];
  return {
    getName: () => name,
    getSheetId: () => 123456,
    getDataRange: () => ({
      getValues: () => rows.map(r => [...r])
    }),
    getRange: (rowIdx, colIdx) => ({
      setValue: (val) => {
        while (rows.length < rowIdx) rows.push(new Array((headers && headers.length) || 10).fill(''));
        rows[rowIdx - 1][colIdx - 1] = val;
      }
    }),
    appendRow: (rowArr) => {
      rows.push([...rowArr]);
    }
  };
}

const mockBook = {
  getUrl: () => 'https://docs.google.com/spreadsheets/d/1U3JxQUcxSyqfZySnHNdLIwExtr3ikfcYlj0a3YY7ATM/edit',
  getSheetByName: (name) => sheetStore.get(name) || null,
  insertSheet: (name) => {
    const s = createMockSheet(name, []);
    sheetStore.set(name, s);
    return s;
  }
};

// Populate default operational sheets
sheetStore.set('Approval Queue', createMockSheet('Approval Queue', [
  'lead_id', 'business', 'industry', 'website', 'public_email', 'subject', 'email_body',
  'alt_opening_1', 'alt_opening_2', 'observation', 'observation_url', 'proof_project',
  'proof_line', 'qualification_score', 'status', 'approval', 'reviewer_notes', 'created_at',
  'updated_at', 'city', 'source_url', 'email_source_url', 'qualification_status',
  'observation_type', 'opportunity', 'timestamp', 'company_id', 'last_verified_at',
  'mail_domain_status', 'verification_confidence', 'strict_grounding', 'proof_url',
  'proof_verified', 'word_count', 'campaign_date', 'source'
], [
  [
    'lead_test_01', 'Stella Maris College', 'education', 'https://stellamariscollege.edu.in/',
    'principal@stellamariscollege.edu.in', 'Simplify your application process',
    'Your site states: "Where do I submit completed forms".\n\nOur team designed and built the OneFolk website.\n\nWould online submission help your team?',
    'I noticed your admissions page answers physical submission.', 'Your prospectus details hardcopy form collection.',
    'Site states: "Where do I submit completed forms"', 'https://stellamariscollege.edu.in/',
    'OneFolk website', 'Our team designed and built the OneFolk website.', 100,
    'AWAITING_REVIEW', 'PENDING', '', new Date().toISOString(), new Date().toISOString(),
    'Chennai', 'https://stellamariscollege.edu.in/', 'https://stellamariscollege.edu.in/',
    'QUALIFIED', 'form_inquiry', 'Online form submission workflow', new Date().toISOString(),
    'company_smc_01', new Date().toISOString(), 'MX_VALID_MAILBOX_UNCONFIRMED',
    'Public website + syntax + MX', true, 'https://onefolk.in/work', 'YES', 32, '2026-10-22', 'directory'
  ]
]));

sheetStore.set('Dashboard', createMockSheet('Dashboard', ['Metric', 'Value', 'Notes'], [
  ['Prospects discovered', '50', 'Harvested'],
  ['Qualified leads', '50', 'Scored'],
  ['Emails drafted', '50', 'In queue'],
  ['Emails approved', '0', 'Ready'],
  ['Emails sent', '0', 'Dispatched'],
  ['Sales calls booked', '0', 'Pipeline']
]));

sheetStore.set('Suppression List', createMockSheet('Suppression List', [
  'suppression_id', 'type', 'value', 'reason', 'source', 'added_at'
], [
  ['sup_1', 'EMAIL', 'banned@suppressed.com', 'Opt-out', 'manual', new Date().toISOString()]
]));

sheetStore.set('Sent Emails', createMockSheet('Sent Emails', [
  'Date (IST)', 'Recipient', 'Subject', 'Campaign', 'Delivery', 'Reply', 'Gmail ID'
]));

sheetStore.set('Email Activity', createMockSheet('Email Activity', [
  'activity_id', 'lead_id', 'business', 'recipient_email', 'subject', 'status',
  'sent_at', 'gmail_message_id', 'gmail_thread_id', 'reply_status', 'reply_snippet',
  'bounce_reason', 'notes', 'updated_at'
]));

sheetStore.set('Campaign Runs', createMockSheet('Campaign Runs', [
  'run_id', 'campaign_name', 'start_time', 'end_time', 'duration_seconds',
  'prospects_discovered', 'prospects_scraped', 'qualified_leads', 'needs_research',
  'emails_drafted', 'ai_calls_used', 'http_fetches_used', 'cost_incurred', 'status',
  'campaign_date', 'trigger', 'workflow_url', 'newly_discovered_today', 'qualified_overnight',
  'api_failures', 'ready_for_approval', 'rejected', 'suppressed_or_duplicate',
  'shortage_reasons', 'target_queue', 'runner_minutes_reserved_month', 'drawn_from_backlog',
  'reserve_qualified', 'shortage'
], [
  [
    'run_overnight_1001', 'Overnight Batch', new Date().toISOString(), new Date().toISOString(), 120,
    10, 10, 5, 5, 5, 5, 20, 0, 'SHORTFALL', '2026-10-22', 'schedule', 'https://github.com/run',
    5, 5, 0, 1, 0, 0, '["Insufficient fresh, evidenced drafts"]', 50, 42, 1, 0, 49
  ]
]));

sheetStore.set('Automation State', createMockSheet('Automation State', ['key', 'json', 'updated_at'], [
  ['health:last_success', JSON.stringify({ campaign_date: '2026-10-22', end_time: new Date().toISOString(), shortage_reasons: [] }), new Date().toISOString()],
  ['health:last_attempt', JSON.stringify({ status: 'SUCCESS' }), new Date().toISOString()]
]));

const mockContext = {
  console,
  Logger: { log: (...a) => console.log('  [GAS Logger]', ...a) },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (k) => scriptProps.get(k) || '',
      setProperty: (k, v) => scriptProps.set(k, String(v))
    })
  },
  Session: {
    getActiveUser: () => ({ getEmail: () => currentActiveUser }),
    getEffectiveUser: () => ({ getEmail: () => currentEffectiveUser })
  },
  SpreadsheetApp: {
    openById: () => mockBook,
    flush: () => {}
  },
  MailApp: {
    getRemainingDailyQuota: () => 100,
    sendEmail: () => {}
  },
  GmailApp: {
    createDraft: (recipient, subject, plainText, options) => ({
      send: () => ({
        getId: () => 'mock_msg_987654321',
        getThread: () => ({ getId: () => 'mock_thread_123456' })
      })
    }),
    search: () => []
  },
  LockService: {
    getScriptLock: () => ({
      tryLock: () => true,
      waitLock: () => true,
      releaseLock: () => {}
    })
  },
  Utilities: {
    formatDate: (d, tz, format) => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    },
    DigestAlgorithm: { SHA_256: 'sha256' },
    computeDigest: (_, s) => crypto.createHash('sha256').update(s).digest(),
    base64Encode: (b) => Buffer.from(b).toString('base64'),
    sleep: () => {}
  },
  HtmlService: {
    XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
    createTemplateFromFile: (f) => ({
      evaluate: () => ({
        setTitle: function() { return this; },
        setXFrameOptionsMode: function() { return this; },
        addMetaTag: function() { return this; },
        getContent: () => '<html>Mock Template Evaluated</html>'
      })
    }),
    createHtmlOutput: (html) => ({
      setTitle: function() { return this; },
      setXFrameOptionsMode: function() { return this; },
      addMetaTag: function() { return this; },
      getContent: () => html
    })
  },
  ContentService: {
    MimeType: { JSON: 'application/json' },
    createTextOutput: (s) => ({
      setMimeType: function() { return this; },
      getContent: () => s
    })
  },
  ScriptApp: {
    getProjectTriggers: () => [
      { getHandlerFunction: () => 'approvedSender', getEventType: () => 'CLOCK' },
      { getHandlerFunction: () => 'morningWatchdog', getEventType: () => 'CLOCK' }
    ]
  },
  Date
};

vm.createContext(mockContext);

// Load Apps Script Source Files
const filesToLoad = [
  'apps-script/Code.gs',
  'apps-script/Morning.gs',
  'apps-script/Security.gs',
  'apps-script/WebApp.gs'
];

for (const f of filesToLoad) {
  const code = fs.readFileSync(f, 'utf8');
  vm.runInContext(code, mockContext, { filename: f });
}

console.log('✓ All 4 Google Apps Script source files loaded into execution sandbox.\n');

// -----------------------------------------------------------------------------
// TEST 1: Security & Identity Layer (assertAuthorizedAdmin & RBAC)
// -----------------------------------------------------------------------------
console.log('Test 1: Security & Identity Layer');
currentActiveUser = 'contact.onefolk@gmail.com';
const authorized = vm.runInContext("isAuthorizedAdmin('contact.onefolk@gmail.com')", mockContext);
assert.equal(authorized, true, 'contact.onefolk@gmail.com must be recognized as authorized admin');

const authorizedSecond = vm.runInContext("isAuthorizedAdmin('giridharane01@gmail.com')", mockContext);
assert.equal(authorizedSecond, true, 'giridharane01@gmail.com must be recognized as authorized admin');

const unauthorized = vm.runInContext("isAuthorizedAdmin('stranger@external.com')", mockContext);
assert.equal(unauthorized, false, 'External accounts must be rejected by isAuthorizedAdmin');

// Anonymous session rejection
currentActiveUser = '';
currentEffectiveUser = '';
assert.throws(() => {
  vm.runInContext('assertAuthorizedAdmin()', mockContext);
}, /Access Denied/, 'Empty/anonymous user session must fail closed');

// Unauthorized user doGet Access Denied test
currentActiveUser = 'attacker@hacker.io';
const accessDeniedOutput = vm.runInContext("doGet({ parameter: {} })", mockContext);
assert.ok(accessDeniedOutput.getContent().includes('Access Restricted'), 'doGet must render Access Denied view to unauthorized callers');

// Restore authorized admin
currentActiveUser = 'contact.onefolk@gmail.com';
currentEffectiveUser = 'contact.onefolk@gmail.com';
const allowedOutput = vm.runInContext("doGet({ parameter: {} })", mockContext);
assert.ok(allowedOutput.getContent(), 'doGet must succeed for authorized admin');
console.log('✓ Security & RBAC passed.\n');

// -----------------------------------------------------------------------------
// TEST 2: Formula Injection Sanitization
// -----------------------------------------------------------------------------
console.log('Test 2: Formula Injection Sanitization');
const formula1 = vm.runInContext("sanitizeCellValue('=SUM(A1:A10)')", mockContext);
assert.equal(formula1, "'=SUM(A1:A10)", 'Formulas starting with = must be escaped');

const formula2 = vm.runInContext("sanitizeCellValue('+123456789')", mockContext);
assert.equal(formula2, "'+123456789", 'Formulas starting with + must be escaped');

const formula3 = vm.runInContext("sanitizeCellValue('@cmd|')", mockContext);
assert.equal(formula3, "'@cmd|", 'Formulas starting with @ must be escaped');

const normalText = vm.runInContext("sanitizeCellValue('Hello OneFolk')", mockContext);
assert.equal(normalText, 'Hello OneFolk', 'Normal text must not be escaped');
console.log('✓ Formula injection defense passed.\n');

// -----------------------------------------------------------------------------
// TEST 3: Dashboard Overview API (apiGetDashboardData)
// -----------------------------------------------------------------------------
console.log('Test 3: Dashboard Overview API');
const overview = vm.runInContext('apiGetDashboardData()', mockContext);
assert.equal(overview.userEmail, 'contact.onefolk@gmail.com');
assert.ok(overview.metrics, 'Metrics object must be returned');
assert.equal(overview.metrics.readyToReview, 1, 'Should find 1 lead in AWAITING_REVIEW status');
assert.equal(overview.system.sendingLocked, true, 'Sending implementation lock must be true');
assert.equal(overview.system.enableSending, 'NO', 'ENABLE_SENDING must be NO');
assert.equal(overview.system.isSendingActive, false, 'isSendingActive must be false');
console.log('✓ Dashboard overview API passed.\n');

// -----------------------------------------------------------------------------
// TEST 4: Approval Queue Fetching & Pagination
// -----------------------------------------------------------------------------
console.log('Test 4: Approval Queue Fetching & Pagination');
const queueResult = vm.runInContext("apiGetApprovalQueue({ status: 'ALL', page: 1, pageSize: 25 })", mockContext);
assert.equal(queueResult.total, 1, 'Total leads should equal 1');
assert.equal(queueResult.leads.length, 1);
const lead = queueResult.leads[0];
assert.equal(lead.lead_id, 'lead_test_01');
assert.equal(lead.business, 'Stella Maris College');
assert.equal(lead.is_compliant, true, 'Lead with valid 3-para <70 words should be marked compliant');

// Filter by AWAITING_REVIEW
const awaitingFilter = vm.runInContext("apiGetApprovalQueue({ status: 'AWAITING_REVIEW', page: 1, pageSize: 25 })", mockContext);
assert.equal(awaitingFilter.leads.length, 1);

// Filter by REJECTED (empty)
const rejectedFilter = vm.runInContext("apiGetApprovalQueue({ status: 'REJECTED', page: 1, pageSize: 25 })", mockContext);
assert.equal(rejectedFilter.leads.length, 0);

// Search Query
const searchMatch = vm.runInContext("apiGetApprovalQueue({ search: 'stella', page: 1, pageSize: 25 })", mockContext);
assert.equal(searchMatch.leads.length, 1);

const searchNoMatch = vm.runInContext("apiGetApprovalQueue({ search: 'nonexistent', page: 1, pageSize: 25 })", mockContext);
assert.equal(searchNoMatch.leads.length, 0);
console.log('✓ Queue filtering and pagination passed.\n');

// -----------------------------------------------------------------------------
// TEST 5: Lead Details & Strict Email Validation
// -----------------------------------------------------------------------------
console.log('Test 5: Lead Details & Strict Email Validation');
const leadDetails = vm.runInContext("apiGetLeadDetails('lead_test_01')", mockContext);
assert.equal(leadDetails.business, 'Stella Maris College');
assert.equal(leadDetails.isValidDraft, true);
assert.equal(leadDetails.paragraphCount, 3);
assert.ok(leadDetails.wordCount < 70);
assert.equal(leadDetails.validationErrors.length, 0);

// Test saving invalid body (only 2 paragraphs)
assert.throws(() => {
  vm.runInContext("apiSaveDraft('lead_test_01', 'Subject', 'Paragraph 1\\n\\nOur team designed and built the OneFolk website.')", mockContext);
}, /Draft must contain exactly 3 paragraphs/, 'Must reject email with 2 paragraphs');

// Test saving invalid body (missing proof line)
assert.throws(() => {
  vm.runInContext("apiSaveDraft('lead_test_01', 'Subject', 'Para 1\\n\\nWe built something else entirely.\\n\\nQuestion?')", mockContext);
}, /Draft must include the truthful OneFolk proof line/, 'Must reject email without exact proof line');

// Test saving invalid body (>= 70 words)
const longBody = new Array(75).fill('word').join(' ') + '\n\nOur team designed and built the OneFolk website.\n\nQuestion?';
mockContext.longBody = longBody;
assert.throws(() => {
  vm.runInContext("apiSaveDraft('lead_test_01', 'Subject', longBody)", mockContext);
}, /Draft must be fewer than 70 words/, 'Must reject email with >= 70 words');

console.log('✓ Strict 3-paragraph, <70 words, and proof line validation passed.\n');

// -----------------------------------------------------------------------------
// TEST 6: Atomic Approval, SHA-256 Fingerprint & Audit Trail
// -----------------------------------------------------------------------------
console.log('Test 6: Atomic Approval, SHA-256 Fingerprint & Audit Trail');
const approveRes = vm.runInContext("apiApproveLead('lead_test_01')", mockContext);
assert.equal(approveRes.success, true);
assert.ok(approveRes.fingerprint, 'Approval must generate cryptographic fingerprint');

// Verify Script Property
const storedFp = scriptProps.get('APPROVAL_lead_test_01');
assert.equal(storedFp, approveRes.fingerprint, 'Fingerprint must be stored in Script Properties');

// Verify Sheet Status
const queueSheet = sheetStore.get('Approval Queue');
const rows = queueSheet.getDataRange().getValues();
const statusCol = rows[0].indexOf('status');
const approvalCol = rows[0].indexOf('approval');
assert.equal(rows[1][statusCol], 'APPROVED', 'Row status must be APPROVED');
assert.equal(rows[1][approvalCol], 'APPROVED', 'Row approval must be APPROVED');

// Verify Approval Audit sheet
const auditSheet = sheetStore.get('Approval Audit');
assert.ok(auditSheet, 'Approval Audit sheet must be created');
const auditRows = auditSheet.getDataRange().getValues();
assert.equal(auditRows.length, 2, 'Should have header + 1 audit row');
assert.equal(auditRows[1][1], 'lead_test_01');
assert.equal(auditRows[1][2], 'contact.onefolk@gmail.com');
assert.equal(auditRows[1][3], 'APPROVED');
assert.equal(auditRows[1][4], approveRes.fingerprint);
console.log('✓ Dual-key approval and audit logging passed.\n');

// -----------------------------------------------------------------------------
// TEST 7: Post-Approval Edit Invalidates Approval
// -----------------------------------------------------------------------------
console.log('Test 7: Post-Approval Edit Invalidation');
const newValidBody = 'Your site states: "Where do I submit completed forms".\n\nOur team designed and built the OneFolk website.\n\nCould online submission save staff time?';
mockContext.newValidBody = newValidBody;
vm.runInContext("apiSaveDraft('lead_test_01', 'Updated Subject', newValidBody)", mockContext);

// Check that approval was invalidated
const rowsAfterEdit = queueSheet.getDataRange().getValues();
assert.equal(rowsAfterEdit[1][statusCol], 'AWAITING_REVIEW', 'Status must reset to AWAITING_REVIEW upon edit');
assert.equal(rowsAfterEdit[1][approvalCol], 'PENDING', 'Approval must reset to PENDING upon edit');
assert.equal(scriptProps.get('APPROVAL_lead_test_01'), '', 'Fingerprint property must be cleared');
console.log('✓ Post-approval edit invalidation passed.\n');

// -----------------------------------------------------------------------------
// TEST 8: Rejection & Needs Research Actions
// -----------------------------------------------------------------------------
console.log('Test 8: Rejection & Needs Research Actions');
vm.runInContext("apiRejectLead('lead_test_01', 'Not a good fit')", mockContext);
const rowsAfterRej = queueSheet.getDataRange().getValues();
assert.equal(rowsAfterRej[1][statusCol], 'REJECTED');
assert.equal(rowsAfterRej[1][approvalCol], 'REJECTED');

vm.runInContext("apiMarkNeedsResearch('lead_test_01', 'Need phone contact')", mockContext);
const rowsAfterNeeds = queueSheet.getDataRange().getValues();
assert.equal(rowsAfterNeeds[1][statusCol], 'NEEDS_RESEARCH');
assert.equal(rowsAfterNeeds[1][approvalCol], 'PENDING');
console.log('✓ Rejection and Needs Research actions passed.\n');

// -----------------------------------------------------------------------------
// TEST 9: Suppression Protection
// -----------------------------------------------------------------------------
console.log('Test 9: Suppression Protection');
// Attempting to approve a suppressed email
const suppressedLead = [
  'lead_supp_01', 'Suppressed Org', 'education', 'https://suppressed.com/',
  'banned@suppressed.com', 'Subject',
  'P1 observation.\n\nOur team designed and built the OneFolk website.\n\nP3 question?',
  'Alt 1', 'Alt 2', 'Observation', 'https://suppressed.com/', 'OneFolk website',
  'Our team designed and built the OneFolk website.', 100, 'AWAITING_REVIEW', 'PENDING',
  '', new Date().toISOString(), new Date().toISOString(), 'City', 'https://suppressed.com/',
  'https://suppressed.com/', 'QUALIFIED', 'obs', 'opp', new Date().toISOString(),
  'co_supp', new Date().toISOString(), 'MX_VALID_MAILBOX_UNCONFIRMED', 'conf', true,
  'https://onefolk.in/work', 'YES', 25, '2026-10-22', 'src'
];
queueSheet.appendRow(suppressedLead);

assert.throws(() => {
  vm.runInContext("apiApproveLead('lead_supp_01')", mockContext);
}, /Approval blocked: Recipient email or domain is on the Suppression List/, 'Must block approval of suppressed recipient');
console.log('✓ Suppression protection passed.\n');

// -----------------------------------------------------------------------------
// TEST 10: System Health & Campaign Logs
// -----------------------------------------------------------------------------
console.log('Test 10: System Health & Campaign Logs');
const healthData = vm.runInContext('apiGetSystemHealth()', mockContext);
assert.equal(healthData.userEmail, 'contact.onefolk@gmail.com');
assert.equal(healthData.safetyGates.implementationLockActive, true);
assert.equal(healthData.safetyGates.liveDispatchActive, false);
assert.equal(healthData.quotas.mailAppRemainingQuota, 100);

const campaigns = vm.runInContext('apiGetCampaignRuns()', mockContext);
assert.equal(campaigns.length, 1);
assert.equal(campaigns[0].run_id, 'run_overnight_1001');
console.log('✓ System health and campaign logs passed.\n');

// -----------------------------------------------------------------------------
// TEST 11: Cancellation of QUEUED / APPROVED Leads
// -----------------------------------------------------------------------------
console.log('Test 11: Cancel Authorization before Dispatch');
// Reset and approve lead_test_01
const cancelQueueSheet = sheetStore.get('Approval Queue');
const queueRows = cancelQueueSheet.getDataRange().getValues();
const cStatusCol = queueRows[0].indexOf('status');
const cApprovalCol = queueRows[0].indexOf('approval');

// Set back to AWAITING_REVIEW and approve
cancelQueueSheet.getRange(2, cStatusCol + 1).setValue('AWAITING_REVIEW');
cancelQueueSheet.getRange(2, cApprovalCol + 1).setValue('PENDING');
const approved = vm.runInContext("apiApproveLead('lead_test_01')", mockContext);
assert.equal(approved.success, true);
assert.equal(cancelQueueSheet.getDataRange().getValues()[1][cStatusCol], 'APPROVED');

// Now cancel authorization
const cancelRes = vm.runInContext("apiCancelApproval('lead_test_01')", mockContext);
assert.equal(cancelRes.success, true);
const rowsAfterCancel = cancelQueueSheet.getDataRange().getValues();
assert.equal(rowsAfterCancel[1][cStatusCol], 'AWAITING_REVIEW', 'Status must revert to AWAITING_REVIEW');
assert.equal(rowsAfterCancel[1][cApprovalCol], 'PENDING', 'Approval must revert to PENDING');
assert.equal(scriptProps.get('APPROVAL_lead_test_01'), '', 'Approval fingerprint must be wiped');
assert.equal(scriptProps.get('APPROVAL_META_lead_test_01'), '', 'Approval metadata must be wiped');
console.log('✓ Cancellation of queued/approved leads passed.\n');

// -----------------------------------------------------------------------------
// TEST 12: Emergency Stop & Sending Gate Authorization
// -----------------------------------------------------------------------------
console.log('Test 12: Emergency Stop & System-Level Sending Authorization');
const stopRes = vm.runInContext('apiEmergencyStop()', mockContext);
assert.equal(stopRes.success, true);
assert.equal(scriptProps.get('ENABLE_SENDING'), 'NO');
assert.equal(scriptProps.get('EMERGENCY_STOP_ACTIVE'), 'YES');

const healthAfterStop = vm.runInContext('apiGetSystemHealth()', mockContext);
assert.equal(healthAfterStop.safetyGates.emergencyStopActive, true);
assert.equal(healthAfterStop.safetyGates.enableSendingValue, 'NO');

// Test system sending authorization
const authRes = vm.runInContext('apiAuthorizeSystemSending()', mockContext);
assert.equal(authRes.success, true);
assert.equal(scriptProps.get('ENABLE_SENDING'), 'YES');
assert.equal(scriptProps.get('EMERGENCY_STOP_ACTIVE'), 'NO');
assert.ok(scriptProps.get('ACTIVATION_TIMESTAMP'), 'Activation timestamp must be recorded');
console.log('✓ Emergency stop and system sending authorization passed.\n');

// -----------------------------------------------------------------------------
// TEST 13: Authorized Internal Test Email Sending
// -----------------------------------------------------------------------------
console.log('Test 13: Authorized Internal Test Email Sending');
// Valid admin target
const internalRes = vm.runInContext("apiSendInternalTestEmail('contact.onefolk@gmail.com')", mockContext);
assert.equal(internalRes.success, true);
assert.equal(internalRes.recipient, 'contact.onefolk@gmail.com');
assert.equal(internalRes.messageId, 'mock_msg_987654321');

const actSheet = sheetStore.get('Email Activity');
const actRows = actSheet.getDataRange().getValues();
assert.ok(actRows.length >= 2, 'Email Activity must contain test log');
const lastAct = actRows[actRows.length - 1];
assert.equal(lastAct[1], 'internal_test_lead');
assert.equal(lastAct[3], 'contact.onefolk@gmail.com');
assert.equal(lastAct[5], 'SENT');
assert.equal(lastAct[7], 'mock_msg_987654321');
assert.equal(scriptProps.get('INTERNAL_TEST_VERIFIED'), 'YES');

// Non-admin target must fail closed
assert.throws(() => {
  vm.runInContext("apiSendInternalTestEmail('stranger@external.com')", mockContext);
}, /not an authorized OneFolk administrator email/, 'Internal test must reject unauthorized recipients');
console.log('✓ Authorized internal test email sending passed.\n');

// -----------------------------------------------------------------------------
// TEST 14: Historical Backlog Exclusion
// -----------------------------------------------------------------------------
console.log('Test 14: Historical Backlog Safeguard (Zero Auto-Dispatch of Old Backlog)');
// Set activation timestamp to current moment
const activationTime = new Date().toISOString();
scriptProps.set('ACTIVATION_TIMESTAMP', activationTime);

// A legacy row that has status='APPROVED' and approval='APPROVED' but NO approval property
const baseRows = sheetStore.get('Approval Queue').getDataRange().getValues();
const headerMap = {};
baseRows[0].forEach((h, i) => { headerMap[h] = i; });
const legacyRow = [...baseRows[1]];
legacyRow[headerMap['status']] = 'APPROVED';
legacyRow[headerMap['approval']] = 'APPROVED';
legacyRow[headerMap['lead_id']] = 'legacy_backlog_lead';

mockContext.legacyRow = legacyRow;
mockContext.headerMap = headerMap;

// Without ScriptProperty APPROVAL_legacy_backlog_lead, it must fail validation
assert.equal(vm.runInContext('isValidApprovedDraft(legacyRow, headerMap)', mockContext), false, 'Legacy approved row without fingerprint must be rejected');

// Even if someone manually sets the fingerprint but with an old approval timestamp < activationTime
const recordMock = Object.fromEntries(Object.keys(headerMap).map(k => [k, legacyRow[headerMap[k]]]));
mockContext.recordMock = recordMock;
scriptProps.set('APPROVAL_legacy_backlog_lead', vm.runInContext('draftFingerprint(recordMock)', mockContext));
scriptProps.set('APPROVAL_META_legacy_backlog_lead', JSON.stringify({
  approved_by: 'old_admin@onefolk.in',
  approved_at: '2026-10-20T00:00:00.000Z', // Before activation
  recipient: legacyRow[headerMap['public_email']],
  subject: legacyRow[headerMap['subject']]
}));

assert.equal(vm.runInContext('isValidApprovedDraft(legacyRow, headerMap)', mockContext), false, 'Pre-activation historical approval must be blocked from automatic dispatch');

// Re-set ENABLE_SENDING to NO for safety during testing
scriptProps.set('ENABLE_SENDING', 'NO');
console.log('✓ Historical backlog safeguard passed.\n');

console.log('====================================================');
console.log('ALL 14 WEB DASHBOARD BACKEND ACCEPTANCE TESTS PASSED!');
console.log('====================================================');
