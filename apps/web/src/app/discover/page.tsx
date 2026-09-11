'use client';

import React, { useState, useCallback, useEffect } from 'react';
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
  {
    label: 'Schools + ERP',
    query: 'schools needing ERP in Dubai',
    opp: 'ERP',
  },
  {
    label: 'Clinics + Booking',
    query: 'clinics without online booking in London',
    opp: 'Booking',
  },
  {
    label: 'Restaurants + Web',
    query: 'restaurants needing website in New York',
    opp: 'Web UX',
  },
  {
    label: 'Real Estate + CRM',
    query: 'real estate agencies without CRM in Singapore',
    opp: 'CRM',
  },
  {
    label: 'Law Firms + Automation',
    query: 'law firms needing automation in Sydney',
    opp: 'AI Flow',
  },
  {
    label: 'Ecommerce + SEO',
    query: 'ecommerce brands with poor SEO in Dubai',
    opp: 'SEO',
  },
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

  // Restore latest search session on initial mount if available
  useEffect(() => {
    const saved = getLatestSearchState();
    if (saved && saved.discoveredBusinesses && saved.discoveredBusinesses.length > 0) {
      setQuery(saved.query || query);
      if (saved.industry) setIndustry(saved.industry);
      if (saved.city) setCity(saved.city);
      if (saved.country) setCountry(saved.country);
      setDiscoveredBusinesses(saved.discoveredBusinesses);
      if (saved.liveOpportunities) setLiveOpportunities(saved.liveOpportunities);
      if (saved.parsedIntent) setParsedIntent(saved.parsedIntent);
      if (saved.searchStatus) setSearchStatus(saved.searchStatus);
      if (saved.statusMessage) setStatusMessage(saved.statusMessage);
      setProviderProgress(100);
    }
  }, []);

  // Auto-parse preview as user types (debounced)
  useEffect(() => {
    if (!query.trim()) return;
    const timer = setTimeout(async () => {
      try {
        const intent = await parseIntent(query, {
          industry: industry || undefined,
          city: city || undefined,
          country: country || undefined,
        });
        setParsedIntent(intent);
      } catch (e) {
        // Fallback local heuristic
      }
    }, 350);
    return () => clearTimeout(timer);
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
          `Target: "${event.data.intent.target_entity}" | Evaluating Opportunity: [${event.data.intent.opportunity_type}]`
        );
        break;

      case 'validation.completed':
        setValidationSummary(event.data.validation);
        break;

      case 'provider.started':
        setStatusMessage(`Scanning target registry & web: ${event.data.query_variation}`);
        setProviderProgress((prev) => Math.min(prev + 12, 85));
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

          saveLatestSearchState({
            query,
            industry,
            city,
            country,
            discoveredBusinesses: next,
            parsedIntent,
            liveOpportunities,
            searchStatus: 'running',
            statusMessage,
            savedAt: new Date().toISOString(),
          });

          return next;
        });
        break;

      case 'opportunity.detected':
        setLiveOpportunities((prev) => {
          const bizId = event.data.business_id;
          const current = prev[bizId] || [];
          return {
            ...prev,
            [bizId]: [...current, event.data.opportunity],
          };
        });
        break;

      case 'search.completed':
        setSearchStatus('completed');
        setProviderProgress(100);
        setStatusMessage(
          `Discovery & qualification complete: ${event.data.total_saved} prospective clients scored (${event.data.duration_ms}ms)`
        );
        break;

      case 'search.failed':
        setSearchStatus('failed');
        setStatusMessage(`Discovery failed: ${event.data.error}`);
        break;
    }
  }, [query, industry, city, country, parsedIntent, liveOpportunities, statusMessage]);

  useSearchSSE(currentSearchId, handleSSEEvent, { query, city, industry, country });

  const executeSearch = async (targetQuery: string) => {
    if (!targetQuery.trim()) return;

    setDiscoveredBusinesses([]);
    setLiveOpportunities({});
    setValidationSummary(null);
    setSearchStatus('running');
    setProviderProgress(10);
    setStatusMessage('Deconstructing query intent & initiating target entity discovery...');

    try {
      const filters: SearchFilters = {
        industry: industry || undefined,
        city: city || undefined,
        country: country || undefined,
      };

      const res = await createSearch(targetQuery, filters, [
        'live_public_registry',
        'live_web_search',
      ]);
      setCurrentSearchId(res.search_id);
    } catch (err: any) {
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
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/[0.07] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Universal Client Opportunity Discovery
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Intent-Driven
                </span>
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Target Entity controls discovery. Opportunity qualifiers dynamically score value creation gaps.
              </p>
            </div>
          </div>
        </div>

        {/* Preset Pills & History Link */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link
            href="/clientHistory"
            className="text-[11px] px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.08] transition-all font-medium flex items-center gap-1.5 mr-1"
          >
            <HistoryIcon className="w-3.5 h-3.5 text-indigo-400" />
            Client History
          </Link>

          <span className="text-[11px] text-zinc-500 font-medium mr-1 flex items-center gap-1">
            <Flame className="w-3 h-3 text-amber-400" /> Niche Presets:
          </span>

          {PRESET_QUERIES.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setQuery(preset.query);
                setIndustry('');
                setCity('');
                executeSearch(preset.query);
              }}
              className="text-[11px] px-2.5 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] text-zinc-300 hover:text-white border border-white/[0.06] hover:border-white/[0.12] transition-all font-medium flex items-center gap-1.5 active:scale-95"
            >
              <span className="text-zinc-500 font-mono text-[9px]">[{preset.opp}]</span>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Search Command Box */}
      <div className="bg-[#0E1118] border border-white/[0.08] rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-40 bg-gradient-to-bl from-blue-600/5 via-indigo-600/5 to-transparent pointer-events-none rounded-tr-2xl" />

        <form onSubmit={handleStartSearch} className="space-y-4 relative z-10">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search any entity + opportunity, e.g. 'ecommerce brands with poor SEO in Dubai', 'schools needing ERP'..."
                className="w-full bg-[#090A0F] border border-white/[0.08] focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/80 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-zinc-500 outline-none transition-all font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={searchStatus === 'running' || !query.trim()}
              className="bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold py-3 px-6 rounded-xl text-xs transition-all shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 disabled:opacity-50 min-w-[140px]"
            >
              {searchStatus === 'running' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Discovering...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Discover Clients
                </>
              )}
            </button>
          </div>

          {/* Real-time Parsed Intent Breakdown Bar */}
          {parsedIntent && (
            <div className="pt-3 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Target Entity */}
              <div className="bg-[#090A0F] p-3 rounded-xl border border-white/[0.06] flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <Building className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] font-bold text-zinc-500 uppercase font-mono tracking-wider">
                    Target Entity
                  </div>
                  <div className="text-xs font-semibold text-zinc-200 truncate">
                    {parsedIntent.target_entity}
                  </div>
                </div>
              </div>

              {/* Opportunity */}
              <div className="bg-[#090A0F] p-3 rounded-xl border border-white/[0.06] flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] font-bold text-zinc-500 uppercase font-mono tracking-wider">
                    Opportunity / Gap
                  </div>
                  <div className="text-xs font-semibold text-amber-300 truncate">
                    {parsedIntent.opportunity_type}
                  </div>
                </div>
              </div>

              {/* Location & Industry */}
              <div className="bg-[#090A0F] p-3 rounded-xl border border-white/[0.06] flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Globe className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] font-bold text-zinc-500 uppercase font-mono tracking-wider">
                    Industry & Geo
                  </div>
                  <div className="text-xs font-semibold text-zinc-200 truncate">
                    {parsedIntent.industry} • {parsedIntent.location || 'Global'}
                  </div>
                </div>
              </div>

              {/* Classification */}
              <div className="bg-[#090A0F] p-3 rounded-xl border border-white/[0.06] flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] font-bold text-zinc-500 uppercase font-mono tracking-wider">
                    Intent Classification
                  </div>
                  <div className="text-xs font-semibold text-zinc-200 truncate">
                    {parsedIntent.is_vendor_search ? 'Vendor Search' : 'Client Prospecting'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Progress & Live Ingestion Status Bar */}
      {searchStatus === 'running' && (
        <div className="bg-[#0E1118] border border-white/[0.08] rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-zinc-300 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              <span>{statusMessage}</span>
            </div>
            <span className="font-mono text-xs font-semibold text-blue-400">{providerProgress}%</span>
          </div>
          <div className="w-full bg-white/[0.05] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-600 to-cyan-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${providerProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Results Header */}
      {discoveredBusinesses.length > 0 && (
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider font-mono">
              Discovered Potential Clients
            </h2>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {discoveredBusinesses.length} FOUND
            </span>
          </div>

          <Link
            href="/clientHistory"
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            View in Saved History <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Discovered Businesses Grid */}
      {discoveredBusinesses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {discoveredBusinesses.map((biz) => {
            const opps = liveOpportunities[biz.id] || [];
            const domain = biz.domain || (biz.website ? new URL(biz.website).hostname.replace(/^www\./, '') : '');
            const initials = biz.name
              .split(' ')
              .map((w) => w[0])
              .filter(Boolean)
              .slice(0, 2)
              .join('')
              .toUpperCase();

            return (
              <div
                key={biz.id}
                className="bg-[#0E1118] border border-white/[0.08] hover:border-white/[0.18] rounded-2xl p-5 transition-all duration-200 shadow-xl flex flex-col justify-between group"
              >
                <div>
                  {/* Top Bar: Avatar + Priority Badge */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600/30 via-indigo-600/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center font-bold text-xs text-blue-300 font-mono">
                        {initials}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors leading-tight">
                          {biz.name}
                        </h3>
                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          {biz.industry} • {biz.city || 'Dubai'}, {biz.country || 'UAE'}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                        biz.priority === 'HIGH'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : biz.priority === 'MEDIUM'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                      }`}
                    >
                      {biz.priority}
                    </span>
                  </div>

                  {/* Digital Footprint & Contacts */}
                  <div className="space-y-1.5 py-2.5 border-t border-b border-white/[0.06] text-xs">
                    {/* Website */}
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
                          className="text-zinc-500 hover:text-blue-400 p-0.5 shrink-0 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {/* Email */}
                    {biz.email && (
                      <div className="flex items-center justify-between text-zinc-300">
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="text-[11px] font-mono truncate">{biz.email}</span>
                        </div>
                        <button
                          onClick={() => handleCopy(biz.email!, `em-${biz.id}`)}
                          className="text-zinc-500 hover:text-blue-400 p-0.5 shrink-0 transition-colors"
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

                    {/* Phone */}
                    {biz.phone && (
                      <div className="flex items-center justify-between text-zinc-300">
                        <div className="flex items-center gap-1.5 truncate">
                          <Phone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-[11px] font-mono truncate">{biz.phone}</span>
                        </div>
                        <button
                          onClick={() => handleCopy(biz.phone!, `ph-${biz.id}`)}
                          className="text-zinc-500 hover:text-blue-400 p-0.5 shrink-0 transition-colors"
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

                  {/* Opportunities detected preview */}
                  {opps.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="text-[10px] font-bold text-zinc-400 uppercase font-mono tracking-wider flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-400" /> Qualified Gaps ({opps.length})
                      </div>
                      {opps.slice(0, 2).map((opp) => (
                        <div
                          key={opp.id}
                          className="bg-[#090A0F] border border-white/[0.06] rounded-xl p-2.5 space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-zinc-200 truncate">{opp.title}</span>
                          </div>
                          {opp.estimated_revenue_potential && (
                            <div className="text-[10px] font-mono text-emerald-400 font-semibold">
                              Est. Value: {opp.estimated_revenue_potential}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Signals badges */}
                  <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                    {biz.has_ssl && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono flex items-center gap-1">
                        <ShieldCheck className="w-2.5 h-2.5" /> SSL
                      </span>
                    )}
                    {biz.is_mobile_friendly && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                        Mobile Ready
                      </span>
                    )}
                    {biz.rating && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 fill-amber-300" /> {biz.rating}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-3 mt-4 border-t border-white/[0.06] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">
                    Confidence: {Math.round((biz.confidence || 0.98) * 100)}%
                  </span>

                  <Link
                    href={`/businesses/${biz.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors group-hover:translate-x-0.5 transition-transform"
                  >
                    Deep Intelligence <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : searchStatus === 'completed' ? (
        <div className="bg-[#0E1118] border border-white/[0.08] rounded-2xl p-12 text-center space-y-3">
          <div className="p-3 bg-white/[0.03] rounded-full w-fit mx-auto text-zinc-400">
            <Filter className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white">No Matching Entities Found</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Try adjusting your target entity keywords. The intent parser separates the entity target from problem qualifiers.
          </p>
        </div>
      ) : null}
    </div>
  );
}
