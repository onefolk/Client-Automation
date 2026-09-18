/**
 * gap-detector.ts
 *
 * Pure TypeScript utility that reads an already-fetched BusinessProfile and:
 *  1. Detects 3 canonical digital gap signals
 *  2. Maps detected gaps → best-fit OneFolk service(s)
 *  3. Generates a hyper-personalised cold outreach subject + body
 *
 * Zero additional API calls — runs entirely on data already in the profile.
 */

import { BusinessProfile } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Gap Signal Types
// ─────────────────────────────────────────────────────────────────────────────

export type GapSignal = 'NO_WEBSITE' | 'WEAK_SOCIAL' | 'NO_BOOKING';

export interface DetectedGap {
  signal: GapSignal;
  label: string;
  evidence: string;
  severity: 'critical' | 'moderate';
}

export interface GapServiceMatch {
  serviceId: string;
  serviceName: string;
  serviceCategory: string;
  serviceTier: string;
  estimatedValue: string;
  pitchAngle: string;
}

export interface GapReport {
  hasGaps: boolean;
  detectedGaps: DetectedGap[];
  primaryService: GapServiceMatch;
  secondaryServices: GapServiceMatch[];
  combinedPitchAngle: string;
  personalizedSubject: string;
  personalizedBody: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Service Registry Mirror
// ─────────────────────────────────────────────────────────────────────────────

interface ServiceDef {
  serviceId: string;
  name: string;
  category: string;
  tier: string;
  estimatedValue: string;
}

const SERVICE_REGISTRY: Record<string, ServiceDef> = {
  srv_web_architecture: {
    serviceId: 'srv_web_architecture',
    name: 'High-Performance Next.js Web Experience',
    category: 'Tech & Growth',
    tier: 'ENTERPRISE',
    estimatedValue: '$6,000 – $18,000',
  },
  srv_ai_automation: {
    serviceId: 'srv_ai_automation',
    name: 'AI Receptionist & WhatsApp Workflow Automation',
    category: 'AI & Automation',
    tier: 'GROWTH',
    estimatedValue: '$3,000 – $8,500',
  },
  srv_media_branding: {
    serviceId: 'srv_media_branding',
    name: 'High-End Video Production & Brand Identity',
    category: 'Media Production',
    tier: 'GROWTH',
    estimatedValue: '$5,000 – $20,000',
  },
  srv_seo_growth: {
    serviceId: 'srv_seo_growth',
    name: 'Autonomous Technical SEO & Search Authority',
    category: 'Content & Marketing',
    tier: 'GROWTH',
    estimatedValue: '$2,500 – $6,000/mo',
  },
  srv_crm_automation: {
    serviceId: 'srv_crm_automation',
    name: 'Omnichannel CRM & Automated Lead Nurture Pipeline',
    category: 'Tech & Growth',
    tier: 'ENTERPRISE',
    estimatedValue: '$5,000 – $14,000',
  },
};

// Booking platform fingerprints
const BOOKING_TECH_PATTERNS = [
  'opentable', 'sevenrooms', 'resy', 'calendly', 'acuity', 'fresha',
  'mindbody', 'squareup', 'booksy', 'vagaro', 'simplybook', 'timely',
  'setmore', 'bookingkit', 'rezdy', 'reservation', 'booking',
];

const BOOKING_URL_PATTERNS = [
  '/book', '/reserve', '/booking', '/reservation', '/appointment',
  '/schedule', '/slots',
];

// ─────────────────────────────────────────────────────────────────────────────
// 1. Gap Detection
// ─────────────────────────────────────────────────────────────────────────────

function detectNoWebsite(profile: BusinessProfile): DetectedGap | null {
  if (!profile.last_enriched_at) return null;
  if (profile.has_website && profile.website) return null;
  return {
    signal: 'NO_WEBSITE',
    label: 'No Website',
    evidence: profile.website
      ? 'Website unreachable or unverified'
      : 'No web presence detected across all crawled sources',
    severity: 'critical',
  };
}

function detectWeakSocial(profile: BusinessProfile): DetectedGap | null {
  if (!profile.social_profiles) return null;
  const socials = profile.social_profiles ?? [];

  if (socials.length === 0) {
    return {
      signal: 'WEAK_SOCIAL',
      label: 'No Social Presence',
      evidence: 'Zero social profiles discovered across Instagram, Facebook, LinkedIn',
      severity: 'critical',
    };
  }

  const instagram = socials.find((s) => s.platform.toLowerCase() === 'instagram');

  if (!instagram) {
    return {
      signal: 'WEAK_SOCIAL',
      label: 'No Instagram Presence',
      evidence: 'Instagram profile not found — highest-reach platform for local discovery is absent',
      severity: 'moderate',
    };
  }

  const followers = instagram.follower_count;
  if (followers !== undefined && followers < 500) {
    return {
      signal: 'WEAK_SOCIAL',
      label: 'Weak Instagram Presence',
      evidence: `Instagram @${instagram.handle ?? profile.slug} has only ${followers.toLocaleString()} followers — below viable engagement threshold`,
      severity: 'moderate',
    };
  }

  if (instagram.last_posted_at) {
    const daysSincePost =
      (Date.now() - new Date(instagram.last_posted_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSincePost > 90) {
      return {
        signal: 'WEAK_SOCIAL',
        label: 'Dormant Instagram',
        evidence: `Last Instagram post was ${Math.round(daysSincePost)} days ago — algorithm deprioritises inactive accounts`,
        severity: 'moderate',
      };
    }
  }

  if (instagram.is_active === false) {
    return {
      signal: 'WEAK_SOCIAL',
      label: 'Inactive Instagram Account',
      evidence: `Instagram @${instagram.handle ?? profile.slug} marked inactive`,
      severity: 'moderate',
    };
  }

  return null;
}

function detectNoBooking(profile: BusinessProfile): DetectedGap | null {
  const audit = profile.facts?.find((fact) => fact.key === 'website_features' && fact.verified);
  if (audit?.value?.has_booking_system !== false) return null;
  const techs = profile.technologies ?? [];
  const websiteUrl = (profile.website ?? '').toLowerCase();

  const bookingTechFound = techs.some((t) => {
    const techName = t.name.toLowerCase();
    const techCategory = t.category.toLowerCase();
    return (
      techCategory === 'booking' ||
      BOOKING_TECH_PATTERNS.some((p) => techName.includes(p))
    );
  });

  if (bookingTechFound) return null;

  const bookingUrlFound = BOOKING_URL_PATTERNS.some((p) => websiteUrl.includes(p));
  if (bookingUrlFound) return null;

  const techNames =
    techs.length > 0
      ? techs.slice(0, 3).map((t) => t.name).join(', ')
      : 'none detected';

  return {
    signal: 'NO_BOOKING',
    label: 'Booking Not Detected on Homepage',
    evidence: `Homepage audit found no recognized booking/scheduling platform (detected technologies: ${techNames}). Other pages may provide booking.`,
    severity: 'critical',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Gap → Service Mapping
// ─────────────────────────────────────────────────────────────────────────────

interface ServiceMapping {
  primary: string;
  secondary: string[];
  pitchAngles: Partial<Record<string, string>>;
}

function resolveServiceMapping(gaps: GapSignal[]): ServiceMapping {
  const has = (g: GapSignal) => gaps.includes(g);

  if (has('NO_WEBSITE') && has('WEAK_SOCIAL') && has('NO_BOOKING')) {
    return {
      primary: 'srv_web_architecture',
      secondary: ['srv_ai_automation', 'srv_media_branding'],
      pitchAngles: {
        srv_web_architecture: 'Build their digital foundation — website, booking funnel, SEO-ready structure — from scratch',
        srv_ai_automation: 'Layer 24/7 AI booking and WhatsApp automation once the web foundation is live',
        srv_media_branding: 'Establish Instagram presence with cinematic brand content to drive inbound discovery',
      },
    };
  }

  if (has('NO_WEBSITE') && has('NO_BOOKING')) {
    return {
      primary: 'srv_web_architecture',
      secondary: ['srv_ai_automation'],
      pitchAngles: {
        srv_web_architecture: 'Deploy a conversion-optimised site with an embedded direct booking funnel — replacing phone-only inquiry',
        srv_ai_automation: 'Add AI WhatsApp booking automation to capture after-hours and high-intent leads instantly',
      },
    };
  }

  if (has('NO_WEBSITE') && has('WEAK_SOCIAL')) {
    return {
      primary: 'srv_web_architecture',
      secondary: ['srv_media_branding', 'srv_seo_growth'],
      pitchAngles: {
        srv_web_architecture: 'Create a high-converting web presence to anchor their digital footprint and capture search traffic',
        srv_media_branding: 'Launch Instagram growth with cinematic content that drives organic discovery and brand trust',
        srv_seo_growth: 'Ensure the new site ranks for high-intent local search queries from day one',
      },
    };
  }

  if (has('WEAK_SOCIAL') && has('NO_BOOKING')) {
    return {
      primary: 'srv_ai_automation',
      secondary: ['srv_media_branding'],
      pitchAngles: {
        srv_ai_automation: 'Integrate a direct booking funnel + WhatsApp automation so every social follower can convert instantly',
        srv_media_branding: 'Build an Instagram content engine that grows followers and funnels them into the new booking system',
      },
    };
  }

  if (has('NO_WEBSITE')) {
    return {
      primary: 'srv_web_architecture',
      secondary: ['srv_seo_growth'],
      pitchAngles: {
        srv_web_architecture: 'Build a mobile-first, fast-loading site with direct booking and conversion funnels in 4 weeks',
        srv_seo_growth: 'Ensure the site ranks for every high-intent local search query from launch day',
      },
    };
  }

  if (has('WEAK_SOCIAL')) {
    return {
      primary: 'srv_media_branding',
      secondary: ['srv_seo_growth'],
      pitchAngles: {
        srv_media_branding: 'Deliver a cinematic brand content series that grows Instagram from under 500 to 5k+ engaged followers',
        srv_seo_growth: 'Amplify social reach with technical SEO so content is discoverable beyond Instagram',
      },
    };
  }

  if (has('NO_BOOKING')) {
    return {
      primary: 'srv_web_architecture',
      secondary: ['srv_ai_automation'],
      pitchAngles: {
        srv_web_architecture: 'Embed a frictionless direct booking funnel into the existing website — zero third-party commissions',
        srv_ai_automation: 'Add AI WhatsApp booking so customers can self-serve 24/7 without staff intervention',
      },
    };
  }

  // No gaps — healthy upsell
  return {
    primary: 'srv_crm_automation',
    secondary: ['srv_seo_growth'],
    pitchAngles: {
      srv_crm_automation: 'Maximise revenue from existing traffic with automated CRM lead nurture and retention pipelines',
      srv_seo_growth: 'Compound organic reach with technical SEO to capture more high-intent search traffic',
    },
  };
}

function buildServiceMatch(
  serviceId: string,
  pitchAngles: Partial<Record<string, string>>
): GapServiceMatch {
  const svc = SERVICE_REGISTRY[serviceId] ?? {
    serviceId,
    name: 'OneFolk Growth Solution',
    category: 'Tech & Growth',
    tier: 'GROWTH',
    estimatedValue: '$3,000 – $12,000',
  };
  return {
    serviceId: svc.serviceId,
    serviceName: svc.name,
    serviceCategory: svc.category,
    serviceTier: svc.tier,
    estimatedValue: svc.estimatedValue,
    pitchAngle: pitchAngles[serviceId] ?? svc.name,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Outreach Copy Generation
// ─────────────────────────────────────────────────────────────────────────────

function buildSubject(
  businessName: string,
  gaps: DetectedGap[],
  primaryService: GapServiceMatch
): string {
  if (gaps.length === 0) {
    return `Growth acceleration opportunity for ${businessName}`;
  }
  if (gaps.length === 1) {
    const g = gaps[0];
    if (g.signal === 'NO_WEBSITE') return `Quick note: ${businessName} has no website — here's the revenue impact`;
    if (g.signal === 'WEAK_SOCIAL') return `${businessName}'s Instagram reach — a quick growth observation`;
    if (g.signal === 'NO_BOOKING') return `A question about ${businessName}'s booking flow`;
  }
  return `${businessName} — 3-minute digital gap audit we ran on your business`;
}

function buildBody(
  profile: BusinessProfile,
  gaps: DetectedGap[],
  primaryService: GapServiceMatch,
  secondaryServices: GapServiceMatch[],
  combinedPitchAngle: string,
  monthlyLossEstimate?: number
): string {
  const name = profile.name;
  const city = profile.city ?? 'your area';
  const industry = profile.industry ?? 'local business';
  const rating = profile.rating;
  const reviewCount = profile.review_count ?? 0;
  const domain = profile.domain ?? 'your online presence';
  if (gaps.length === 0) {
    return `Hi ${name} team,\n\nI came across ${name} in ${city} and would like to learn more about your current digital workflow. We do not yet have enough evidence to identify specific gaps.\n\nWould you be open to a short conversation about your website, inquiries, and growth priorities?\n\nBest regards,\nAgency Growth Team | OneFolk Client Intelligence`;
  }

  const ratingLine =
    rating && rating > 0
      ? ` (we noted your ★ ${rating.toFixed(1)} rating across ${reviewCount} reviews — impressive reputation)`
      : '';

  const intro = `Hi ${name} team,\n\nI came across ${name} while auditing high-potential ${industry} businesses in ${city}${ratingLine}.\n`;

  let gapSection = '';
  if (gaps.length === 0) {
    gapSection = `When reviewing your digital presence, we identified a growth acceleration opportunity in automated lead capture and CRM pipeline optimisation.\n`;
  } else {
    const gapLines = gaps.map((g, i) => `  ${i + 1}. ${g.label}: ${g.evidence}`).join('\n');
    gapSection = `When auditing ${domain}, we identified the following digital gaps holding ${name} back:\n\n${gapLines}\n`;
  }

  const costLine =
    monthlyLossEstimate && monthlyLossEstimate > 0
      ? `Our illustrative scenario estimates $${monthlyLossEstimate.toLocaleString()}/month in potential impact. This is not measured revenue loss and needs validation with your operating data.\n\n`
      : `The business impact of these observations needs validation with your team.\n\n`;

  const serviceSection =
    `At OneFolk, we specialise in closing exactly these gaps. Based on your profile, the highest-ROI first step would be:\n\n` +
    `→ ${primaryService.serviceName} (${primaryService.serviceTier} | ${primaryService.estimatedValue})\n` +
    `   ${primaryService.pitchAngle}` +
    (secondaryServices.length > 0
      ? `\n\nNatural follow-on:\n` +
        secondaryServices
          .slice(0, 1)
          .map((s) => `→ ${s.serviceName} (${s.serviceTier} | ${s.estimatedValue})\n   ${s.pitchAngle}`)
          .join('\n')
      : '');

  const cta = `\n\nWould you have 10 minutes this week for a quick walkthrough of what this implementation looks like specifically for ${name}?\n\nBest regards,\nAgency Growth Team | OneFolk Client Intelligence`;

  return `${intro}\n${gapSection}\n${costLine}${serviceSection}${cta}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs the full gap detection pipeline on a BusinessProfile.
 *
 * @param profile - Already-fetched BusinessProfile (no additional API calls)
 * @param monthlyLossEstimate - Optional pre-computed monthly loss figure
 *   from the existing economics calculator on the page
 */
export function detectGaps(
  profile: BusinessProfile,
  monthlyLossEstimate?: number
): GapReport {
  const rawGaps = [
    detectNoWebsite(profile),
    detectWeakSocial(profile),
    detectNoBooking(profile),
  ];
  const detectedGaps = rawGaps.filter((g): g is DetectedGap => g !== null);
  const signals = detectedGaps.map((g) => g.signal);

  const mapping = resolveServiceMapping(signals);
  const primaryService = buildServiceMatch(mapping.primary, mapping.pitchAngles);
  const secondaryServices = mapping.secondary.map((sid) =>
    buildServiceMatch(sid, mapping.pitchAngles)
  );

  const combinedPitchAngle =
    detectedGaps.length === 0
      ? 'Growth & Retention Acceleration via CRM automation and SEO compounding'
      : detectedGaps.length === 1
      ? primaryService.pitchAngle
      : `Close ${detectedGaps.length} critical digital gaps (${detectedGaps.map((g) => g.label).join(', ')}) with a unified OneFolk growth stack`;

  const subject = buildSubject(profile.name, detectedGaps, primaryService);
  const body = buildBody(
    profile,
    detectedGaps,
    primaryService,
    secondaryServices,
    combinedPitchAngle,
    monthlyLossEstimate
  );

  return {
    hasGaps: detectedGaps.length > 0,
    detectedGaps,
    primaryService,
    secondaryServices,
    combinedPitchAngle,
    personalizedSubject: subject,
    personalizedBody: body,
  };
}
