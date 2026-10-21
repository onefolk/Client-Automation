const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./register.cjs');
const { OneFolkDatabase } = require('../src/lib/db.ts');
const { runInstitutionalResearch, applyManualCorrection } = require('../src/lib/institutional-engine.ts');

test('Suppressed institutions are immediately disqualified without web crawl', async () => {
  const db = new OneFolkDatabase(':memory:');

  db.addSuppression({
    type: 'DOMAIN',
    value: 'suppressed-school.edu',
    reason: 'Do not contact request',
    source: 'manual',
  });

  const inst = db.upsertInstitution({
    name: 'Suppressed Academy',
    website_url: 'https://suppressed-school.edu',
  });

  const outcome = await runInstitutionalResearch(inst.id, db);
  assert.equal(outcome.qualification_status, 'DISQUALIFIED');
  assert.equal(outcome.is_shortlisted, false);
  assert.match(outcome.qualification_reason, /suppression rule/i);

  const logs = db.getAuditLogs(inst.id);
  assert.ok(logs.some((l) => l.field_name === 'qualification_status' && l.new_value === 'DISQUALIFIED'));

  db.close();
});

test('Institution without website transitions to NEEDS_FURTHER_RESEARCH honestly', async () => {
  const db = new OneFolkDatabase(':memory:');
  const inst = db.upsertInstitution({
    name: 'Rural Community College',
    website_url: '',
  });

  const outcome = await runInstitutionalResearch(inst.id, db);
  assert.equal(outcome.institution.website_state, 'NOT_FOUND');
  assert.equal(outcome.qualification_status, 'NEEDS_FURTHER_RESEARCH');
  assert.equal(outcome.is_shortlisted, false);

  const evidence = db.getEvidence(inst.id);
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].status, 'NOT_OBSERVED');

  db.close();
});

test('Shortlisting boundary strictly keeps outreach status as DRAFTED, never APPROVED_TO_CONTACT', async () => {
  const db = new OneFolkDatabase(':memory:');
  const inst = db.upsertInstitution({
    name: 'Beacon International School',
    website_url: 'https://beacon.example',
  });

  // Pre-seed mock contact and evidence to simulate qualification
  db.addContacts([
    {
      institution_id: inst.id,
      contact_type: 'email',
      value: 'admissions@beacon.example',
      label: 'Admissions',
      source_url: 'https://beacon.example/admissions',
      confidence: 0.9,
      verified: false,
    },
  ]);

  // Manually qualify institution
  db.upsertInstitution({
    id: inst.id,
    name: inst.name,
    qualification_status: 'QUALIFIED',
    is_shortlisted: true,
    shortlist_reason: 'Qualified digital inquiry opportunity',
  });

  // Verify outreach record
  const outreach = db.ensureOutreachRecord(inst.id);
  assert.notEqual(outreach.outreach_status, 'APPROVED_TO_CONTACT');
  assert.equal(outreach.approval_version, 0);
  assert.equal(outreach.approval_timestamp, null);

  db.close();
});

test('Manual correction persists changes, updates notes, and creates audit trail', () => {
  const db = new OneFolkDatabase(':memory:');
  const inst = db.upsertInstitution({
    name: 'Old School Name',
    website_url: 'https://oldschool.example',
    qualification_status: 'PENDING_REVIEW',
  });

  const updatedProfile = applyManualCorrection(
    inst.id,
    {
      name: 'Corrected School Name',
      qualification_status: 'QUALIFIED',
      is_shortlisted: true,
      shortlist_reason: 'Manually verified active admissions intake',
    },
    'Verified via government registry and official prospectus',
    'lead_reviewer',
    db
  );

  assert.equal(updatedProfile.institution.name, 'Corrected School Name');
  assert.equal(updatedProfile.institution.qualification_status, 'QUALIFIED');
  assert.equal(updatedProfile.institution.is_shortlisted, true);
  assert.match(updatedProfile.institution.notes, /Verified via government registry/);

  const logs = updatedProfile.audit_logs;
  assert.ok(logs.some((l) => l.field_name === 'name' && l.new_value === 'Corrected School Name'));
  assert.ok(logs.some((l) => l.field_name === 'qualification_status' && l.new_value === 'QUALIFIED'));

  db.close();
});
