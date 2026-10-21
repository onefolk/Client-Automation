const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
require('./register.cjs');
const { getDatabase } = require('../src/lib/db.ts');
const institutionsRoute = require('../src/app/api/institutions/route.ts');
const institutionDetailRoute = require('../src/app/api/institutions/[id]/route.ts');
const importCsvRoute = require('../src/app/api/institutions/import-csv/route.ts');
const exportCsvRoute = require('../src/app/api/institutions/export-csv/route.ts');
const outreachSyncRoute = require('../src/app/api/outreach/sync/route.ts');
const suppressionRoute = require('../src/app/api/suppression/route.ts');

const request = (url, init) => new NextRequest('http://localhost' + url, init);

beforeEach(() => {
  // Use in-memory database for isolation
  process.env.ONEFOLK_DB_PATH = ':memory:';
  global.__ONEFOLK_DB_INSTANCE__ = undefined;
});

afterEach(() => {
  if (global.__ONEFOLK_DB_INSTANCE__) {
    global.__ONEFOLK_DB_INSTANCE__.close();
    global.__ONEFOLK_DB_INSTANCE__ = undefined;
  }
});

test('POST /api/institutions creates lead and GET /api/institutions lists it', async () => {
  const postRes = await institutionsRoute.POST(
    request('/api/institutions', {
      method: 'POST',
      body: JSON.stringify({
        name: 'St. Andrews College',
        campus_name: 'Hilltop Campus',
        website_url: 'https://standrews.example',
        city: 'Edinburgh',
      }),
    })
  );
  assert.equal(postRes.status, 200);
  const postJson = await postRes.json();
  assert.equal(postJson.success, true);
  assert.equal(postJson.data.name, 'St. Andrews College');
  assert.equal(postJson.data.campus_name, 'Hilltop Campus');

  const getRes = await institutionsRoute.GET(request('/api/institutions'));
  assert.equal(getRes.status, 200);
  const getJson = await getRes.json();
  assert.equal(getJson.total, 1);
  assert.equal(getJson.data[0].city, 'Edinburgh');
});

test('PATCH /api/institutions/[id] records manual correction and audit log', async () => {
  const postRes = await institutionsRoute.POST(
    request('/api/institutions', {
      method: 'POST',
      body: JSON.stringify({ name: 'Old College Name' }),
    })
  );
  const id = (await postRes.json()).data.id;

  const patchRes = await institutionDetailRoute.PATCH(
    request(`/api/institutions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'New College Name',
        is_shortlisted: true,
        qualification_status: 'QUALIFIED',
        notes: 'Verified accreditation manually',
      }),
    }),
    { params: { id } }
  );
  assert.equal(patchRes.status, 200);
  const patchJson = await patchRes.json();
  assert.equal(patchJson.data.institution.name, 'New College Name');
  assert.equal(patchJson.data.institution.is_shortlisted, true);
  assert.ok(patchJson.data.audit_logs.some((l) => l.field_name === 'name' && l.new_value === 'New College Name'));
});

test('POST /api/institutions/import-csv and GET /api/institutions/export-csv work cleanly', async () => {
  const sampleCsv = `
Institution Name,Campus Name,Website,City
Oxford Academy,Main,https://oxford-academy.example,Oxford
Cambridge School,North,https://cambridge-school.example,Cambridge
`.trim();

  const importRes = await importCsvRoute.POST(
    request('/api/institutions/import-csv', {
      method: 'POST',
      body: sampleCsv,
    })
  );
  assert.equal(importRes.status, 200);
  const importJson = await importRes.json();
  assert.equal(importJson.imported, 2);

  const exportRes = await exportCsvRoute.GET(request('/api/institutions/export-csv?tab=leads'));
  assert.equal(exportRes.status, 200);
  const csvText = await exportRes.text();
  assert.ok(csvText.includes('Oxford Academy'));
  assert.ok(csvText.includes('Cambridge School'));
  assert.ok(csvText.includes('Lead ID'));
});

test('POST /api/outreach/sync and suppression routes enforce opt-outs', async () => {
  const postRes = await institutionsRoute.POST(
    request('/api/institutions', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Academy',
        website_url: 'https://testacademy.example',
      }),
    })
  );
  const leadId = (await postRes.json()).data.id;

  const syncCsv = `
Lead ID,Outreach Status,Opt Out Date
${leadId},OPTED_OUT,2026-10-21
`.trim();

  const syncRes = await outreachSyncRoute.POST(
    request('/api/outreach/sync', {
      method: 'POST',
      body: syncCsv,
    })
  );
  assert.equal(syncRes.status, 200);

  const supRes = await suppressionRoute.GET(request('/api/suppression'));
  const supJson = await supRes.json();
  assert.ok(supJson.data.some((s) => s.value === 'testacademy.example'));
});
