const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('./register.cjs');
const { OneFolkDatabase } = require('../src/lib/db.ts');
const { importInstitutionsFromCsv, exportWorkbookCsvs } = require('../src/lib/spreadsheet.ts');
const { runInstitutionalResearch } = require('../src/lib/institutional-engine.ts');

test('End-to-end fixture flow: import, campus differentiation, SSRF blocking, no-website qualification, safe export', async () => {
  const db = new OneFolkDatabase(':memory:');

  const fixturePath = path.resolve(__dirname, '../../../fixtures/sample_institutions.csv');
  const fixtureContent = fs.readFileSync(fixturePath, 'utf-8');

  // 1. Import Fixture
  const importResult = importInstitutionsFromCsv(fixtureContent, db);
  assert.equal(importResult.imported, 5);

  const allLeads = db.getInstitutions();
  assert.equal(allLeads.length, 5);

  // 2. Verify Campuses sharing domain are distinct
  const mainCampus = allLeads.find((l) => l.name === 'Synthetic Greenfield Academy' && l.campus_name === 'Main Campus');
  const branchCampus = allLeads.find((l) => l.name === 'Synthetic Greenfield Academy' && l.campus_name === 'Downtown Branch');
  assert.ok(mainCampus);
  assert.ok(branchCampus);
  assert.notEqual(mainCampus.id, branchCampus.id);
  assert.equal(mainCampus.domain, 'greenfield-sample.example');
  assert.equal(branchCampus.domain, 'greenfield-sample.example');

  // 3. Research institution with no website
  const noSiteLead = allLeads.find((l) => l.name === 'Synthetic Rural Vocational Center');
  assert.ok(noSiteLead);
  const noSiteOutcome = await runInstitutionalResearch(noSiteLead.id, db);
  assert.equal(noSiteOutcome.institution.website_state, 'NOT_FOUND');
  assert.equal(noSiteOutcome.qualification_status, 'NEEDS_FURTHER_RESEARCH');
  assert.equal(noSiteOutcome.is_shortlisted, false);

  const noSiteEvidence = db.getEvidence(noSiteLead.id);
  assert.equal(noSiteEvidence.length, 1);
  assert.equal(noSiteEvidence[0].status, 'NOT_OBSERVED');

  // 4. Research institution with SSRF loopback target (127.0.0.1)
  const ssrfLead = allLeads.find((l) => l.name === 'Synthetic Coastal Institute');
  assert.ok(ssrfLead);
  const ssrfOutcome = await runInstitutionalResearch(ssrfLead.id, db);
  assert.equal(ssrfOutcome.institution.website_state, 'UNREACHABLE');
  assert.equal(ssrfOutcome.qualification_status, 'NEEDS_FURTHER_RESEARCH');
  assert.equal(ssrfOutcome.is_shortlisted, false);

  // 5. Safe Export
  const exported = exportWorkbookCsvs(db);
  assert.ok(exported.leadsCsv.includes('Synthetic Greenfield Academy'));
  assert.ok(exported.leadsCsv.includes('Main Campus'));
  assert.ok(exported.leadsCsv.includes('Downtown Branch'));
  assert.ok(exported.leadsCsv.includes('Synthetic Rural Vocational Center'));
  assert.ok(exported.evidenceCsv.includes('NOT_OBSERVED'));

  db.close();
});
