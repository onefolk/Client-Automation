export type SearchStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type BusinessStatus = 'DISCOVERED' | 'ENRICHED' | 'ANALYZED' | 'OPPORTUNITY_FOUND' | 'CONTACTED' | 'REJECTED';
export type ClientPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type OpportunityImpact = 'HIGH' | 'MEDIUM' | 'LOW';
export type OpportunityType = 'ERP' | 'WEBSITE' | 'CRM' | 'BOOKING' | 'AUTOMATION' | 'SEO' | 'CUSTOM';
export type EvidenceStatus = 'DETECTED' | 'NOT_DETECTED' | 'UNKNOWN';

export interface EvidenceSignal {
  key: string;
  label: string;
  status: EvidenceStatus;
  details?: string;
  confidence: number;
  source: string;
}

export interface SearchIntent {
  raw_query: string;
  target_entity: string;
  industry: string;
  category?: string;
  location?: string;
  opportunity_type: OpportunityType;
  opportunity_keywords: string[];
  qualification_conditions: string[];
  is_vendor_search: boolean;
}

export interface ValidationSummary {
  target_entity: string;
  total_candidates: number;
  valid_candidates: number;
  match_ratio: number;
  detected_entity_distribution: Record<string, number>;
  regenerated: boolean;
}

export interface OpportunityEvaluation {
  score: number;
  confidence: number;
  reason: string;
  evidence_signals: EvidenceSignal[];
  recommended_service: string;
  service_tier: string;
  estimated_value?: string;
}

export interface SearchFilters {
  industry?: string;
  city?: string;
  state?: string;
  country?: string;
  location?: string;
  has_website?: boolean;
  has_email?: boolean;
  has_phone?: boolean;
  no_booking_system?: boolean;
  no_lead_form?: boolean;
  [key: string]: any;
}

export interface SearchSession {
  id: string;
  user_id?: string;
  query: string;
  filters: SearchFilters;
  providers_selected: string[];
  started_at: string;
  completed_at?: string;
  status: SearchStatus;
  total_discovered: number;
  total_saved: number;
  total_enriched: number;
  errors: string[];
  duration_ms?: number;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  name: string;
  normalized_name: string;
  slug: string;
  industry: string;
  sub_industry?: string;
  description?: string;

  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country: string;
  country_code?: string;
  latitude?: number;
  longitude?: number;

  phone?: string;
  normalized_phone?: string;
  email?: string;
  website?: string;
  domain?: string;

  rating?: number;
  review_count: number;

  has_website: boolean;
  has_ssl: boolean;
  is_mobile_friendly: boolean;
  website_load_time_ms?: number;

  status: BusinessStatus;
  priority: ClientPriority;
  priority_score: number;
  confidence: number;
  data_completeness: number;

  discovered_at: string;
  last_enriched_at?: string;
  last_analyzed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  business_id: string;
  contact_type: string;
  value: string;
  label?: string;
  full_name?: string;
  title?: string;
  source_url?: string;
  confidence: number;
  verified: boolean;
  created_at: string;
}

export interface Technology {
  id: string;
  business_id: string;
  category: string;
  name: string;
  version?: string;
  confidence: number;
  evidence?: string;
}

export interface Fact {
  id: string;
  business_id: string;
  category: string;
  key: string;
  value: any;
  source: string;
  source_url?: string;
  confidence: number;
  verified: boolean;
  created_at: string;
}

export interface SocialProfile {
  id: string;
  business_id: string;
  platform: string;
  url: string;
  handle?: string;
  follower_count?: number;
  is_active: boolean;
}

export interface ReviewInfo {
  id: string;
  business_id: string;
  source: string;
  rating: number;
  review_count: number;
  sentiment_score?: number;
  recent_snippet?: string;
}

export interface Analysis {
  id: string;
  business_id: string;
  model: string;
  digital_presence_score: number;
  website_score: number;
  social_score: number;
  seo_score: number;
  lead_capture_score: number;
  reputation_score: number;
  marketing_maturity: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  created_at: string;
}

export interface Opportunity {
  id: string;
  business_id: string;
  title: string;
  description: string;
  category: string;
  impact: OpportunityImpact;
  onefolk_service: string;
  service_tier: string;
  confidence: number;
  estimated_revenue_potential?: string;
  evidence: string[];
  status: string;
  created_at: string;
}

export interface ActivityEvent {
  id: string;
  business_id?: string;
  search_id?: string;
  event_type: string;
  title: string;
  description?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface BusinessProfile extends Business {
  contacts: Contact[];
  technologies?: Technology[];
  facts?: Fact[];
  social_profiles?: SocialProfile[];
  reviews?: ReviewInfo[];
  analysis?: Analysis;
  opportunities: Opportunity[];
  activities: ActivityEvent[];
}

export type SystemEvent =
  | { type: 'search.started'; data: { search_id: string; query: string; started_at: string } }
  | { type: 'intent.parsed'; data: { search_id: string; intent: SearchIntent } }
  | { type: 'validation.completed'; data: { search_id: string; validation: ValidationSummary } }
  | { type: 'provider.started'; data: { search_id: string; provider_id: string; query_variation: string } }
  | { type: 'provider.progress'; data: { search_id: string; provider_id: string; progress_percentage: number; found_count: number } }
  | { type: 'business.discovered'; data: { search_id: string; business: Business; is_new: boolean } }
  | { type: 'opportunity.detected'; data: { search_id?: string; business_id: string; opportunity: Opportunity } }
  | { type: 'search.completed'; data: { search_id: string; total_discovered: number; total_saved: number; total_enriched: number; duration_ms: number } }
  | { type: 'search.failed'; data: { search_id: string; error: string } };
