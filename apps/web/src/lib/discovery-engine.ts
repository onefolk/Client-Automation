import crypto from 'node:crypto';
import { memoryStore } from './store';
import { Business, SystemEvent, SearchFilters } from './types';
import { parseSearchIntent } from './intent';

function normalizeBusinessName(name: string): string {
  return name.toLowerCase().trim().replace(new RegExp('[^\\p{L}\\p{N}\\s]', 'gu'), ' ').replace(/\s+/g, ' ');
}

function extractWebsite(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

export async function runDiscoveryPipelineStream(
  searchId: string,
  query: string,
  filters: SearchFilters = {},
  onEvent: (event: SystemEvent) => void
) {
  const start = Date.now();
  const startedAt = new Date(start).toISOString();
  const session = memoryStore.searches.get(searchId);
  if (session) {
    session.status = 'RUNNING';
    session.started_at = startedAt;
    session.updated_at = startedAt;
  }
  onEvent({ type: 'search.started', data: { search_id: searchId, query, started_at: startedAt } });
  const intent = parseSearchIntent(query, filters);
  const city = filters.city || filters.location || intent.location || '';
  onEvent({ type: 'intent.parsed', data: { search_id: searchId, intent } });
  const provider_id = 'live_public_registry';
  const providerQuery = [intent.target_entity, city, filters.country].filter(Boolean).join(' ');
  onEvent({ type: 'provider.started', data: { search_id: searchId, provider_id, query_variation: providerQuery } });

  // Keep the timeout active until the response body has finished downloading.
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${new URLSearchParams({
    q: providerQuery, format: 'json', addressdetails: '1', extratags: '1', limit: '6',
  })}`, {
    signal: AbortSignal.timeout(8000),
    headers: { 'User-Agent': 'OneFolkClientIntelligence/2.0 (+https://onefolk.ai)' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Public registry request failed (${response.status}). Please try again later.`);
  const candidates = await response.json();
  if (!Array.isArray(candidates)) throw new Error('Public registry returned an invalid response.');

  // Build indexes once instead of scanning the entire directory for every result.
  const byDomain = new Map<string, Business>();
  const byNameCity = new Map<string, Business>();
  const identity = (name: string, location?: string) => `${name}\u0000${(location || '').toLowerCase()}`;
  memoryStore.businesses.forEach((business) => {
    if (business.domain) byDomain.set(business.domain, business);
    byNameCity.set(identity(business.normalized_name, business.city), business);
  });
  const seen = new Set<string>();
  let totalSaved = 0;
  for (const item of candidates) {
    if (!item || typeof item !== 'object') continue;
    const name = typeof item.name === 'string' ? item.name : String(item.display_name || '').split(',')[0].trim();
    const normalizedName = normalizeBusinessName(name);
    if (!normalizedName || seen.has(normalizedName)) continue;
    seen.add(normalizedName);
    const tags = item.extratags || {};
    const website = extractWebsite(tags.website || tags['contact:website'] || tags.url);
    const domain = website ? new URL(website).hostname.replace(/^www\./, '').toLowerCase() : undefined;
    const address = item.address || {};
    const resultCity = address.city || address.town || address.village || city || undefined;
    const key = identity(normalizedName, resultCity);
    const existing = (domain ? byDomain.get(domain) : undefined) || byNameCity.get(key);
    const now = new Date().toISOString();
    const business: Business = {
      id: existing?.id || crypto.randomUUID(), name, normalized_name: normalizedName,
      slug: normalizedName.replace(/\s+/g, '-'), industry: intent.industry || 'Commercial',
      address: item.display_name, city: resultCity, country: address.country || filters.country,
      latitude: Number.isFinite(Number(item.lat)) ? Number(item.lat) : undefined,
      longitude: Number.isFinite(Number(item.lon)) ? Number(item.lon) : undefined,
      website, domain, phone: tags.phone || tags['contact:phone'], email: tags.email || tags['contact:email'],
      has_website: Boolean(website), has_ssl: false, is_mobile_friendly: false,
      review_count: 0, status: 'DISCOVERED', priority: 'LOW', priority_score: 0,
      confidence: 0.7, data_completeness: website ? 50 : 30,
      discovered_at: now, created_at: now,
      // Rediscovery preserves previously enriched contacts, facts and analysis.
      ...existing,
      updated_at: now,
    };
    memoryStore.businesses.set(business.id, business);
    if (business.domain) byDomain.set(business.domain, business);
    byNameCity.set(key, business);
    memoryStore.activities.unshift({
      id: crypto.randomUUID(), business_id: business.id, search_id: searchId,
      event_type: existing ? 'business.merged' : 'business.discovered',
      title: 'Discovered via OpenStreetMap Registry',
      description: `Public registry candidate: ${business.name}. Website audit pending unless previously enriched.`,
      metadata: { source_provider: 'OpenStreetMap', source_url: `https://www.openstreetmap.org/${item.osm_type}/${item.osm_id}` },
      created_at: now,
    });
    totalSaved++;
    onEvent({ type: 'business.discovered', data: { search_id: searchId, business, is_new: !existing } });
    onEvent({ type: 'provider.progress', data: { search_id: searchId, provider_id,
      progress_percentage: Math.round(totalSaved / candidates.length * 100), found_count: totalSaved } });
  }
  const duration_ms = Date.now() - start;
  if (session) {
    Object.assign(session, { status: 'COMPLETED', total_discovered: totalSaved, total_saved: totalSaved,
      total_enriched: 0, completed_at: new Date().toISOString(), updated_at: new Date().toISOString(), duration_ms });
  }
  onEvent({ type: 'search.completed', data: { search_id: searchId, total_discovered: totalSaved,
    total_saved: totalSaved, total_enriched: 0, duration_ms } });
}
