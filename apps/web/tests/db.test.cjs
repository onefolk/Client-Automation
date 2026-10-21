const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./register.cjs');
const { OneFolkDatabase } = require('../src/lib/db.ts');

test('SQLite database initializes schema and tables in-memory', () => {
  const db = new OneFolkDatabase(':memory:');
  assert.ok(db);
  const institutions = db.getInstitutions();
  assert.deepEqual(institutions, []);
  db.close();
});

test('Campuses sharing the same parent domain are kept separate and not merged', () => {
  const db = new OneFolkDatabase(':memory:');

  const mainCampus = db.upsertInstitution({
    name: 'State University',
    campus_name: 'Main Campus',
    website_url: 'https://state.edu',
    city: 'Capital City',
  });

  const medicalCampus = db.upsertInstitution({
    name: 'State University',
    campus_name: 'Medical Center',
    website_url: 'https://state.edu/med',
    city: 'Metro City',
  });

  assert.notEqual(mainCampus.id, medicalCampus.id);
  const list = db.getInstitutions();
  assert.equal(list.length, 2);

  const foundMain = db.getInstitutionById(mainCampus.id);
  assert.equal(foundMain.campus_name, 'Main Campus');

  const foundMed = db.getInstitutionById(medicalCampus.id);
  assert.equal(foundMed.campus_name, 'Medical Center');
  assert.equal(foundMed.domain, 'state.edu');

  db.close();
});

test('Contacts preserve source provenance and maintain verified=false', () => {
  const db = new OneFolkDatabase(':memory:');
  const inst = db.upsertInstitution({ name: 'Pinecrest Academy', website_url: 'https://pinecrest.example' });

  db.addContacts([
    {
      institution_id: inst.id,
      contact_type: 'email',
      value: 'admissions@pinecrest.example',
      label: 'Admissions Office',
      source_url: 'https://pinecrest.example/admissions',
      confidence: 0.85,
      verified: false,
    },
    {
      institution_id: inst.id,
      contact_type: 'phone',
      value: '+1-555-0199',
      label: 'Main Office',
      source_url: 'https://pinecrest.example/contact',
      confidence: 0.9,
      verified: false,
    },
  ]);

  const contacts = db.getContacts(inst.id);
  assert.equal(contacts.length, 2);
  assert.equal(contacts[0].verified, false);
  assert.equal(contacts[0].source_url, 'https://pinecrest.example/admissions');
  assert.equal(contacts[1].value, '+1-555-0199');

  db.close();
});

test('Outreach draft modifications automatically invalidate prior approvals', () => {
  const db = new OneFolkDatabase(':memory:');
  const inst = db.upsertInstitution({ name: 'Oakridge Institute' });

  // 1. Initial draft
  db.updateOutreach(inst.id, {
    contact_email: 'head@oakridge.example',
    draft_recipient: 'head@oakridge.example',
    draft_subject: 'Modern digital prospectus inquiry',
    draft_body: 'Hello Principal,\nWe reviewed your admissions portal...',
    outreach_status: 'DRAFTED',
  });

  let outreach = db.getOutreach(inst.id);
  assert.equal(outreach.outreach_status, 'DRAFTED');
  assert.equal(outreach.approval_version, 0);

  // 2. Approve draft
  db.updateOutreach(inst.id, {
    outreach_status: 'APPROVED_TO_CONTACT',
    review_decision: 'APPROVE',
  });

  outreach = db.getOutreach(inst.id);
  assert.equal(outreach.outreach_status, 'APPROVED_TO_CONTACT');
  assert.equal(outreach.approval_version, 1);
  assert.ok(outreach.approval_timestamp);

  // 3. User modifies draft body -> approval MUST be invalidated back to DRAFTED
  db.updateOutreach(inst.id, {
    draft_body: 'Updated body with different wording...',
  });

  outreach = db.getOutreach(inst.id);
  assert.equal(outreach.outreach_status, 'DRAFTED');
  assert.equal(outreach.approval_timestamp, null);

  db.close();
});

test('Suppression list prevents suppressed domains, emails, and institutions', () => {
  const db = new OneFolkDatabase(':memory:');

  db.addSuppression({
    type: 'DOMAIN',
    value: 'suppressed-domain.org',
    reason: 'Previously requested no contact',
    source: 'manual_suppression',
  });

  db.addSuppression({
    type: 'EMAIL',
    value: 'optout@school.org',
    reason: 'Unsubscribed',
    source: 'google_sheets_sync',
  });

  assert.equal(db.isSuppressed('www.suppressed-domain.org').suppressed, true);
  assert.equal(db.isSuppressed(undefined, 'optout@school.org').suppressed, true);
  assert.equal(db.isSuppressed('allowed-school.org', 'info@allowed-school.org').suppressed, false);

  db.close();
});
