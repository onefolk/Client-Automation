// Runs the shipped Apps Script manual-search code against a mocked GitHub API.
const vm = require('node:vm'), fs = require('node:fs'), assert = require('node:assert/strict');

const props = new Map([['AUTHORIZED_ADMINS', 'team.onefolk@gmail.com']]);
let user = 'team.onefolk@gmail.com';
let reply = { code: 204, text: '' };
const requests = [];
const audit = [];

const context = {
  console, Date, JSON,
  Logger: { log() {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props.get(k) || '', setProperty: (k, v) => props.set(k, String(v)) }) },
  Session: { getActiveUser: () => ({ getEmail: () => user }), getEffectiveUser: () => ({ getEmail: () => user }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => true, releaseLock() {} }) },
  Utilities: { formatDate: d => new Date(d).toISOString().slice(0, 10) },
  SpreadsheetApp: { openById: () => ({ getUrl: () => 'https://docs.google.com/spreadsheets/d/x/edit', getSheetByName: () => ({ appendRow: r => audit.push(r) }), insertSheet: () => ({ appendRow() {} }) }) },
  UrlFetchApp: {
    fetch(url, options) {
      requests.push({ url, options });
      return { getResponseCode: () => reply.code, getContentText: () => reply.text };
    }
  }
};
vm.createContext(context);
vm.runInContext(['Security.gs', 'Code.gs', 'Morning.gs', 'WebApp.gs'].map(f => fs.readFileSync('apps-script/' + f, 'utf8')).join('\n'), context);
const run = code => vm.runInContext(code, context);
const throwsLike = (fn, pattern, why) => assert.throws(fn, err => pattern.test(String(err && err.message)), why);

// Without a token the page loads, explains setup, and starting is refused.
let config = run('apiGetManualSearchConfig()');
assert.equal(config.tokenConfigured, false);
assert.equal(config.options.cities.length, 23);
throwsLike(() => run('apiTriggerManualSearch({mode:"preflight"})'), /token not configured/, 'no token, no run');
assert.equal(requests.length, 0);

props.set('GITHUB_DISPATCH_TOKEN', 'ghp_secret_value');

// Only admins can see or start searches.
user = 'stranger@example.com';
throwsLike(() => run('apiGetManualSearchConfig()'), /Access Denied/, 'non-admin cannot view');
throwsLike(() => run('apiTriggerManualSearch({})'), /Access Denied/, 'non-admin cannot start');
user = 'team.onefolk@gmail.com';

// Every option is checked on the server, not just in the page.
throwsLike(() => run('apiTriggerManualSearch({mode:"rm -rf"})'), /Invalid mode/);
throwsLike(() => run('apiTriggerManualSearch({city:"Atlantis"})'), /Invalid city/);
throwsLike(() => run('apiTriggerManualSearch({industry:"crypto"})'), /Invalid industry/);
throwsLike(() => run('apiTriggerManualSearch({target:0})'), /Target/);
throwsLike(() => run('apiTriggerManualSearch({target:2.5})'), /Target/);
throwsLike(() => run('apiTriggerManualSearch({no_site_searches:500})'), /Search budget/);
assert.equal(requests.length, 0, 'invalid input never reaches GitHub');

// A valid start calls the workflow on main with string inputs and the token in a header only.
let res = run('apiTriggerManualSearch({mode:"full",lane:"no-website",city:"Pune",industry:"wellness",target:12,no_site_searches:20})');
assert.equal(res.success, true);
const sent = requests.pop();
assert.match(sent.url, /^https:\/\/api\.github\.com\/repos\/onefolk\/Client-Automation\/actions\/workflows\/morning_queue\.yml\/dispatches$/);
assert.equal(sent.options.method, 'post');
assert.equal(sent.options.headers.Authorization, 'Bearer ghp_secret_value');
assert.deepEqual(JSON.parse(sent.options.payload), { ref: 'main', inputs: { mode: 'full', lane: 'no-website', city: 'Pune', industry: 'wellness', target: '12', no_site_searches: '20' } });
assert.ok(!JSON.stringify(res).includes('ghp_secret_value'), 'token never returned to the page');
assert.ok(audit.some(r => r[3] === 'MANUAL_SEARCH_STARTED'), 'start is audited');

// A second start within a minute is refused (double click, impatience).
throwsLike(() => run('apiTriggerManualSearch({mode:"preflight"})'), /less than a minute/);

// Full runs are capped per day; other modes still work.
const today = new Date().toISOString().slice(0, 10);
const old = new Date(Date.now() - 3600000).toISOString();
props.set('MANUAL_SEARCH_LOG', JSON.stringify([
  { at: old, ist_date: today, mode: 'full' }, { at: old, ist_date: today, mode: 'full' }]));
throwsLike(() => run('apiTriggerManualSearch({mode:"full"})'), /Daily limit/);
assert.equal(run('apiTriggerManualSearch({mode:"publish-only"})').success, true);

// GitHub refusals become plain explanations and nothing is logged.
props.set('MANUAL_SEARCH_LOG', '[]');
for (const [code, pattern] of [[401, /rejected the token/], [403, /Actions: Read and write/], [404, /could not find/], [422, /Merge the manual-run update/]]) {
  reply = { code, text: '{}' };
  throwsLike(() => run('apiTriggerManualSearch({mode:"preflight"})'), pattern, 'HTTP ' + code);
}
assert.equal(JSON.parse(props.get('MANUAL_SEARCH_LOG')).length, 0);

// Status is matched to GitHub runs by start time.
const startedAt = new Date(Date.now() - 600000).toISOString();
props.set('MANUAL_SEARCH_LOG', JSON.stringify([{ at: startedAt, ist_date: today, by: 'team.onefolk@gmail.com', mode: 'full', lane: 'all', city: 'all', industry: 'all', target: 10 }]));
reply = { code: 200, text: JSON.stringify({ workflow_runs: [
  { id: 1, created_at: new Date(Date.now() - 3600000).toISOString(), status: 'completed', conclusion: 'success', html_url: 'https://github.com/run/1' },
  { id: 2, created_at: new Date(Date.parse(startedAt) + 8000).toISOString(), status: 'in_progress', conclusion: null, html_url: 'https://github.com/run/2' }] }) };
config = run('apiGetManualSearchConfig()');
assert.equal(config.history[0].status, 'in_progress');
assert.equal(config.history[0].run_url, 'https://github.com/run/2');
assert.equal(config.fullRunsToday, 1);

reply = { code: 401, text: '' };
config = run('apiGetManualSearchConfig()');
assert.match(config.githubError, /rejected the token/);

console.log('Manual search: auth, validation, GitHub call, limits, errors and status matching passed');
