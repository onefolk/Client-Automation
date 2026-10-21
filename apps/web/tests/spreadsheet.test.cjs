const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./register.cjs');
const { OneFolkDatabase } = require('../src/lib/db.ts');
const {
  sanitizeSpreadsheetCell,
  encodeSafeCsv,
  parseSafeCsv,
  exportWorkbookCsvs,
  importInstitutionsFromCsv,
  syncOutreachFromSpreadsheetCsv,
} = require('../src/lib/spreadsheet.ts');

test('Formula injection characters are safely escaped with single quote', () => {
  assert.equal(sanitizeSpreadsheetCell('=1+2'), "'=1+2");
  assert.equal(sanitizeSpreadsheetCell('+447123456789'), "'+447123456789");
  assert.equal(sanitizeSpreadsheetCell('-100'), "'-100");
  assert.equal(sanitizeSpreadsheetCell('@SUM(A1:A10)'), "'@SUM(A1:A10)");
  assert.equal(sanitizeSpreadsheetCell('\talert(1)'), "'\talert(1)");
  assert.equal(sanitizeSpreadsheetCell('Normal School Name'), 'Normal School Name');
});

test('Phone numbers and identifiers with leading zeros are preserved as text', () => {
  assert.equal(sanitizeSpreadsheetCell('0123456789'), "'0123456789");
  assert.equal(sanitizeSpreadsheetCell('0045'), "'0045");
});

test('CSV encoding escapes quotes, newlines, and formula injection', () => {
  const rows = [
    ['Header1', 'Header2'],
    ['=cmd|"/c calc"!A0', 'Normal, "Quoted" Text'],
  ];
  const encoded = encodeSafeCsv(rows);
  assert.match(encoded, /"'=cmd\|""\/c calc""!A0","Normal, ""Quoted"" Text"/);
});

test('5-tab CSV workbook export generates valid schemas for all tabs', () => {
  const db = new OneFolkDatabase(':memory:');
  const inst = db.upsertInstitution({
    name: 'Cambridge International School',
    website_url: 'https://cambridge.example',
    city: 'Dubai',
  });

  db.addContacts([
    {
      institution_id: inst.id,
      contact_type: 'email',
      value: 'admissions@cambridge.example',
      label: 'Admissions',
      source_url: 'https://cambridge.example/contact',
      confidence: 0.9,
      verified: false,
    },
  ]);

  db.setEvidence(inst.id, [
    {
      signal_key: 'digital_admissions',
      label: 'Digital Admissions Flow',
      claim: 'Online application not observed',
      status: 'NOT_OBSERVED',
      source_url: 'https://cambridge.example',
      confidence: 0.6,
      observed_at: new Date().toISOString(),
    },
  ]);

  db.addSuppression({
    type: 'DOMAIN',
    value: 'blocked.example',
    reason: 'Opt-out request',
    source: 'manual',
  });

  const workbook = exportWorkbookCsvs(db);
  assert.ok(workbook.leadsCsv.includes('Cambridge International School'));
  assert.ok(workbook.leadsCsv.includes('Lead ID'));
  assert.ok(workbook.evidenceCsv.includes('digital_admissions'));
  assert.ok(workbook.evidenceCsv.includes('NOT_OBSERVED'));
  assert.ok(workbook.outreachCsv.includes('Outreach ID'));
  assert.ok(workbook.suppressionCsv.includes('blocked.example'));
  assert.ok(workbook.settingsCsv.includes('SCHEMA_VERSION'));

  db.close();
});

test('Non-destructive import preserves existing outreach approval and message IDs', () => {
  const db = new OneFolkDatabase(':memory:');

  // 1. Initial institution and outreach state
  const inst = db.upsertInstitution({
    name: 'Greenwood High',
    campus_name: 'Main Campus',
    website_url: 'https://greenwood.example',
    city: 'Bangalore',
  });

  db.updateOutreach(inst.id, {
    outreach_status: 'APPROVED_TO_CONTACT',
    review_decision: 'APPROVE',
    draft_recipient: 'head@greenwood.example',
    draft_subject: 'Digital prospectus proposal',
    draft_body: 'Dear Principal...',
    gmail_message_id: 'msg_12345',
    gmail_thread_id: 'thread_67890',
  });

  const outreachBefore = db.getOutreach(inst.id);
  assert.equal(outreachBefore.gmail_message_id, 'msg_12345');
  assert.equal(outreachBefore.outreach_status, 'APPROVED_TO_CONTACT');

  // 2. Re-importing a CSV with Greenwood High
  const csvData = `
Institution Name,Campus,Website,City
Greenwood High,Main Campus,https://greenwood.example,Bangalore
St. Jude School,North,https://stjude.example,Delhi
`.trim();

  const res = importInstitutionsFromCsv(csvData, db);
  assert.equal(res.imported, 1); // St. Jude is new
  assert.equal(res.updated, 1); // Greenwood is updated

  // Verify Greenwood's outreach data was NOT corrupted or overwritten
  const outreachAfter = db.getOutreach(inst.id);
  assert.equal(outreachAfter.gmail_message_id, 'msg_12345');
  assert.equal(outreachAfter.outreach_status, 'APPROVED_TO_CONTACT');
  assert.equal(outreachAfter.draft_recipient, 'head@greenwood.example');

  db.close();
});

test('Spreadsheet outreach sync creates persistent suppression when lead opts out', () => {
  const db = new OneFolkDatabase(':memory:');
  const inst = db.upsertInstitution({
    name: 'Heritage School',
    website_url: 'https://heritage.example',
  });

  const syncCsv = `
Lead ID,Outreach Status,Opt Out Date
${inst.id},OPTED_OUT,2026-10-21
`.trim();

  const result = syncOutreachFromSpreadsheetCsv(syncCsv, db);
  assert.equal(result.synced, 1);
  assert.equal(result.opt_outs_suppressed, 1);

  // Check that domain is now in persistent suppression list
  const suppression = db.isSuppressed('heritage.example');
  assert.equal(suppression.suppressed, true);

  db.close();
});
