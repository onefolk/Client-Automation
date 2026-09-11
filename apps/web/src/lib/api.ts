import {
  Business,
  BusinessProfile,
  Opportunity,
  ActivityEvent,
  SearchFilters,
  SearchIntent,
  SearchSession,
  OneFolkServiceDef,
  OpportunityDef,
  ResourceDef,
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export async function listOneFolkServices(): Promise<OneFolkServiceDef[]> {
  const res = await fetch(`${API_BASE_URL}/api/config/services`);
  if (!res.ok) return [];
  return res.json();
}

export async function listOpportunityDefs(): Promise<OpportunityDef[]> {
  const res = await fetch(`${API_BASE_URL}/api/config/opportunities`);
  if (!res.ok) return [];
  return res.json();
}

export async function listResourceDefs(): Promise<ResourceDef[]> {
  const res = await fetch(`${API_BASE_URL}/api/config/resources`);
  if (!res.ok) return [];
  return res.json();
}

export async function parseIntent(
  query: string,
  filters: SearchFilters = {}
): Promise<SearchIntent> {
  const res = await fetch(`${API_BASE_URL}/api/intent/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, filters }),
  });
  if (!res.ok) {
    throw new Error(`Failed to parse search intent: ${res.statusText}`);
  }
  return res.json();
}

export async function createSearch(
  query: string,
  filters: SearchFilters = {},
  providers: string[] = []
): Promise<{ search_id: string; query: string; status: string }> {
  const res = await fetch(`${API_BASE_URL}/api/searches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, filters, providers }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create search: ${res.statusText}`);
  }
  return res.json();
}

export async function getSearch(id: string): Promise<SearchSession> {
  const res = await fetch(`${API_BASE_URL}/api/searches/${id}`);
  if (!res.ok) throw new Error('Failed to fetch search');
  return res.json();
}

export async function listSearches(): Promise<SearchSession[]> {
  const res = await fetch(`${API_BASE_URL}/api/searches`);
  if (!res.ok) throw new Error('Failed to fetch searches');
  return res.json();
}

export async function listBusinesses(params?: {
  industry?: string;
  city?: string;
  priority?: string;
}): Promise<Business[]> {
  const searchParams = new URLSearchParams();
  if (params?.industry) searchParams.set('industry', params.industry);
  if (params?.city) searchParams.set('city', params.city);
  if (params?.priority) searchParams.set('priority', params.priority);

  const res = await fetch(`${API_BASE_URL}/api/businesses?${searchParams.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch businesses');
  return res.json();
}

export async function getBusinessProfile(id: string): Promise<BusinessProfile> {
  const res = await fetch(`${API_BASE_URL}/api/businesses/${id}`);
  if (!res.ok) throw new Error('Failed to fetch business profile');
  return res.json();
}

export async function enrichBusiness(id: string): Promise<{ success: boolean; business: BusinessProfile }> {
  const res = await fetch(`${API_BASE_URL}/api/businesses/${id}/enrich`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to enrich business profile');
  return res.json();
}

export async function analyzeBusiness(id: string): Promise<{ success: boolean; analysis: any }> {
  const res = await fetch(`${API_BASE_URL}/api/businesses/${id}/analyze`, {
    method: 'POST',
  });
  if (!res.ok) {
    let errMessage = 'Failed to run intelligence analysis';
    try {
      const errJson = await res.json();
      errMessage = errJson.error || errMessage;
    } catch (_) {}
    throw new Error(errMessage);
  }
  return res.json();
}

export async function listOpportunities(): Promise<Opportunity[]> {
  const res = await fetch(`${API_BASE_URL}/api/opportunities`);
  if (!res.ok) throw new Error('Failed to fetch opportunities');
  return res.json();
}

export async function listActivities(): Promise<ActivityEvent[]> {
  const res = await fetch(`${API_BASE_URL}/api/activities`);
  if (!res.ok) throw new Error('Failed to fetch activities');
  return res.json();
}
