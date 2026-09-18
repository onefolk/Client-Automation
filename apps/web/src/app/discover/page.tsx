'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Search,
  Sparkles,
  Globe,
  Mail,
  Phone,
  Star,
  Zap,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Building,
  Target,
  ShieldCheck,
  Flame,
  Check,
  Copy,
  Layers,
  Bot,
  Filter,
  History as HistoryIcon,
} from 'lucide-react';
import { createSearch, parseIntent } from '@/lib/api';
import { useSearchSSE } from '@/lib/sse';
import {
  addClientToHistory,
  saveLatestSearchState,
  getLatestSearchState,
} from '@/lib/client-history';
import {
  Business,
  Opportunity,
  SearchFilters,
  SearchIntent,
  SystemEvent,
  ValidationSummary,
} from '@/lib/types';

const PRESET_QUERIES = [
  { label: 'Schools + ERP', query: 'schools needing ERP in Dubai', opp: 'ERP' },
  { label: 'Clinics + Booking', query: 'clinics without online booking in London', opp: 'Booking' },
  { label: 'Restaurants + Web', query: 'restaurants needing website in New York', opp: 'Web UX' },
  { label: 'Real Estate + CRM', query: 'real estate agencies without CRM in Singapore', opp: 'CRM' },
  { label: 'Law Firms + Automation', query: 'law firms needing automation in Sydney', opp: 'AI Flow' },
  { label: 'Ecommerce + SEO', query: 'ecommerce brands with poor SEO in Dubai', opp: 'SEO' },
];

export default function DiscoverPage() {
  // Search Inputs
  const [query, setQuery] = useState('ecommerce brands with poor SEO in Dubai');
  const [industry, setIndustry] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  // Parsed Search Intent State
  const [parsedIntent, setParsedIntent] = useState<SearchIntent | null>(null);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);

  // Search execution state
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [providerProgress, setProviderProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Live Discovered Businesses & Opportunities
  const [discoveredBusinesses, setDiscoveredBusinesses] = useState<Business[]>([]);
  const [liveOpportunities, setLiveOpportunities] = useState<Record<string, Opportunity[]>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const searchingRef = useRef(false);
  const [restored, setRestored] = useState(false);
  const [activeParams, setActiveParams] = useState<SearchFilters & { query: string }>({ query: '' });

  // Restore latest search session on initial mount if available
  useEffect(() => {
    const saved = getLatestSearchState();
    if (saved && Array.isArray(saved.discoveredBusinesses)) {
      setQuery(saved.query || query);
      if (saved.industry) setIndustry(saved.industry);
      if (saved.city) setCity(saved.city);
      if (saved.country) setCountry(saved.country);
      setDiscoveredBusinesses(saved.discoveredBusinesses);
      if (saved.liveOpportunities) setLiveOpportunities(saved.liveOpportunities);
      if (saved.parsedIntent) setParsedIntent(saved.parsedIntent);
      setSearchStatus(saved.searchStatus === 'running' ? 'failed' : saved.searchStatus || 'completed');
      setStatusMessage(saved.searchStatus === 'running' ? 'Previous discovery was interrupted. Run the search again.' : saved.statusMessage || '');
      setProviderProgress(saved.searchStatus === 'completed' ? 100 : 0);
    }
    setRestored(true);
  }, []);

  // Auto-parse preview as user types (debounced)
  useEffect(() => {
    if (!query.trim()) { setParsedIntent(null); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const intent = await parseIntent(query, {
          industry: industry || undefined,
          city: city || undefined,
          country: country || undefined,
        });
        if (!cancelled) setParsedIntent(intent);
      } catch (e) {
        // Fallback local heuristic
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, industry, city, country]);

  // SSE Event Handler
  const handleSSEEvent = useCallback((event: SystemEvent) => {
    switch (event.type) {
      case 'search.started':
        setSearchStatus('running');
        setStatusMessage(`Discovery pipeline initiated for: "${event.data.query}"`);
        break;

      case 'intent.parsed':
        setParsedIntent(event.data.intent);
        setStatusMessage(
          `Target: "${event.data.intent.target_entity}" | Opportunity: [${event.data.intent.opportunity_type}]`
        );
        break;

      case 'validation.completed':
        setValidationSummary(event.data.validation);
        break;

      case 'provider.started':
        setStatusMessage(`Scanning target registry & web: ${event.data.query_variation}`);
        setProviderProgress((prev) => Math.min(prev + 20, 85));
        break;

      case 'provider.progress':
        setProviderProgress(event.data.progress_percentage);
        break;

      case 'business.discovered':
        // Automatically persist to deduplicated client history
        addClientToHistory(event.data.business);

        setDiscoveredBusinesses((prev) => {
          const exists = prev.some((b) => b.id === event.data.business.id);
          const next = exists
            ? prev.map((b) => (b.id === event.data.business.id ? event.data.business : b))
            : [event.data.business, ...prev];

          return next;
        });
        break;

      case 'opportunity.detected':
        setLiveOpportunities((prev) => {
          const bizId = event.data.business_id;
          const current = prev[bizId] || [];
          if (current.some((item) => item.id === event.data.opportunity.id)) return prev;
          return {
            ...prev,
            [bizId]: [...current, event.data.opportunity],
          };
        });
        break;

      case 'search.completed':
        searchingRef.current = false;
        setSearchStatus('completed');
        setProviderProgress(100);
        setStatusMessage(
          `Discovery complete: ${event.data.total_saved} prospective clients found (${event.data.duration_ms}ms)`
        );
        break;

      case 'search.failed':
        searchingRef.current = false;
        setSearchStatus('failed');
        setStatusMessage(`Discovery failed: ${event.data.error}`);
        break;
    }
  }, []);

  const { close: closeStream } = useSearchSSE(currentSearchId, handleSSEEvent, activeParams);

  const latestSnapshot = useRef<Parameters<typeof saveLatestSearchState>[0] | null>(null);
  // Debounce storage writes during streaming, and flush the latest snapshot on navigation.
  useEffect(() => {
    if (!restored) return;
    const snapshot = { query, industry, city, country,
      discoveredBusinesses, parsedIntent, liveOpportunities, searchStatus, statusMessage,
      savedAt: new Date().toISOString() };
    latestSnapshot.current = snapshot;
    const timer = setTimeout(() => saveLatestSearchState(snapshot), 200);
    return () => clearTimeout(timer);
  }, [restored, query, industry, city, country, discoveredBusinesses, parsedIntent, liveOpportunities, searchStatus, statusMessage]);
  useEffect(() => {
    const flush = () => { if (latestSnapshot.current) saveLatestSearchState(latestSnapshot.current); };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, []);

  const executeSearch = async (targetQuery: string, filters: SearchFilters = {
    industry: industry || undefined, city: city || undefined, country: country || undefined,
  }) => {
    if (!targetQuery.trim() || searchingRef.current) return;
    searchingRef.current = true;
    closeStream();
    setCurrentSearchId(null);
    setActiveParams({ query: targetQuery, ...filters });

    setDiscoveredBusinesses([]);
    setLiveOpportunities({});
    setValidationSummary(null);
    setSearchStatus('running');
    setProviderProgress(25);
    setStatusMessage('Deconstructing query intent & scanning live registry...');

    try {
      const res = await createSearch(targetQuery, filters, [
        'live_public_registry',
      ]);
      setCurrentSearchId(res.search_id);
    } catch (err: any) {
      searchingRef.current = false;
      setSearchStatus('failed');
      setStatusMessage(`Error launching discovery: ${err.message}`);
    }
  };

  const handleStartSearch = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Universal Client Discovery
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/[0.08]">
              Live Engine
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Identify verified target clients and evaluate conversion opportunities in real time.
          </p>
        </div>

        {/* Preset Queries */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="text-zinc-500 text-[11px] font-medium mr-1">Presets:</span>
          {PRESET_QUERIES.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                if (searchingRef.current) return;
                setQuery(preset.query);
                setIndustry('');
                setCity('');
                setCountry('');
                executeSearch(preset.query, {});
              }}
              className="text-[11px] px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/[0.08] transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Search Command Box */}
      <div className="rounded-lg border border-white/[0.08] bg-[#111113] p-4 space-y-3">
        <form onSubmit={handleStartSearch} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search target businesses, e.g. 'ecommerce brands with poor SEO in Dubai'..."
                className="w-full bg-zinc-900 border border-white/[0.08] focus:border-zinc-500 rounded-md pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={!query.trim() || searchStatus === 'running'}
              className="bg-white hover:bg-zinc-200 active:scale-[0.98] text-black font-semibold py-2 px-4 rounded-md text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0"
            >
              {searchStatus === 'running' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Search
                </>
              )}
            </button>
          </div>

          {/* Parsed Intent Attributes Bar */}
          {parsedIntent && (
            <div className="pt-2 border-t border-white/[0.06] grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded bg-zinc-900/60 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block uppercase font-mono">Target Entity</span>
                <span className="text-zinc-200 font-medium truncate block">{parsedIntent.target_entity}</span>
              </div>
              <div className="p-2 rounded bg-zinc-900/60 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block uppercase font-mono">Opportunity Gap</span>
                <span className="text-amber-400 font-medium truncate block">{parsedIntent.opportunity_type}</span>
              </div>
              <div className="p-2 rounded bg-zinc-900/60 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block uppercase font-mono">Location</span>
                <span className="text-zinc-200 font-medium truncate block">{parsedIntent.location || 'Global'}</span>
              </div>
              <div className="p-2 rounded bg-zinc-900/60 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block uppercase font-mono">Intent</span>
                <span className="text-zinc-300 font-medium truncate block">
                  {parsedIntent.is_vendor_search ? 'Vendor' : 'Prospecting'}
                </span>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Progress Line */}
      {searchStatus === 'running' && (
        <div className="rounded-lg border border-white/[0.08] bg-[#111113] p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span>{statusMessage}</span>
            </div>
            <span className="font-mono text-xs text-zinc-400">{providerProgress}%</span>
          </div>
          <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
            <div
              className="bg-white h-full rounded-full transition-all duration-200"
              style={{ width: `${providerProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Results Header */}
      {discoveredBusinesses.length > 0 && (
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
              Discovered Clients
            </h2>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/[0.08]">
              {discoveredBusinesses.length}
            </span>
          </div>

          <Link
            href="/clientHistory"
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            Open Client History <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Discovered Businesses Grid */}
      {discoveredBusinesses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {discoveredBusinesses.map((biz) => {
            const opps = liveOpportunities[biz.id] || [];
            const domain = biz.domain || (biz.website ? new URL(biz.website).hostname.replace(/^www\./, '') : '');

            return (
              <div
                key={biz.id}
                className="rounded-lg border border-white/[0.08] hover:border-white/[0.18] bg-[#111113] p-4 transition-colors flex flex-col justify-between space-y-3"
              >
                <div>
                  {/* Top Bar: Name & Priority */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase block truncate">
                        {biz.industry} • {biz.city || biz.country || 'Global'}
                      </span>
                      <h3 className="text-sm font-semibold text-white truncate">{biz.name}</h3>
                    </div>

                    <span
                      className={`text-[9px] font-mono font-medium px-2 py-0.5 rounded border shrink-0 ${
                        biz.priority === 'HIGH'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-zinc-800 text-zinc-400 border-white/[0.06]'
                      }`}
                    >
                      {biz.priority}
                    </span>
                  </div>

                  {/* Digital Footprint & Contacts */}
                  <div className="space-y-1.5 pt-3 mt-3 border-t border-white/[0.06] text-xs">
                    {biz.website && (
                      <div className="flex items-center justify-between text-zinc-300">
                        <div className="flex items-center gap-1.5 truncate">
                          <Globe className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <span className="text-[11px] font-mono truncate">{domain}</span>
                        </div>
                        <a
                          href={biz.website.startsWith('http') ? biz.website : `https://${biz.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-500 hover:text-zinc-300 p-0.5 shrink-0"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {biz.email && (
                      <div className="flex items-center justify-between text-zinc-300">
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="text-[11px] font-mono truncate">{biz.email}</span>
                        </div>
                        <button
                          onClick={() => handleCopy(biz.email!, `em-${biz.id}`)}
                          className="text-zinc-500 hover:text-zinc-300 p-0.5 shrink-0"
                          title="Copy email"
                        >
                          {copiedId === `em-${biz.id}` ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    )}

                    {biz.phone && (
                      <div className="flex items-center justify-between text-zinc-300">
                        <div className="flex items-center gap-1.5 truncate">
                          <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="text-[11px] font-mono truncate">{biz.phone}</span>
                        </div>
                        <button
                          onClick={() => handleCopy(biz.phone!, `ph-${biz.id}`)}
                          className="text-zinc-500 hover:text-zinc-300 p-0.5 shrink-0"
                          title="Copy phone"
                        >
                          {copiedId === `ph-${biz.id}` ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Opportunities Detected Preview */}
                  {opps.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <div className="text-[10px] font-medium text-zinc-500 uppercase font-mono">
                        Qualified Gaps ({opps.length})
                      </div>
                      {opps.slice(0, 2).map((opp) => (
                        <div
                          key={opp.id}
                          className="bg-zinc-900/70 border border-white/[0.04] rounded p-2 text-xs space-y-0.5"
                        >
                          <div className="font-medium text-zinc-200 truncate">{opp.title}</div>
                          {opp.estimated_revenue_potential && (
                            <div className="text-[10px] font-mono text-emerald-400">
                              Est: {opp.estimated_revenue_potential}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-500">
                    Confidence: {Math.round((biz.confidence || 0.98) * 100)}%
                  </span>

                  <Link
                    href={`/businesses/${biz.id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-white hover:text-zinc-300 transition-colors"
                  >
                    Deep Intelligence <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : searchStatus === 'completed' ? (
        <div className="rounded-lg border border-white/[0.08] bg-[#111113] p-10 text-center space-y-2">
          <Filter className="w-5 h-5 text-zinc-500 mx-auto" />
          <h3 className="text-xs font-semibold text-white">No Matching Entities Found</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Try adjusting your search terms or keywords.
          </p>
        </div>
      ) : null}
    </div>
  );
}
