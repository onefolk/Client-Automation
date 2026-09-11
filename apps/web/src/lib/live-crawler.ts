export interface LiveCrawlResult {
  url: string;
  is_reachable: boolean;
  status_code: number;
  has_ssl: boolean;
  load_time_ms: number;
  title?: string;
  meta_description?: string;
  is_mobile_friendly: boolean;
  has_lead_form: boolean;
  has_booking_system: boolean;
  has_clear_cta: boolean;
  has_whatsapp: boolean;
  emails: string[];
  phones: string[];
  social_links: { platform: string; url: string }[];
  technologies: { category: string; name: string; evidence: string }[];
}

export async function crawlWebsiteLive(targetUrl: string): Promise<LiveCrawlResult> {
  const startTime = Date.now();
  let normalizedUrl = targetUrl.trim();
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  const has_ssl = normalizedUrl.startsWith('https://');

  try {
    const controller = new AbortController();
    // Fast 1200ms timeout for non-blocking stream execution
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    const resp = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OneFolkBot/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);
    const load_time_ms = Date.now() - startTime;
    const status_code = resp.status;
    const is_reachable = resp.ok || (status_code >= 200 && status_code < 400);

    const html = await resp.text();
    const lowerHtml = html.toLowerCase();

    // 1. Meta Title & Description
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
    const meta_description = descMatch ? descMatch[1].trim() : undefined;

    const is_mobile_friendly = lowerHtml.includes('name="viewport"') || lowerHtml.includes("name='viewport'");

    // 2. Real Email Extraction
    const emails: string[] = [];
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const foundEmails = html.match(emailRegex) || [];
    for (const em of foundEmails) {
      const clean = em.toLowerCase();
      if (
        !clean.endsWith('.png') &&
        !clean.endsWith('.jpg') &&
        !clean.endsWith('.svg') &&
        !clean.endsWith('.webp') &&
        !clean.includes('wixpress') &&
        !clean.includes('sentry') &&
        !clean.includes('schema.org') &&
        !emails.includes(clean)
      ) {
        emails.push(clean);
      }
    }

    // 3. Real Phone Extraction
    const phones: string[] = [];
    const telMatches = html.match(/href=["']tel:([^"']+)["']/gi) || [];
    for (const m of telMatches) {
      const p = m.replace(/href=["']tel:/i, '').replace(/["']/g, '').trim();
      if (p && !phones.includes(p)) {
        phones.push(p);
      }
    }

    // 4. Real Social Links
    const social_links: { platform: string; url: string }[] = [];
    const socialPatterns = [
      { platform: 'Instagram', regex: /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.-]+)["']/gi },
      { platform: 'Threads', regex: /href=["'](https?:\/\/(?:www\.)?threads\.net\/@[a-zA-Z0-9_.-]+)["']/gi },
      { platform: 'Reddit', regex: /href=["'](https?:\/\/(?:www\.)?reddit\.com\/(?:r|user)\/[a-zA-Z0-9_.-]+)["']/gi },
      { platform: 'Facebook', regex: /href=["'](https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9_.-]+)["']/gi },
      { platform: 'LinkedIn', regex: /href=["'](https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9_.-]+)["']/gi },
      { platform: 'TikTok', regex: /href=["'](https?:\/\/(?:www\.)?tiktok\.com\/@[a-zA-Z0-9_.-]+)["']/gi },
      { platform: 'YouTube', regex: /href=["'](https?:\/\/(?:www\.)?youtube\.com\/(?:c\/|@)?[a-zA-Z0-9_.-]+)["']/gi },
      { platform: 'X / Twitter', regex: /href=["'](https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_.-]+)["']/gi },
    ];

    for (const sp of socialPatterns) {
      const matches = html.match(sp.regex) || [];
      for (const m of matches) {
        const u = m.replace(/href=["']/i, '').replace(/["']/g, '').trim();
        if (!social_links.some((s) => s.url === u)) {
          social_links.push({ platform: sp.platform, url: u });
        }
      }
    }

    // 5. Technology Fingerprinting
    const technologies: { category: string; name: string; evidence: string }[] = [];

    if (lowerHtml.includes('wp-content') || lowerHtml.includes('wp-includes')) {
      technologies.push({ category: 'CMS', name: 'WordPress', evidence: 'wp-content assets loaded' });
    }
    if (lowerHtml.includes('cdn.shopify.com')) {
      technologies.push({ category: 'Ecommerce', name: 'Shopify', evidence: 'Shopify CDN integration' });
    }
    if (lowerHtml.includes('__next') || lowerHtml.includes('/_next/')) {
      technologies.push({ category: 'Framework', name: 'Next.js', evidence: 'Next.js hydration artifacts' });
    }
    if (lowerHtml.includes('wix.com') || lowerHtml.includes('wixsite')) {
      technologies.push({ category: 'CMS', name: 'Wix', evidence: 'Wix platform scripts' });
    }
    if (lowerHtml.includes('squarespace')) {
      technologies.push({ category: 'CMS', name: 'Squarespace', evidence: 'Squarespace engine' });
    }
    if (lowerHtml.includes('webflow')) {
      technologies.push({ category: 'CMS', name: 'Webflow', evidence: 'Webflow CSS/JS tags' });
    }

    if (lowerHtml.includes('googletagmanager.com') || lowerHtml.includes('gtag(')) {
      technologies.push({ category: 'Analytics', name: 'Google Tag Manager / GA4', evidence: 'GTM tracking code' });
    }
    if (lowerHtml.includes('fbq(') || lowerHtml.includes('connect.facebook.net')) {
      technologies.push({ category: 'Marketing', name: 'Meta Pixel', evidence: 'Facebook Pixel snippet' });
    }
    if (lowerHtml.includes('hotjar.com')) {
      technologies.push({ category: 'UX Analytics', name: 'Hotjar', evidence: 'Hotjar script tag' });
    }

    const has_whatsapp = lowerHtml.includes('wa.me') || lowerHtml.includes('api.whatsapp.com') || lowerHtml.includes('whatsapp');
    if (has_whatsapp) {
      technologies.push({ category: 'Messaging', name: 'WhatsApp Direct Chat', evidence: 'wa.me deep link detected' });
    }

    const has_booking_system =
      lowerHtml.includes('opentable') ||
      lowerHtml.includes('sevenrooms') ||
      lowerHtml.includes('resy.com') ||
      lowerHtml.includes('calendly.com') ||
      lowerHtml.includes('acuityscheduling') ||
      lowerHtml.includes('book-now') ||
      lowerHtml.includes('reservation');

    if (lowerHtml.includes('opentable')) {
      technologies.push({ category: 'Booking', name: 'OpenTable', evidence: 'OpenTable reservation widget' });
    } else if (lowerHtml.includes('sevenrooms')) {
      technologies.push({ category: 'Booking', name: 'SevenRooms', evidence: 'SevenRooms booking script' });
    }

    const has_lead_form = lowerHtml.includes('<form') && (lowerHtml.includes('type="email"') || lowerHtml.includes('name="email"'));
    const has_clear_cta = lowerHtml.includes('book now') || lowerHtml.includes('contact us') || lowerHtml.includes('get a quote') || lowerHtml.includes('order online');

    return {
      url: normalizedUrl,
      is_reachable,
      status_code,
      has_ssl,
      load_time_ms,
      title,
      meta_description,
      is_mobile_friendly,
      has_lead_form,
      has_booking_system,
      has_clear_cta,
      has_whatsapp,
      emails,
      phones,
      social_links,
      technologies,
    };
  } catch {
    const load_time_ms = Date.now() - startTime;
    return {
      url: normalizedUrl,
      is_reachable: false,
      status_code: 0,
      has_ssl,
      load_time_ms,
      is_mobile_friendly: true,
      has_lead_form: false,
      has_booking_system: false,
      has_clear_cta: false,
      has_whatsapp: false,
      emails: [],
      phones: [],
      social_links: [],
      technologies: [],
    };
  }
}
