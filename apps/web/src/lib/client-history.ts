import { Business } from './types';

const STORAGE_KEY = 'onefolk_client_history_v1';
const LATEST_SEARCH_KEY = 'onefolk_latest_search_state_v1';

function normalizeDomain(urlOrDomain?: string): string {
  if (!urlOrDomain) return '';
  try {
    const raw = urlOrDomain.startsWith('http') ? urlOrDomain : `https://${urlOrDomain}`;
    const parsed = new URL(raw);
    return parsed.hostname.replace(/^www\./, '').toLowerCase().trim();
  } catch {
    return urlOrDomain.toLowerCase().replace(/^www\./, '').trim();
  }
}

export function getClientHistory(): Business[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading client history from localStorage:', err);
    return [];
  }
}

export function saveClientHistory(list: Business[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('onefolk:history-updated', { detail: list }));
  } catch (err) {
    console.error('Error saving client history to localStorage:', err);
  }
}

export function addClientToHistory(business: Business): Business[] {
  const current = getClientHistory();
  const normDom = normalizeDomain(business.domain || business.website);
  const normName = (business.normalized_name || business.name || '').toLowerCase().trim();
  const city = (business.city || '').toLowerCase().trim();

  // Deduplication check: if repeated by id, domain, or name+city, update without adding duplicate
  const existingIdx = current.findIndex((item) => {
    if (item.id === business.id) return true;
    const itemDom = normalizeDomain(item.domain || item.website);
    if (normDom && itemDom && normDom === itemDom) return true;
    const itemName = (item.normalized_name || item.name || '').toLowerCase().trim();
    const itemCity = (item.city || '').toLowerCase().trim();
    if (normName && itemName && normName === itemName && city === itemCity) return true;
    return false;
  });

  let updated: Business[];
  if (existingIdx !== -1) {
    // Merge / update existing entry and keep in place or move to top
    const existing = current[existingIdx];
    const merged = { ...existing, ...business };
    updated = [merged, ...current.filter((_, idx) => idx !== existingIdx)];
  } else {
    updated = [business, ...current];
  }

  saveClientHistory(updated);
  return updated;
}

export function addClientsToHistory(businesses: Business[]): Business[] {
  let list = getClientHistory();
  for (const biz of businesses) {
    const normDom = normalizeDomain(biz.domain || biz.website);
    const normName = (biz.normalized_name || biz.name || '').toLowerCase().trim();
    const city = (biz.city || '').toLowerCase().trim();

    const existingIdx = list.findIndex((item) => {
      if (item.id === biz.id) return true;
      const itemDom = normalizeDomain(item.domain || item.website);
      if (normDom && itemDom && normDom === itemDom) return true;
      const itemName = (item.normalized_name || item.name || '').toLowerCase().trim();
      const itemCity = (item.city || '').toLowerCase().trim();
      if (normName && itemName && normName === itemName && city === itemCity) return true;
      return false;
    });

    if (existingIdx !== -1) {
      list[existingIdx] = { ...list[existingIdx], ...biz };
    } else {
      list.unshift(biz);
    }
  }

  saveClientHistory(list);
  return list;
}

export function removeClientFromHistory(id: string): Business[] {
  const current = getClientHistory();
  const filtered = current.filter((b) => b.id !== id);
  saveClientHistory(filtered);
  return filtered;
}

export function clearClientHistory(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('onefolk:history-updated', { detail: [] }));
}

// Session state persistence for Discover page
export interface LatestSearchState {
  query: string;
  industry?: string;
  city?: string;
  country?: string;
  discoveredBusinesses: Business[];
  parsedIntent?: any;
  liveOpportunities?: Record<string, any[]>;
  searchStatus?: 'idle' | 'running' | 'completed' | 'failed';
  statusMessage?: string;
  savedAt: string;
}

export function saveLatestSearchState(state: LatestSearchState): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(LATEST_SEARCH_KEY, JSON.stringify(state));
  } catch {}
}

export function getLatestSearchState(): LatestSearchState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(LATEST_SEARCH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
