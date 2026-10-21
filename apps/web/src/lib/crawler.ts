import dns from 'node:dns/promises';
import { WebsiteState, EvidenceStatus } from './institutional-types';

export interface ExtractedContact {
  type: 'email' | 'phone';
  value: string;
  label?: string;
  source_url: string;
  confidence: number;
  relevance_note?: string;
}

export interface ExtractedEvidence {
  signal_key: string;
  label: string;
  claim: string;
  status: EvidenceStatus;
  source_url: string;
  evidence_snippet?: string;
  confidence: number;
}

export interface CrawlInspectionResult {
  target_url: string;
  final_url?: string;
  website_state: WebsiteState;
  http_status?: number;
  error_message?: string;
  title?: string;
  meta_description?: string;
  pages_crawled: string[];
  contacts: ExtractedContact[];
  evidence: ExtractedEvidence[];
  observed_opportunities: string[];
}

/**
 * Validates IP addresses to prevent SSRF against loopback, link-local,
 * private networks (RFC 1918), and reserved ranges.
 */
export function isPrivateOrBlockedIP(ip: string): boolean {
  const clean = ip.trim().toLowerCase();

  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
  if (clean.startsWith('::ffff:')) {
    return isPrivateOrBlockedIP(clean.substring(7));
  }

  // IPv6 checks
  if (clean === '::1' || clean === '::' || clean.startsWith('fe80:') || clean.startsWith('fc') || clean.startsWith('fd')) {
    return true;
  }

  // IPv4 checks
  const parts = clean.split('.').map((p) => parseInt(p, 10));
  if (parts.length === 4 && parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 (Loopback)
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (Link-local / AWS metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a >= 224) return true; // Multicast / Class E
  }

  return false;
}

/**
 * Validates URL scheme, resolves host via DNS, and blocks SSRF targets.
 */
export async function validateSafeUrl(urlString: string): Promise<{ safe: boolean; error?: string; parsedUrl?: URL }> {
  let parsed: URL;
  try {
    const candidate = urlString.trim().startsWith('http://') || urlString.trim().startsWith('https://')
      ? urlString.trim()
      : `https://${urlString.trim()}`;
    parsed = new URL(candidate);
  } catch {
    return { safe: false, error: 'Malformed URL format' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, error: `Blocked forbidden protocol: ${parsed.protocol}` };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local')
  ) {
    return { safe: false, error: 'SSRF Protection: Blocked local hostname' };
  }

  // Check if hostname is directly an IP literal
  if (isPrivateOrBlockedIP(hostname)) {
    return { safe: false, error: 'SSRF Protection: Blocked private or link-local IP' };
  }

  // Resolve hostname via DNS to ensure it does not resolve to private/internal IPs
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    for (const record of addresses) {
      if (isPrivateOrBlockedIP(record.address)) {
        return {
          safe: false,
          error: `SSRF Protection: Domain resolves to forbidden address (${record.address})`,
        };
      }
    }
  } catch (err: any) {
    return { safe: false, error: `DNS lookup failed for ${hostname}: ${err.message}` };
  }

  return { safe: true, parsedUrl: parsed };
}

/**
 * Safe fetch with SSRF pre-check, bounded timeout, bounded response size,
 * and safe manual redirect following (up to 3 hops).
 */
export async function fetchSafePage(
  urlString: string,
  maxHops = 3,
  maxBytes = 1048576 // 1MB
): Promise<{ ok: boolean; status: number; finalUrl: string; html: string; error?: string }> {
  let currentUrl = urlString;

  for (let hop = 0; hop <= maxHops; hop++) {
    const validation = await validateSafeUrl(currentUrl);
    if (!validation.safe || !validation.parsedUrl) {
      return { ok: false, status: 0, finalUrl: currentUrl, html: '', error: validation.error };
    }

    try {
      const response = await fetch(validation.parsedUrl.href, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
        headers: {
          'User-Agent': 'OneFolkInstitutionalResearch/1.0 (+https://onefolk.ai; research@onefolk.ai)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.8',
        },
      });

      // Handle redirects with re-validation on every hop
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          return { ok: false, status: response.status, finalUrl: currentUrl, html: '', error: 'Redirect missing location header' };
        }
        const nextUrl = new URL(location, currentUrl).href;
        currentUrl = nextUrl;
        continue;
      }

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          finalUrl: currentUrl,
          html: '',
          error: `HTTP error ${response.status}`,
        };
      }

      // Bounded body read (prevent memory exhaustion)
      const reader = response.body?.getReader();
      if (!reader) {
        const text = await response.text();
        return { ok: true, status: response.status, finalUrl: currentUrl, html: text.slice(0, maxBytes) };
      }

      let receivedBytes = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          receivedBytes += value.length;
          if (receivedBytes >= maxBytes) {
            await reader.cancel();
            break;
          }
        }
      }

      const totalBuffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      const html = totalBuffer.toString('utf-8');
      return { ok: true, status: response.status, finalUrl: currentUrl, html };
    } catch (err: any) {
      return { ok: false, status: 0, finalUrl: currentUrl, html: '', error: err.message || 'Fetch error' };
    }
  }

  return { ok: false, status: 0, finalUrl: currentUrl, html: '', error: 'Too many redirects' };
}

/**
 * Extracts public institutional emails with syntax validation and junk filtering.
 * Contacts are explicitly labeled unverified (verified = false).
 */
export function extractEmails(html: string, sourceUrl: string): ExtractedContact[] {
  const result: ExtractedContact[] = [];
  const seen = new Set<string>();

  // 1. mailto: matches
  const mailtoMatches = Array.from(html.matchAll(/href=["']mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})[^"']*["']/gi));
  for (const match of mailtoMatches) {
    const email = match[1].toLowerCase().trim();
    if (isValidInstitutionalEmail(email) && !seen.has(email)) {
      seen.add(email);
      result.push({
        type: 'email',
        value: email,
        label: classifyEmailRole(email),
        source_url: sourceUrl,
        confidence: 0.9,
        relevance_note: 'Found in mailto: link',
      });
    }
  }

  // 2. Body regex matches
  const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
  const rawMatches = html.match(emailRegex) || [];
  for (const m of rawMatches) {
    const email = m.toLowerCase().trim();
    if (isValidInstitutionalEmail(email) && !seen.has(email)) {
      seen.add(email);
      result.push({
        type: 'email',
        value: email,
        label: classifyEmailRole(email),
        source_url: sourceUrl,
        confidence: 0.7,
        relevance_note: 'Found in page body text',
      });
    }
  }

  return result;
}

function isValidInstitutionalEmail(email: string): boolean {
  if (email.length > 100) return false;
  const junkExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.css', '.js'];
  if (junkExtensions.some((ext) => email.endsWith(ext))) return false;

  const junkDomains = ['example.com', 'domain.com', 'sentry.io', 'wixpress.com', 'schema.org', 'w3.org'];
  if (junkDomains.some((d) => email.includes(d))) return false;

  return true;
}

function classifyEmailRole(email: string): string {
  const lower = email.toLowerCase();
  if (lower.startsWith('admission') || lower.includes('enrol')) return 'Admissions';
  if (lower.startsWith('principal') || lower.startsWith('head') || lower.startsWith('director')) return 'Leadership';
  if (lower.startsWith('registrar') || lower.startsWith('records')) return 'Registrar';
  if (lower.startsWith('info') || lower.startsWith('enquir') || lower.startsWith('contact') || lower.startsWith('office')) return 'General Inquiries';
  return 'Institutional Contact';
}

/**
 * Extracts public telephone numbers with source provenance.
 */
export function extractPhones(html: string, sourceUrl: string): ExtractedContact[] {
  const result: ExtractedContact[] = [];
  const seen = new Set<string>();

  // 1. tel: links
  const telMatches = Array.from(html.matchAll(/href=["']tel:([^"']+)["']/gi));
  for (const m of telMatches) {
    const raw = m[1].trim();
    const clean = raw.replace(/[^\d+()\-\s]/g, '').trim();
    if (clean.length >= 7 && !seen.has(clean)) {
      seen.add(clean);
      result.push({
        type: 'phone',
        value: clean,
        label: 'Institutional Phone',
        source_url: sourceUrl,
        confidence: 0.9,
        relevance_note: 'Found in tel: link',
      });
    }
  }

  return result;
}

/**
 * Discovers sub-page candidates (contact, admissions, about, prospectus) from HTML.
 */
export function discoverRelevantSubPages(html: string, baseUrl: string, limit = 2): string[] {
  const candidates: { url: string; priority: number }[] = [];
  const seen = new Set<string>();
  const baseHostname = new URL(baseUrl).hostname.toLowerCase();

  const linkRegex = /href=["']([^"'#\s]+)["']/gi;
  for (const match of Array.from(html.matchAll(linkRegex))) {
    const rawHref = match[1].trim();
    if (!rawHref || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
      continue;
    }

    try {
      const resolved = new URL(rawHref, baseUrl);
      // Stay on the same hostname or direct subdomain
      if (resolved.hostname.toLowerCase() !== baseHostname && !resolved.hostname.toLowerCase().endsWith(`.${baseHostname}`)) {
        continue;
      }

      const cleanUrl = resolved.origin + resolved.pathname;
      if (cleanUrl === baseUrl || seen.has(cleanUrl)) continue;

      const path = resolved.pathname.toLowerCase();
      let priority = 0;
      if (path.includes('admission') || path.includes('apply') || path.includes('enrol')) priority = 10;
      else if (path.includes('contact') || path.includes('reach-us')) priority = 9;
      else if (path.includes('prospectus') || path.includes('course') || path.includes('program')) priority = 7;
      else if (path.includes('about')) priority = 5;

      if (priority > 0) {
        seen.add(cleanUrl);
        candidates.push({ url: cleanUrl, priority });
      }
    } catch {
      // ignore invalid URLs
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);
  return candidates.slice(0, limit).map((c) => c.url);
}

/**
 * Audits institutional digital capabilities with honest evidence collection.
 * Missing homepage features are recorded as NOT_OBSERVED, never assumed absent.
 */
export async function inspectInstitutionWebsite(websiteUrl?: string): Promise<CrawlInspectionResult> {
  const now = new Date().toISOString();

  if (!websiteUrl || !websiteUrl.trim()) {
    return {
      target_url: '',
      website_state: 'NOT_FOUND',
      error_message: 'No official website provided or identified during initial research',
      pages_crawled: [],
      contacts: [],
      evidence: [
        {
          signal_key: 'website_presence',
          label: 'Official Website Presence',
          claim: 'No website URL on record',
          status: 'NOT_OBSERVED',
          source_url: '',
          evidence_snippet: 'Institution list record did not contain an active official URL.',
          confidence: 1.0,
        },
      ],
      observed_opportunities: ['Establish official digital footprint and institutional landing page'],
    };
  }

  const cleanUrl = websiteUrl.trim();
  const mainFetch = await fetchSafePage(cleanUrl);

  if (!mainFetch.ok) {
    return {
      target_url: cleanUrl,
      website_state: 'UNREACHABLE',
      http_status: mainFetch.status,
      error_message: mainFetch.error || 'Server unreachable or refused connection',
      pages_crawled: [cleanUrl],
      contacts: [],
      evidence: [
        {
          signal_key: 'website_reachability',
          label: 'Website Reachability',
          claim: 'Website failed to load or SSRF defense blocked destination',
          status: 'NOT_OBSERVED',
          source_url: cleanUrl,
          evidence_snippet: mainFetch.error,
          confidence: 0.9,
        },
      ],
      observed_opportunities: ['Resolve web server uptime and domain accessibility'],
    };
  }

  const pagesCrawled: string[] = [mainFetch.finalUrl];
  const allContacts: ExtractedContact[] = [];
  const allEvidence: ExtractedEvidence[] = [];
  const opportunities: string[] = [];

  // Extract metadata
  const titleMatch = mainFetch.html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : undefined;

  const descMatch = mainFetch.html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                    mainFetch.html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const metaDescription = descMatch ? descMatch[1].trim() : undefined;

  // 1. SSL evidence
  const isHttps = mainFetch.finalUrl.startsWith('https://');
  allEvidence.push({
    signal_key: 'ssl_encryption',
    label: 'HTTPS / SSL Configuration',
    claim: isHttps ? 'HTTPS connection established successfully' : 'Plain HTTP connection observed',
    status: isHttps ? 'DETECTED' : 'NOT_OBSERVED',
    source_url: mainFetch.finalUrl,
    evidence_snippet: `Final resolved URL: ${mainFetch.finalUrl}`,
    confidence: 1.0,
  });
  if (!isHttps) {
    opportunities.push('Deploy SSL certificate for institutional compliance and data security');
  }

  // 2. Mobile Viewport evidence
  const lowerHtml = mainFetch.html.toLowerCase();
  const hasViewport = lowerHtml.includes('name="viewport"') || lowerHtml.includes("name='viewport'");
  allEvidence.push({
    signal_key: 'mobile_viewport',
    label: 'Mobile Viewport Tag',
    claim: hasViewport ? 'Mobile viewport declaration found' : 'Viewport meta tag not observed in homepage header',
    status: hasViewport ? 'DETECTED' : 'NOT_OBSERVED',
    source_url: mainFetch.finalUrl,
    evidence_snippet: hasViewport ? '<meta name="viewport" ...>' : 'No viewport meta tag detected in initial HTML',
    confidence: 0.9,
  });
  if (!hasViewport) {
    opportunities.push('Optimize institutional portal for mobile student & parent devices');
  }

  // Extract homepage contacts
  allContacts.push(...extractEmails(mainFetch.html, mainFetch.finalUrl));
  allContacts.push(...extractPhones(mainFetch.html, mainFetch.finalUrl));

  // Discover & inspect up to 2 sub-pages (Contact, Admissions)
  const subPages = discoverRelevantSubPages(mainFetch.html, mainFetch.finalUrl, 2);
  let combinedSubHtml = '';

  for (const subUrl of subPages) {
    const subFetch = await fetchSafePage(subUrl);
    if (subFetch.ok) {
      pagesCrawled.push(subFetch.finalUrl);
      combinedSubHtml += ' ' + subFetch.html;
      allContacts.push(...extractEmails(subFetch.html, subFetch.finalUrl));
      allContacts.push(...extractPhones(subFetch.html, subFetch.finalUrl));
    }
  }

  const fullText = (mainFetch.html + ' ' + combinedSubHtml).toLowerCase();

  // 3. Digital Admissions / Inquiry Flow
  const hasInquiryFlow =
    fullText.includes('apply online') ||
    fullText.includes('admission form') ||
    fullText.includes('online application') ||
    fullText.includes('admissions portal') ||
    fullText.includes('enquiry form') ||
    fullText.includes('register for admission');

  allEvidence.push({
    signal_key: 'digital_admissions',
    label: 'Digital Admissions / Online Inquiry Portal',
    claim: hasInquiryFlow
      ? 'Online application or inquiry portal link observed'
      : 'Online application form not observed on inspected public pages',
    status: hasInquiryFlow ? 'DETECTED' : 'NOT_OBSERVED',
    source_url: mainFetch.finalUrl,
    evidence_snippet: hasInquiryFlow
      ? 'Identified digital admission terms on inspected pages'
      : 'Not observed on homepage or linked admissions/contact pages; manual verification recommended',
    confidence: hasInquiryFlow ? 0.85 : 0.6,
  });
  if (!hasInquiryFlow) {
    opportunities.push('Introduce direct digital student inquiry & enrollment workflow');
  }

  // 4. Digital Prospectus / Course Catalog
  const hasProspectus =
    fullText.includes('download prospectus') ||
    fullText.includes('view prospectus') ||
    fullText.includes('course catalog') ||
    fullText.includes('academic prospectus');

  allEvidence.push({
    signal_key: 'digital_prospectus',
    label: 'Digital Prospectus / Curriculum Catalog',
    claim: hasProspectus
      ? 'Digital prospectus download or viewing option observed'
      : 'Prospectus download link not observed on inspected pages',
    status: hasProspectus ? 'DETECTED' : 'NOT_OBSERVED',
    source_url: mainFetch.finalUrl,
    evidence_snippet: hasProspectus ? 'Prospectus link found' : 'Not observed on initial crawl',
    confidence: hasProspectus ? 0.8 : 0.6,
  });

  // Deduplicate contacts
  const uniqueContacts: ExtractedContact[] = [];
  const seenContact = new Set<string>();
  for (const c of allContacts) {
    const key = `${c.type}:${c.value.toLowerCase()}`;
    if (!seenContact.has(key)) {
      seenContact.add(key);
      uniqueContacts.push(c);
    }
  }

  return {
    target_url: cleanUrl,
    final_url: mainFetch.finalUrl,
    website_state: 'VERIFIED_PRESENT',
    http_status: mainFetch.status,
    title,
    meta_description: metaDescription,
    pages_crawled: pagesCrawled,
    contacts: uniqueContacts,
    evidence: allEvidence,
    observed_opportunities: opportunities,
  };
}
