'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  SlidersHorizontal,
  Sparkles,
  Globe,
  Mail,
  Phone,
  Star,
  Zap,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  Building,
  Target,
  ShieldCheck,
  Activity,
  Flame,
  FileSpreadsheet,
  Check,
  X,
  HelpCircle,
  Cpu,
  Layers,
  BarChart3,
  Bot,
  Filter,
  AlertTriangle,
  Lightbulb,
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
  EvidenceSignal,
  EvidenceStatus,
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
    target: 'Schools',
    opp: 'ERP',
    industry: 'Education',
    city: 'Dubai',
  },
  {
    label: 'Clinics + Booking',
    query: 'clinics without online booking in London',
    target: 'Clinics',
    opp: 'Booking',
    industry: 'Healthcare',
    city: 'London',
  },
  {
    label: 'Restaurants + Web',
    query: 'restaurants needing website in New York',
    target: 'Restaurants',
    opp: 'Website',
    industry: 'Hospitality',
    city: 'New York',
  },
  {
    label: 'Real Estate + CRM',
    query: 'real estate agencies without CRM in Singapore',
    target: 'Real Estate',
    opp: 'CRM',
    industry: 'Real Estate',
    city: 'Singapore',
  },
  {
    label: 'Law Firms + Automation',
    query: 'law firms needing automation in Sydney',
    target: 'Law Firms',
    opp: 'Automation',
    industry: 'Legal',
    city: 'Sydney',
  },
  {
    label: 'Ecommerce + SEO',
    query: 'ecommerce brands with poor SEO in Dubai',
    target: 'Ecommerce',
    opp: 'SEO',
    industry: 'Retail',
    city: 'Dubai',
  },
];

export default function DiscoverPage() {
  // Search Inputs
  const [query, setQuery] = useState('schools needing ERP in Dubai');
  const [industry, setIndustry] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  // Parsed Search Intent State
  const [parsedIntent, setParsedIntent] = useState<SearchIntent | null>(null);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);

  // Advanced Filter Toggles
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hasWebsite, setHasWebsite] = useState<boolean | undefined>(undefined);
  const [hasEmail, setHasEmail] = useState<boolean | undefined>(undefined);
  const [hasPhone, setHasPhone] = useState<boolean | undefined>(undefined);

  // Search execution state
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [providerProgress, setProviderProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Live Discovered Businesses & Opportunities
  const [discoveredBusinesses, setDiscoveredBusinesses] = useState<Business[]>([]);
  const [liveOpportunities, setLiveOpportunities] = useState<Record<string, Opportunity[]>>({});

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
        if (event.data.validation.match_ratio < 0.5) {
          setStatusMessage(
            `Validated candidate entities: ${Math.round(event.data.validation.match_ratio * 100)}% match. Suppressing vendor noise.`
          );
        }
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
        const completeMsg = `Ingestion & Opportunity Qualification complete: ${event.data.total_saved} prospective clients scored (${event.data.duration_ms}ms)`;
        setStatusMessage(completeMsg);
        break;

      case 'search.failed':
        setSearchStatus('failed');
        setStatusMessage(`Discovery failed: ${event.data.error}`);
        break;
    }
  }, []);

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
        has_website: hasWebsite,
        has_email: hasEmail,
        has_phone: hasPhone,
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1A3A44]/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#02A0A0]/20 to-[#FFBD65]/10 border border-[#02A0A0]/30 text-[#02A0A0]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Universal Client Opportunity Discovery
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#02A0A0]/15 text-[#02A0A0] border border-[#02A0A0]/30 uppercase">
                  Intent-Driven
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Target Entity controls discovery. Opportunity / Problem controls dynamic qualification across any industry.
              </p>
            </div>
          </div>
        </div>

        {/* Universal Preset Pills & History Quick Link */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link
            href="/clientHistory"
            className="text-[11px] px-2.5 py-1 rounded-lg bg-[#02A0A0]/15 hover:bg-[#02A0A0]/25 text-[#02A0A0] border border-[#02A0A0]/30 transition-all font-bold flex items-center gap-1.5 mr-1"
          >
            <HistoryIcon className="w-3 h-3" />
            Client History
          </Link>
          <span className="text-[11px] text-slate-400 font-semibold mr-1 flex items-center gap-1">
            <Flame className="w-3 h-3 text-[#FFBD65]" /> Universal Niches:
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
              className="text-[11px] px-2.5 py-1 rounded-lg bg-[#0D1E24] hover:bg-[#122931] text-slate-300 hover:text-[#02A0A0] border border-[#1A3A44] transition-all font-medium flex items-center gap-1.5 active:scale-95"
            >
              <span className="text-slate-400 font-mono text-[9px]">[{preset.opp}]</span>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Search Command Bar */}
      <div className="bg-[#0D1E24] border border-[#1A3A44] rounded-2xl p-5 shadow-2xl shadow-black/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-40 bg-gradient-to-bl from-[#02A0A0]/5 to-transparent pointer-events-none rounded-tr-2xl" />

        <form onSubmit={handleStartSearch} className="space-y-4 relative z-10">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search any entity + opportunity, e.g. 'schools needing ERP', 'clinics without booking', 'law firms needing automation'..."
                className="w-full bg-[#071317] border border-[#1A3A44] focus:border-[#02A0A0] focus:ring-1 focus:ring-[#02A0A0] rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-500 outline-none transition-all font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={searchStatus === 'running' || !query.trim()}
              className="bg-[#02A0A0] hover:bg-[#22BDBD] active:scale-[0.98] text-[#071317] font-bold py-3 px-6 rounded-xl text-xs transition-all shadow-lg shadow-[#02A0A0]/20 flex items-center justify-center gap-2 disabled:opacity-50 min-w-[140px]"
            >
              {searchStatus === 'running' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#071317]" />
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
            <div className="mt-3 pt-3 border-t border-[#1A3A44]/60 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {/* Target Entity */}
              <div className="bg-[#071317] p-2.5 rounded-xl border border-[#1A3A44] flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[#02A0A0]/10 text-[#02A0A0]">
                  <Building className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Target Entity (Discovery)
                  </div>
                  <div className="text-xs font-semibold text-white truncate">
                    {parsedIntent.target_entity}
                  </div>
                </div>
              </div>

              {/* Opportunity / Problem */}
              <div className="bg-[#071317] p-2.5 rounded-xl border border-[#1A3A44] flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[#FFBD65]/10 text-[#FFBD65]">
                  <Target className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Opportunity (Qualification)
                  </div>
                  <div className="text-xs font-semibold text-[#FFBD65] truncate flex items-center gap-1">
                    <span>{parsedIntent.opportunity_type}</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({parsedIntent.opportunity_keywords.slice(0, 2).join(', ')})
                    </span>
                  </div>
                </div>
              </div>

              {/* Industry & Location */}
              <div className="bg-[#071317] p-2.5 rounded-xl border border-[#1A3A44] flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                  <Globe className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Industry & Geo
                  </div>
                  <div className="text-xs font-semibold text-white truncate">
                    {parsedIntent.industry} • {parsedIntent.location || 'Global/Any'}
                  </div>
                </div>
              </div>

              {/* Intent Type */}
              <div className="bg-[#071317] p-2.5 rounded-xl border border-[#1A3A44] flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Intent Classification
                  </div>
                  <div className="text-xs font-semibold text-white truncate">
                    {parsedIntent.is_vendor_search ? 'Vendor Search' : 'Client Prospecting'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Progress & Live Ingestion Status */}
      {searchStatus !== 'idle' && (
        <div className="bg-[#0D1E24]/80 border border-[#1A3A44] rounded-xl p-4 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {searchStatus === 'running' ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#02A0A0] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#02A0A0]"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                )}
              </span>
              <span className="text-xs font-mono font-semibold text-slate-300">
                {statusMessage || 'Analyzing live data feeds...'}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-[#071317] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#02A0A0] to-[#FFBD65] h-full transition-all duration-300"
                style={{ width: `${providerProgress}%` }}
              />
            </div>
          </div>

          {/* Validation Metrics */}
          {validationSummary && (
            <div className="flex items-center gap-3 bg-[#071317] px-3.5 py-1.5 rounded-lg border border-[#1A3A44] text-[11px]">
              <div className="text-slate-400 font-medium">Entity Validation:</div>
              <div className="flex items-center gap-1 font-bold text-emerald-400 font-mono">
                <ShieldCheck className="w-3.5 h-3.5" />
                {Math.round(validationSummary.match_ratio * 100)}% Target Match
              </div>
              <div className="text-slate-500 font-mono">
                ({validationSummary.valid_candidates} valid / {validationSummary.total_candidates} candidates)
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            Discovered Potential Clients
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#0D1E24] text-[#02A0A0] border border-[#1A3A44]">
              {discoveredBusinesses.length} Found
            </span>
          </h2>
        </div>
      </div>

      {/* Discovered Client Intelligence Grid */}
      {discoveredBusinesses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {discoveredBusinesses.map((biz) => {
            const opps = liveOpportunities[biz.id] || [];
            const primaryOpp = opps[0];

            return (
              <div
                key={biz.id}
                className="bg-[#0D1E24] border border-[#1A3A44] hover:border-[#02A0A0]/60 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-[#02A0A0]/5 group"
              >
                <div className="space-y-3.5">
                  {/* Card Top: Name, Industry, Priority Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h3 className="font-bold text-white text-sm group-hover:text-[#02A0A0] transition-colors line-clamp-1">
                        {biz.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <span>{biz.industry}</span>
                        {biz.city && (
                          <>
                            <span>•</span>
                            <span>{biz.city}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Opportunity Priority Score Badge */}
                    <div
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono border flex items-center gap-1 shrink-0 ${
                        biz.priority === 'HIGH'
                          ? 'bg-red-500/10 text-red-400 border-red-500/30'
                          : biz.priority === 'MEDIUM'
                          ? 'bg-[#FFBD65]/10 text-[#FFBD65] border-[#FFBD65]/30'
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                      }`}
                    >
                      <Zap className="w-3 h-3" />
                      Score {biz.priority_score || 75}
                    </div>
                  </div>

                  {/* Primary Opportunity Recommendation */}
                  {primaryOpp && (
                    <div className="bg-[#071317] p-3 rounded-xl border border-[#1A3A44] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#FFBD65] flex items-center gap-1">
                          <Lightbulb className="w-3 h-3 text-[#FFBD65]" />
                          {primaryOpp.category}
                        </span>
                        {primaryOpp.estimated_revenue_potential && (
                          <span className="text-[10px] font-mono font-bold text-emerald-400">
                            {primaryOpp.estimated_revenue_potential}
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-semibold text-white line-clamp-1">
                        {primaryOpp.title}
                      </div>

                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {primaryOpp.description}
                      </p>

                      {/* Evidence Signals (3-State Chips) */}
                      {primaryOpp.evidence && primaryOpp.evidence.length > 0 && (
                        <div className="pt-2 border-t border-[#1A3A44]/60 flex flex-wrap gap-1.5">
                          {primaryOpp.evidence.map((ev, idx) => {
                            const isDetected = ev.toLowerCase().includes('detected');
                            const isNotDetected = ev.toLowerCase().includes('not_detected') || ev.toLowerCase().includes('not detected');

                            return (
                              <span
                                key={idx}
                                className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium flex items-center gap-1 border ${
                                  isDetected
                                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                    : isNotDetected
                                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                    : 'bg-slate-500/10 text-slate-300 border-slate-500/30'
                                }`}
                              >
                                {isDetected ? (
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                ) : isNotDetected ? (
                                  <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                                ) : (
                                  <HelpCircle className="w-2.5 h-2.5 text-slate-400" />
                                )}
                                {ev}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Public Digital & Contact Footprint */}
                  <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
                    {biz.website ? (
                      <a
                        href={biz.website}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-slate-300 hover:text-[#02A0A0] transition-colors truncate max-w-[150px]"
                      >
                        <Globe className="w-3.5 h-3.5 text-[#02A0A0] shrink-0" />
                        <span className="truncate">{biz.website.replace(/^https?:\/\//, '')}</span>
                      </a>
                    ) : (
                      <span className="flex items-center gap-1 text-slate-500">
                        <Globe className="w-3.5 h-3.5 shrink-0" /> No Website
                      </span>
                    )}

                    {biz.phone && (
                      <span className="flex items-center gap-1 text-slate-300 truncate">
                        <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{biz.phone}</span>
                      </span>
                    )}

                    {biz.rating && (
                      <span className="flex items-center gap-1 text-amber-300 ml-auto font-mono text-[11px]">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {biz.rating.toFixed(1)}
                        <span className="text-slate-500">({biz.review_count})</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-4 mt-3 border-t border-[#1A3A44]/60 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">
                    Confidence: {Math.round((biz.confidence || 0.95) * 100)}%
                  </span>

                  <Link
                    href={`/businesses/${biz.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#02A0A0] hover:text-[#22BDBD] transition-colors"
                  >
                    Deep Intelligence <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : searchStatus === 'completed' ? (
        <div className="bg-[#0D1E24] border border-[#1A3A44] rounded-2xl p-12 text-center space-y-3">
          <div className="p-3 bg-slate-800/40 rounded-full w-fit mx-auto text-slate-400">
            <Filter className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white">No Matching Target Entities Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Try adjusting your target entity keyword or location. The engine isolates the target entity from opportunity qualifiers.
          </p>
        </div>
      ) : null}
    </div>
  );
}
