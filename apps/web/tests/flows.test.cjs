require('./register.cjs');
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const { memoryStore } = require('../src/lib/store.ts');
const { runDiscoveryPipelineStream } = require('../src/lib/discovery-engine.ts');
const { resolveBusinessProfile } = require('../src/lib/business-resolver.ts');
const searches = require('../src/app/api/searches/route.ts');
const events = require('../src/app/api/searches/[id]/events/route.ts');
const enrich = require('../src/app/api/businesses/[id]/enrich/route.ts');
const analyze = require('../src/app/api/businesses/[id]/analyze/route.ts');
const originalFetch = global.fetch;
const originalEnv = { ...process.env };
const request = (url = '/api/searches/test/events', init) => new NextRequest('http://localhost' + url, init);
const candidate = { name: 'Actual Clinic', display_name: 'Actual Clinic, London', address: { city: 'London' },
  osm_type: 'node', osm_id: 1, extratags: { website: 'https://actual.example' } };
beforeEach(() => {
  for (const value of Object.values(memoryStore)) {
    if (value instanceof Map) value.clear();
    if (Array.isArray(value)) value.length = 0;
  }
});
afterEach(() => { global.fetch = originalFetch; process.env = { ...originalEnv }; });
async function create(query = 'clinics in London') {
  const res = await searches.POST(request('/api/searches', { method: 'POST', body: JSON.stringify({ query }) }));
  assert.equal(res.status, 200);
  return (await res.json()).search_id;
}
async function discover(items = [candidate]) {
  global.fetch = async () => Response.json(items);
  const id = await create();
  const seen = [];
  await runDiscoveryPipelineStream(id, 'clinics in London', {}, (event) => seen.push(event));
  return { id, seen, business: [...memoryStore.businesses.values()][0] };
}

test('invalid search bodies fail without creating sessions', async () => {
  for (const body of ['{', 'null', '[]', '{}', '{"query":" "}', '{"query":42}', '{"query":"x","filters":null}', '{"query":"x","filters":{"city":42}}']) {
    assert.equal((await searches.POST(request('/api/searches', { method: 'POST', body }))).status, 400, body);
  }
  assert.equal(memoryStore.searches.size, 0);
});

test('empty registry results stay empty and report actual counters', async () => {
  const { id, seen } = await discover([]);
  assert.equal(memoryStore.businesses.size, 0);
  assert.equal(memoryStore.searches.get(id).status, 'COMPLETED');
  assert.equal(seen.at(-1).data.total_saved, 0);
  assert.equal(seen.at(-1).data.total_enriched, 0);
});

test('discovery uses parsed location and does not invent contacts or audit evidence', async () => {
  let requested;
  global.fetch = async (url) => { requested = url; return Response.json([candidate]); };
  const id = await create();
  await runDiscoveryPipelineStream(id, 'clinics in London', {}, () => {});
  assert.match(new URL(requested).searchParams.get('q'), /London/i);
  const business = [...memoryStore.businesses.values()][0];
  assert.equal(business.email, undefined);
  assert.equal(business.phone, undefined);
  assert.equal(business.rating, undefined);
  assert.equal(business.website_load_time_ms, undefined);
  assert.equal(business.status, 'DISCOVERED');
  assert.deepEqual(resolveBusinessProfile(business.id).facts, []);
  assert.equal(memoryStore.opportunities.size, 0);
  const { detectGaps } = require('../src/lib/gap-detector.ts');
  const report = detectGaps(resolveBusinessProfile(business.id));
  assert.equal(report.hasGaps, false);
  assert.match(report.personalizedBody, /not yet have enough evidence/);
  assert.doesNotMatch(report.personalizedBody, /revenue loss/);
});

test('concurrent SSE clients share one run, replay results and release subscribers', async () => {
  const id = await create();
  let release;
  let calls = 0;
  global.fetch = () => { calls++; return new Promise((resolve) => { release = () => resolve(Response.json([candidate])); }); };
  const first = await events.GET(request(), { params: { id } });
  const second = await events.GET(request(), { params: { id } });
  release();
  const [a, b] = await Promise.all([first.text(), second.text()]);
  assert.match(a, /event: search.completed/);
  assert.equal(a, b);
  const replay = await events.GET(request(), { params: { id } });
  assert.equal(await replay.text(), a);
  assert.equal(calls, 1);
  assert.equal(memoryStore.eventSubscribers.size, 0);
  assert.equal(memoryStore.activeSearches.size, 0);
});

test('provider failures terminate the stream and update session status', async () => {
  const id = await create();
  global.fetch = async () => new Response('', { status: 429 });
  const response = await events.GET(request(), { params: { id } });
  assert.match(await response.text(), /event: search.failed/);
  assert.equal(memoryStore.searches.get(id).status, 'FAILED');
  assert.equal(memoryStore.eventSubscribers.size, 0);
  assert.equal(memoryStore.businesses.size, 0);
});

test('cancelling a stream releases its subscriber without duplicating the shared job', async () => {
  const id = await create();
  let release;
  global.fetch = () => new Promise((resolve) => { release = () => resolve(Response.json([])); });
  const response = await events.GET(request(), { params: { id } });
  await response.body.cancel();
  assert.equal(memoryStore.eventSubscribers.size, 0);
  const pending = memoryStore.activeSearches.get(id);
  release();
  await pending;
  assert.equal(memoryStore.searches.get(id).status, 'COMPLETED');
});

test('unknown business IDs and empty directories never fabricate records', async () => {
  assert.equal(resolveBusinessProfile('unknown'), undefined);
  const detail = require('../src/app/api/businesses/[id]/route.ts');
  assert.equal((await detail.GET(request(), { params: { id: 'unknown' } })).status, 404);
  for (const route of ['businesses', 'clientHistory', 'opportunities', 'activities']) {
    const res = await require('../src/app/api/' + route + '/route.ts').GET(request());
    assert.deepEqual(await res.json(), []);
  }
  assert.equal(memoryStore.businesses.size, 0);
});

test('enrichment survives profile reads and rediscovery; failed recrawls preserve it', async () => {
  const { business } = await discover();
  global.fetch = async () => new Response('<html><title>Actual Clinic</title><meta name="viewport" content="width=device-width"><script src="/wp-content/a.js"></script><a href="mailto:info@actual.example">Email</a></html>');
  const result = await enrich.POST(request(), { params: { id: business.id } });
  assert.equal(result.status, 200);
  const profile = resolveBusinessProfile(business.id);
  assert.equal(profile.email, 'info@actual.example');
  assert.equal(profile.technologies[0].name, 'WordPress');
  assert.ok(profile.facts.length > 0);
  await discover();
  assert.equal(memoryStore.businesses.size, 1);
  assert.deepEqual(resolveBusinessProfile(business.id).facts, profile.facts);
  const before = JSON.stringify(memoryStore.businesses.get(business.id));
  global.fetch = async () => new Response('Unavailable', { status: 503 });
  assert.equal((await enrich.POST(request(), { params: { id: business.id } })).status, 502);
  assert.equal(JSON.stringify(memoryStore.businesses.get(business.id)), before);
});

test('analysis preserves zero scores, rejects invalid scores and routes xAI credentials correctly', async () => {
  const { business } = await discover();
  delete process.env.GROQ_API_KEY; delete process.env.LLAMA_API_KEY; delete process.env.OPENAI_API_KEY;
  process.env.XAI_API_KEY = 'test-key'; process.env.XAI_MODEL = 'test-model';
  const data = { digital_presence_score: 0, website_score: 0, social_score: 0, seo_score: 0,
    lead_capture_score: 0, reputation_score: 0, marketing_maturity: 'EARLY_STAGE', strengths: [], weaknesses: [], opportunities: [] };
  global.fetch = async (url, init) => {
    assert.equal(url, 'https://api.x.ai/v1/chat/completions');
    assert.equal(JSON.parse(init.body).model, 'test-model');
    return Response.json({ choices: [{ message: { content: JSON.stringify(data) } }] });
  };
  assert.equal((await analyze.POST(request(), { params: { id: business.id } })).status, 200);
  assert.equal(resolveBusinessProfile(business.id).analysis.website_score, 0);
  data.website_score = 101;
  assert.equal((await analyze.POST(request(), { params: { id: business.id } })).status, 502);
  assert.equal(resolveBusinessProfile(business.id).analysis.website_score, 0);
});
