export type SearchStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'CANCELLED';
export type BusinessStatus = 'NEW' | 'DISCOVERED' | 'ENRICHING' | 'ENRICHED' | 'ANALYZING' | 'ANALYZED' | 'OPPORTUNITY_FOUND' | 'SAVED' | 'CONTACTED' | 'BLOCKED';
export type ClientPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type OpportunityImpact = 'HIGH' | 'MEDIUM' | 'LOW';

export interface SearchFilters {
  industry?: string;
  sub_industry?: string;
  country?: string;
  state?: string;
  city?: string;
  location?: string;
  keywords?: string[];
  business_type?: string;

  business_size?: string;
  min_rating?: number;
  min_reviews?: number;
  business_status?: string;

  has_website?: boolean;
  has_email?: boolean;
  has_phone?: boolean;
  has_instagram?: boolean;
  has_facebook?: boolean;
  has_linkedin?: boolean;
  has_google_business?: boolean;

  outdated_website?: boolean;
  weak_website?: boolean;
  no_booking_system?: boolean;
  no_lead_form?: boolean;
  no_clear_cta?: boolean;
  weak_social_presence?: boolean;
  weak_seo?: boolean;
  low_digital_maturity?: boolean;
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

export interface BusinessProfile {
  id: string;
  name: string;
  normalized_name: string;
  slug: string;
  industry: string;
  sub_industry?: string;
  description?: string;
  address?: string;
  city?: string;
  country: string;
  phone?: string;
  email?: string;
  website?: string;
  domain?: string;
  rating?: number;
  review_count: number;
  has_website: boolean;
  has_ssl: boolean;
  is_mobile_friendly: boolean;
  status: BusinessStatus;
  priority: ClientPriority;
  priority_score: number;
  confidence: number;
  data_completeness: number;
  discovered_at: string;
  contacts: Contact[];
  opportunities: Opportunity[];
  activities: ActivityEvent[];
}

export type SystemEvent =
  | { type: 'search.started'; data: { search_id: string; query: string; started_at: string } }
  | { type: 'provider.started'; data: { search_id: string; provider_id: string; query_variation: string } }
  | { type: 'provider.progress'; data: { search_id: string; provider_id: string; progress_percentage: number; found_count: number } }
  | { type: 'business.discovered'; data: { search_id: string; business: Business; is_new: boolean } }
  | { type: 'opportunity.detected'; data: { search_id?: string; business_id: string; opportunity: Opportunity } }
  | { type: 'search.completed'; data: { search_id: string; total_discovered: number; total_saved: number; total_enriched: number; duration_ms: number } }
  | { type: 'search.failed'; data: { search_id: string; error: string } };
