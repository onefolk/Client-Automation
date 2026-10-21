const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./register.cjs');
const {
  isPrivateOrBlockedIP,
  validateSafeUrl,
  extractEmails,
  extractPhones,
  discoverRelevantSubPages,
  inspectInstitutionWebsite,
} = require('../src/lib/crawler.ts');

test('SSRF filter blocks loopback, private ranges, link-local and cloud metadata', () => {
  // Loopback
  assert.equal(isPrivateOrBlockedIP('127.0.0.1'), true);
  assert.equal(isPrivateOrBlockedIP('127.1.2.3'), true);
  assert.equal(isPrivateOrBlockedIP('::1'), true);

  // Link-local & AWS/GCP metadata
  assert.equal(isPrivateOrBlockedIP('169.254.169.254'), true);
  assert.equal(isPrivateOrBlockedIP('169.254.1.1'), true);
  assert.equal(isPrivateOrBlockedIP('fe80::1'), true);

  // Private RFC 1918
  assert.equal(isPrivateOrBlockedIP('10.0.0.1'), true);
  assert.equal(isPrivateOrBlockedIP('10.255.255.255'), true);
  assert.equal(isPrivateOrBlockedIP('172.16.0.1'), true);
  assert.equal(isPrivateOrBlockedIP('172.31.255.254'), true);
  assert.equal(isPrivateOrBlockedIP('192.168.0.1'), true);
  assert.equal(isPrivateOrBlockedIP('192.168.100.50'), true);

  // IPv4-mapped IPv6
  assert.equal(isPrivateOrBlockedIP('::ffff:127.0.0.1'), true);
  assert.equal(isPrivateOrBlockedIP('::ffff:169.254.169.254'), true);
  assert.equal(isPrivateOrBlockedIP('::ffff:10.1.1.1'), true);

  // Valid public IPs should NOT be blocked
  assert.equal(isPrivateOrBlockedIP('8.8.8.8'), false);
  assert.equal(isPrivateOrBlockedIP('1.1.1.1'), false);
  assert.equal(isPrivateOrBlockedIP('93.184.216.34'), false);
});

test('validateSafeUrl rejects localhost, file protocols, and private literals', async () => {
  assert.equal((await validateSafeUrl('http://localhost:3000')).safe, false);
  assert.equal((await validateSafeUrl('http://127.0.0.1:8080/secret')).safe, false);
  assert.equal((await validateSafeUrl('http://169.254.169.254/latest/meta-data')).safe, false);
  assert.equal((await validateSafeUrl('file:///etc/passwd')).safe, false);
  assert.equal((await validateSafeUrl('ftp://private.internal')).safe, false);
});

test('Contact extraction accurately extracts emails and phones with source provenance', () => {
  const sampleHtml = `
    <html>
      <body>
        <p>Contact our admissions team at <a href="mailto:admissions@springfield-academy.edu">admissions@springfield-academy.edu</a></p>
        <p>Main reception: <a href="tel:+15551234567">+1 (555) 123-4567</a></p>
        <p>Inquiries: info@springfield-academy.edu</p>
        <img src="logo.png" alt="logo@banner.png" />
      </body>
    </html>
  `;

  const sourceUrl = 'https://springfield-academy.edu/contact';
  const emails = extractEmails(sampleHtml, sourceUrl);
  const phones = extractPhones(sampleHtml, sourceUrl);

  assert.equal(emails.length, 2);
  const admEmail = emails.find((e) => e.value === 'admissions@springfield-academy.edu');
  assert.ok(admEmail);
  assert.equal(admEmail.source_url, sourceUrl);
  assert.equal(admEmail.label, 'Admissions');

  // Verify junk image extension was not extracted as email
  assert.equal(emails.some((e) => e.value.includes('.png')), false);

  assert.equal(phones.length, 1);
  assert.equal(phones[0].value, '+15551234567');
  assert.equal(phones[0].source_url, sourceUrl);
});

test('Missing website features are recorded honestly as NOT_OBSERVED, not claims of absence', async () => {
  // Test with no website provided
  const noSiteResult = await inspectInstitutionWebsite('');
  assert.equal(noSiteResult.website_state, 'NOT_FOUND');
  assert.equal(noSiteResult.evidence[0].status, 'NOT_OBSERVED');
  assert.match(noSiteResult.evidence[0].evidence_snippet, /did not contain an active official URL/i);
});

test('Subpage discovery prioritizes admissions and contact pages on the same domain', () => {
  const html = `
    <a href="/admissions/apply">Apply Now</a>
    <a href="/contact-us">Contact</a>
    <a href="https://external-service.com/login">Portal</a>
    <a href="/about-our-school">About</a>
  `;
  const subPages = discoverRelevantSubPages(html, 'https://school.edu');
  assert.ok(subPages.includes('https://school.edu/admissions/apply'));
  assert.ok(subPages.includes('https://school.edu/contact-us'));
  assert.equal(subPages.some((p) => p.includes('external-service.com')), false);
});
