import {
  OneFolkServiceDef,
  OpportunityDef,
  ResourceDef,
  SearchFilters,
  SearchIntent,
  IntentType,
} from './types';

export const DEFAULT_SERVICES: OneFolkServiceDef[] = [
  {
    service_id: 'srv_web_architecture',
    name: 'High-Converting Web Architecture & Headless Digital Systems',
    description: 'Bespoke high-performance web platforms, sub-second load times, and conversion rate optimization.',
    category: 'Web & Mobile',
    capabilities: ['Next.js / React', 'Conversion Architecture', 'Mobile-First UX', 'Edge Rendering'],
    target_signals: ['no_ssl', 'slow_load_time', 'unresponsive_mobile', 'poor_cta'],
    qualification_signals: ['high_traffic', 'active_reputation'],
    negative_signals: ['modern_framework_detected'],
    recommended_evidence: ['Mobile page speed < 50', 'No SSL or outdated template builder'],
    service_tier: 'ENTERPRISE',
    estimated_value: '$6,000 - $18,000',
  },
  {
    service_id: 'srv_erp_portal',
    name: 'Custom Cloud ERP & Unified Digital Portal',
    description: 'Centralized administrative ERP, client/student portals, and automated digital operations.',
    category: 'Tech & Growth',
    capabilities: ['Cloud ERP', 'Client Portals', 'Payment Gateways', 'Administrative Systems'],
    target_signals: ['missing_portal', 'disconnected_admin'],
    qualification_signals: ['institutional_scale', 'high_headcount'],
    negative_signals: ['enterprise_erp_active'],
    recommended_evidence: ['No active administrative portal found'],
    service_tier: 'ENTERPRISE',
    estimated_value: '$15,000 - $45,000',
  },
  {
    service_id: 'srv_crm_automation',
    name: 'Omnichannel CRM & Automated Lead Nurture Pipeline',
    description: 'End-to-end lead routing, speed-to-lead automation, and CRM lifecycle synchronization.',
    category: 'Tech & Growth',
    capabilities: ['HubSpot/Salesforce CRM', 'Lead Routing', 'WhatsApp API', 'Speed-to-Lead'],
    target_signals: ['no_crm_tracker', 'static_contact_form'],
    qualification_signals: ['active_leads', 'high_deal_size'],
    negative_signals: ['active_crm_stack'],
    recommended_evidence: ['Missing automated lead capture or tracking'],
    service_tier: 'ENTERPRISE',
    estimated_value: '$5,000 - $14,000',
  },
  {
    service_id: 'srv_ai_automation',
    name: 'AI Receptionist & WhatsApp Workflow Automation',
    description: '24/7 intelligent conversational booking, customer triage, and operational flow automation.',
    category: 'AI & Automation',
    capabilities: ['AI Voice/Chat Agents', 'WhatsApp Commerce', 'Automated Scheduling'],
    target_signals: ['manual_phone_only', 'no_instant_chat'],
    qualification_signals: ['high_inquiry_volume'],
    negative_signals: ['active_ai_agent'],
    recommended_evidence: ['Inquiries rely on static phone numbers without instant response'],
    service_tier: 'GROWTH',
    estimated_value: '$3,000 - $8,500',
  },
  {
    service_id: 'srv_seo_growth',
    name: 'Autonomous Technical SEO & Search Authority',
    description: 'Rich schema markup, high-intent ranking architecture, and algorithmic search visibility.',
    category: 'Content & Marketing',
    capabilities: ['Technical SEO', 'Schema JSON-LD', 'Local Visibility', 'Core Web Vitals'],
    target_signals: ['missing_schema', 'poor_meta', 'low_organic_ranking'],
    qualification_signals: ['high_search_demand'],
    negative_signals: ['perfect_schema_active'],
    recommended_evidence: ['Missing structured Schema.org markup', 'Poor mobile Core Web Vitals'],
    service_tier: 'GROWTH',
    estimated_value: '$2,500 - $6,000/mo',
  },
  {
    service_id: 'srv_media_branding',
    name: 'High-End Video Production & Brand Identity',
    description: 'Cinematic commercial video, creative visual identity, and premium brand storytelling.',
    category: 'Media Production',
    capabilities: ['Commercial Video', 'Brand Identity', 'Creative Direction'],
    target_signals: ['outdated_visuals', 'lack_of_video'],
    qualification_signals: ['high_ticket_clientele'],
    negative_signals: ['recent_cinematic_rebrand'],
    recommended_evidence: ['Visual presence lacks high-converting video and modern branding'],
    service_tier: 'GROWTH',
    estimated_value: '$5,000 - $20,000',
  },
];

export const DEFAULT_OPPORTUNITIES: OpportunityDef[] = [
  {
    opportunity_id: 'opp_erp',
    name: 'ERP & Administrative Portal Modernization',
    category: 'Enterprise Systems',
    keywords: ['erp', 'portal', 'lms', 'student portal', 'school management', 'sis', 'software'],
    target_entity_types: ['school', 'university', 'college', 'academy', 'institute', 'enterprise'],
    matching_service_ids: ['srv_erp_portal'],
    reason_template: '{entity_name} lacks an integrated modern administrative portal, creating operational friction.',
  },
  {
    opportunity_id: 'opp_booking',
    name: 'Direct Online Booking & Scheduling Funnel',
    category: 'Booking & Conversion',
    keywords: ['booking', 'reservation', 'appointment', 'scheduling', 'online booking', 'book'],
    target_entity_types: ['clinic', 'dental', 'restaurant', 'spa', 'salon', 'hotel', 'hospital'],
    matching_service_ids: ['srv_web_architecture', 'srv_ai_automation'],
    reason_template: '{entity_name} has no direct 24/7 online booking funnel, risking high-intent prospect drop-off.',
  },
  {
    opportunity_id: 'opp_crm',
    name: 'CRM Lead Automation & Pipeline Architecture',
    category: 'Sales & CRM',
    keywords: ['crm', 'lead', 'pipeline', 'inquiry', 'sales funnel', 'lead management'],
    target_entity_types: ['company', 'agency', 'real estate', 'law firm', 'b2b', 'broker'],
    matching_service_ids: ['srv_crm_automation'],
    reason_template: '{entity_name} lacks automated CRM capture, causing response delays and lost lead conversion.',
  },
  {
    opportunity_id: 'opp_seo',
    name: 'Technical SEO & Search Visibility Optimization',
    category: 'Search & Visibility',
    keywords: ['seo', 'poor seo', 'ranking', 'search visibility', 'google ranking', 'organic', 'keywords', 'backlinks'],
    target_entity_types: ['brand', 'ecommerce', 'retail', 'company', 'practice', 'store', 'shop'],
    matching_service_ids: ['srv_seo_growth'],
    reason_template: '{entity_name} has missing structured schema data and untapped search ranking authority.',
  },
  {
    opportunity_id: 'opp_automation',
    name: 'AI & Instant Messaging Workflow Automation',
    category: 'Operations & AI',
    keywords: ['automation', 'workflow', 'ai', 'whatsapp', 'chatbot', 'bot', 'speed-to-lead'],
    target_entity_types: ['business', 'company', 'clinic', 'firm', 'agency'],
    matching_service_ids: ['srv_ai_automation'],
    reason_template: '{entity_name} relies on manual communication workflows without automated AI or instant lead routing.',
  },
  {
    opportunity_id: 'opp_web',
    name: 'High-Converting Headless Web Architecture',
    category: 'Web & UX',
    keywords: ['website', 'web', 'redesign', 'landing page', 'mobile friendly', 'speed', 'ui', 'ux'],
    target_entity_types: ['business', 'brand', 'restaurant', 'firm', 'store'],
    matching_service_ids: ['srv_web_architecture'],
    reason_template: '{entity_name} has an unoptimized web presence with high potential for mobile conversion lift.',
  },
  {
    opportunity_id: 'opp_video_brand',
    name: 'Commercial Video & Brand Experience Elevation',
    category: 'Media & Brand',
    keywords: ['video', 'media', 'branding', 'rebrand', 'content', 'commercial', 'creative'],
    target_entity_types: ['hotel', 'luxury', 'resort', 'brand', 'agency', 'restaurant'],
    matching_service_ids: ['srv_media_branding'],
    reason_template: '{entity_name} has strong market positioning ready for cinematic commercial video and brand elevation.',
  },
];

export const DEFAULT_RESOURCES: ResourceDef[] = [
  {
    resource_id: 'live_public_registry',
    name: 'OpenStreetMap & Official Municipal Index',
    resource_type: 'PUBLIC_REGISTRY',
    supported_entity_types: ['*'],
    supported_industries: ['*'],
    geographic_coverage: ['Global'],
    discovery_support: true,
    research_support: true,
    reliability_score: 0.95,
  },
  {
    resource_id: 'live_web_search',
    name: 'Live Web Organic Search Index',
    resource_type: 'WEB_SEARCH',
    supported_entity_types: ['*'],
    supported_industries: ['*'],
    geographic_coverage: ['Global'],
    discovery_support: true,
    research_support: true,
    reliability_score: 0.92,
  },
  {
    resource_id: 'reddit_community',
    name: 'Reddit Local Community Mentions',
    resource_type: 'COMMUNITY_INDEX',
    supported_entity_types: ['*'],
    supported_industries: ['*'],
    geographic_coverage: ['Global'],
    discovery_support: true,
    research_support: true,
    reliability_score: 0.88,
  },
  {
    resource_id: 'threads_meta',
    name: 'Threads (@Meta) Brand Index',
    resource_type: 'SOCIAL_REGISTRY',
    supported_entity_types: ['*'],
    supported_industries: ['*'],
    geographic_coverage: ['Global'],
    discovery_support: true,
    research_support: true,
    reliability_score: 0.86,
  },
];

function capitalizeWords(str: string): string {
  return str
    .split(/\s+/)
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ')
    .trim();
}

export function parseSearchIntent(rawQuery: string, filters: SearchFilters = {}): SearchIntent {
  const trimmed = (rawQuery || '').trim();
  const lower = trimmed.toLowerCase();

  // 1. Detect Intent Type
  const vendorMarkers = [
    ' vendors', ' vendor', ' providers', ' provider', ' companies for ',
    ' company for ', ' agency for ', ' agencies for ', ' suppliers', ' supplier', ' consultants for ',
  ];
  const isVendorSearch = vendorMarkers.some((v) => lower.includes(v));
  const intentType: IntentType = isVendorSearch ? 'VENDOR_DISCOVERY' : 'CLIENT_DISCOVERY';

  // 2. Extract Location
  let location: string | undefined = filters.city || filters.location || filters.country;
  let queryWithoutLoc = lower;

  const locMatch = lower.match(/\s+(?:in|at|near)\s+([a-zA-Z\s,]+)$/i);
  if (locMatch && locMatch[1]) {
    const parsedLoc = locMatch[1].trim();
    if (!location) {
      location = capitalizeWords(parsedLoc);
    }
    queryWithoutLoc = lower.substring(0, locMatch.index).trim();
  }

  // 3. Decompose conditions and opportunity
  let cleanEntityQuery = queryWithoutLoc;
  let oppPhrase = '';
  const qualificationConditions: string[] = [];

  const conditionPrepositions: [string, string][] = [
    ['without ', 'Absence of required digital capability'],
    ['with no ', 'Absence of required digital capability'],
    ['with poor ', 'Unoptimized or legacy implementation'],
    ['needing ', 'Expressed demand for modernization'],
    ['needs ', 'Expressed demand for modernization'],
    ['lacking ', 'Absence of required digital capability'],
    ['looking for ', 'Active search for capability upgrade'],
    ['for ', 'Targeted opportunity domain'],
  ];

  for (const [prep, desc] of conditionPrepositions) {
    const idx = cleanEntityQuery.indexOf(prep);
    if (idx !== -1) {
      const before = cleanEntityQuery.substring(0, idx).trim();
      const after = cleanEntityQuery.substring(idx + prep.length).trim();
      if (before.length > 0) {
        cleanEntityQuery = before;
        oppPhrase = after;
        qualificationConditions.push(`${desc}: '${after}'`);
        break;
      }
    }
  }

  if (!oppPhrase) {
    oppPhrase = cleanEntityQuery;
  }

  // 4. Target Entity
  const targetEntityRaw = cleanEntityQuery.trim() || filters.business_type || 'Businesses';
  const targetEntity = capitalizeWords(targetEntityRaw);

  // 5. Match Opportunity Def
  let bestOpp: OpportunityDef | undefined;
  let maxScore = 0;

  for (const opp of DEFAULT_OPPORTUNITIES) {
    let score = 0;
    for (const kw of opp.keywords) {
      if (oppPhrase.includes(kw) || lower.includes(kw)) {
        score += kw.length * 2;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestOpp = opp;
    }
  }

  const matchedOpp = bestOpp || DEFAULT_OPPORTUNITIES[3]; // default SEO or general
  const opportunityType = matchedOpp.name;
  const opportunityId = matchedOpp.opportunity_id;
  const opportunityKeywords = matchedOpp.keywords;
  const matchedServiceIds = matchedOpp.matching_service_ids;

  // 6. Resolve Industry & Category
  let industry = filters.industry || '';
  let category = 'Commercial';

  const lowerEntity = targetEntity.toLowerCase();
  if (lowerEntity.includes('school') || lowerEntity.includes('university') || lowerEntity.includes('academy') || lowerEntity.includes('college')) {
    industry = industry || 'Education';
    category = 'Education & EdTech';
  } else if (lowerEntity.includes('clinic') || lowerEntity.includes('dental') || lowerEntity.includes('doctor') || lowerEntity.includes('hospital') || lowerEntity.includes('medic')) {
    industry = industry || 'Healthcare';
    category = 'Healthcare & Wellness';
  } else if (lowerEntity.includes('restaurant') || lowerEntity.includes('cafe') || lowerEntity.includes('hotel') || lowerEntity.includes('bar') || lowerEntity.includes('resort')) {
    industry = industry || 'Hospitality';
    category = 'Hospitality & Food';
  } else if (lowerEntity.includes('real estate') || lowerEntity.includes('realtor') || lowerEntity.includes('property') || lowerEntity.includes('broker')) {
    industry = industry || 'Real Estate';
    category = 'Real Estate & PropTech';
  } else if (lowerEntity.includes('law') || lowerEntity.includes('legal') || lowerEntity.includes('attorney')) {
    industry = industry || 'Legal';
    category = 'Legal Services';
  } else if (lowerEntity.includes('ecommerce') || lowerEntity.includes('e-commerce') || lowerEntity.includes('brand') || lowerEntity.includes('retail') || lowerEntity.includes('shop') || lowerEntity.includes('store')) {
    industry = industry || 'Retail & Ecommerce';
    category = 'Ecommerce & Direct-to-Consumer';
  } else {
    industry = industry || 'Commercial';
    category = 'Commercial';
  }

  return {
    raw_query: trimmed,
    target_entity: targetEntity,
    industry,
    category,
    location,
    opportunity_query: oppPhrase,
    opportunity_id: opportunityId,
    opportunity_type: opportunityType,
    opportunity_keywords: opportunityKeywords,
    qualification_conditions: qualificationConditions,
    intent_type: intentType,
    is_vendor_search: isVendorSearch,
    matched_service_ids: matchedServiceIds,
  };
}
