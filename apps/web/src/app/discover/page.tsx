'use client';

import React, { useState, useCallback } from 'react';
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
} from 'lucide-react';
import { createSearch } from '@/lib/api';
import { useSearchSSE } from '@/lib/sse';
import { Business, SearchFilters, SystemEvent, Opportunity } from '@/lib/types';

const PRESET_NICHES = [
  { label: 'Japanese Dining', query: 'Japanese restaurants', industry: 'Restaurant', city: 'Dubai', country: 'UAE' },
  { label: 'Dental Clinics', query: 'dental clinics', industry: 'Healthcare', city: 'London', country: 'UK' },
  { label: 'Luxury Spas', query: 'luxury spa wellness', industry: 'Hospitality', city: 'Dubai', country: 'UAE' },
  { label: 'Law Firms', query: 'commercial law firms', industry: 'Legal', city: 'New York', country: 'USA' },
];

export default function DiscoverPage() {
  // Search Inputs
  const [query, setQuery] = useState('Japanese restaurants');
  const [industry, setIndustry] = useState('Restaurant');
  const [city, setCity] = useState('Dubai');
  const [country, setCountry] = useState('UAE');
  
  // Advanced Filter Toggles
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hasWebsite, setHasWebsite] = useState<boolean | undefined>(true);
  const [hasEmail, setHasEmail] = useState<boolean | undefined>(undefined);
  const [hasPhone, setHasPhone] = useState<boolean | undefined>(undefined);
  const [noBooking, setNoBooking] = useState(false);
  const [weakLeadCapture, setWeakLeadCapture] = useState(false);

  // Search execution state
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [providerProgress, setProviderProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  
  // Live Discovered Businesses & Opportunities
  const [discoveredBusinesses, setDiscoveredBusinesses] = useState<Business[]>([]);
  const [liveOpportunities, setLiveOpportunities] = useState<Record<string, Opportunity[]>>({});

  // SSE Event Handler
  const handleSSEEvent = useCallback((event: SystemEvent) => {
    switch (event.type) {
      case 'search.started':
        setSearchStatus('running');
        setStatusMessage(`Live discovery active for: "${event.data.query}"`);
        break;

      case 'provider.started':
        setStatusMessage(`Scanning live directory index: ${event.data.query_variation}`);
        setProviderProgress((prev) => Math.min(prev + 14, 85));
        break;

      case 'provider.progress':
        setProviderProgress(event.data.progress_percentage);
        break;

      case 'business.discovered':
        setDiscoveredBusinesses((prev) => {
          const exists = prev.some((b) => b.id === event.data.business.id);
          if (exists) {
            return prev.map((b) => (b.id === event.data.business.id ? event.data.business : b));
          }
          return [event.data.business, ...prev];
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
          `Ingestion complete: ${event.data.total_saved} prospective clients discovered & live-crawled (${event.data.duration_ms}ms)`
        );
        break;

      case 'search.failed':
        setSearchStatus('failed');
        setStatusMessage(`Search failed: ${event.data.error}`);
        break;
    }
  }, []);

  useSearchSSE(currentSearchId, handleSSEEvent);

  const executeSearch = async (targetQuery: string, targetIndustry: string, targetCity: string, targetCountry: string) => {
    if (!targetQuery.trim()) return;

    setDiscoveredBusinesses([]);
    setLiveOpportunities({});
    setSearchStatus('running');
    setProviderProgress(10);
    setStatusMessage('Initiating live public index query and real-time HTTP crawler...');

    try {
      const filters: SearchFilters = {
        industry: targetIndustry || undefined,
        city: targetCity || undefined,
        country: targetCountry || undefined,
        has_website: hasWebsite,
        has_email: hasEmail,
        has_phone: hasPhone,
        no_booking_system: noBooking ? true : undefined,
        no_lead_form: weakLeadCapture ? true : undefined,
      };

      const res = await createSearch(targetQuery, filters, ['live_public_registry']);
      setCurrentSearchId(res.search_id);
    } catch (err: any) {
      setSearchStatus('failed');
      setStatusMessage(`Error launching live search: ${err.message}`);
    }
  };

  const handleStartSearch = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query, industry, city, country);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Client Discovery Engine</h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#02A0A0]/15 text-[#02A0A0] border border-[#02A0A0]/30">
              Live Ingestion
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Query public business registries, crawl live domains, extract verified contacts, and identify high-value agency service gaps.
          </p>
        </div>

        {/* Quick preset niche pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-slate-400 font-semibold mr-1">Niches:</span>
          {PRESET_NICHES.map((n) => (
            <button
              key={n.label}
              type="button"
              onClick={() => {
                setQuery(n.query);
                setIndustry(n.industry);
                setCity(n.city);
                setCountry(n.country);
                executeSearch(n.query, n.industry, n.city, n.country);
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-[#0D1E24] hover:bg-[#122931] text-slate-300 hover:text-[#02A0A0] border border-[#1A3A44] transition-all font-medium flex items-center gap-1"
            >
              <Flame className="w-3 h-3 text-[#FFBD65]" />
              {n.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Search Command Bar */}
      <div className="bg-[#0D1E24] border border-[#1A3A44] rounded-2xl p-5 shadow-xl shadow-black/30">
        <form onSubmit={handleStartSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Query Input */}
            <div className="md:col-span-5 relative">
              <label className="block text-[11px] font-bold text-[#FFBD65] mb-1 uppercase tracking-wider">
                Target Business Query
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. Japanese restaurants, dental clinics, luxury spas..."
                  className="w-full bg-[#071317] border border-[#1A3A44] focus:border-[#02A0A0] focus:ring-1 focus:ring-[#02A0A0] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Industry Input */}
            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-[#FFBD65] mb-1 uppercase tracking-wider">
                Industry
              </label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Restaurant & Hospitality"
                className="w-full bg-[#071317] border border-[#1A3A44] focus:border-[#02A0A0] focus:ring-1 focus:ring-[#02A0A0] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition-all"
              />
            </div>

            {/* City / Location Input */}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-[#FFBD65] mb-1 uppercase tracking-wider">
                City / Location
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Dubai"
                className="w-full bg-[#071317] border border-[#1A3A44] focus:border-[#02A0A0] focus:ring-1 focus:ring-[#02A0A0] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition-all"
              />
            </div>

            {/* Submit Action */}
            <div className="md:col-span-2 flex items-end">
              <button
                type="submit"
                disabled={searchStatus === 'running'}
                className="w-full bg-[#02A0A0] hover:bg-[#22BDBD] active:scale-[0.98] text-[#071317] font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md shadow-[#02A0A0]/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {searchStatus === 'running' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#071317]" />
                    Crawling...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-[#071317]" />
                    Discover Clients
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Filters / Advanced Accordion */}
          <div className="pt-3 border-t border-[#1A3A44] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400 text-[11px] font-semibold">Verification Gaps:</span>
              <button
                type="button"
                onClick={() => setNoBooking(!noBooking)}
                className={`px-3 py-1 rounded-lg border text-xs transition-all ${
                  noBooking
                    ? 'bg-[#02A0A0]/20 border-[#02A0A0] text-[#02A0A0] font-bold'
                    : 'bg-[#071317] border-[#1A3A44] text-slate-400 hover:text-slate-200'
                }`}
              >
                ⚡ Missing Direct Booking
              </button>
              <button
                type="button"
                onClick={() => setWeakLeadCapture(!weakLeadCapture)}
                className={`px-3 py-1 rounded-lg border text-xs transition-all ${
                  weakLeadCapture
                    ? 'bg-[#FFBD65]/20 border-[#FFBD65] text-[#FFBD65] font-bold'
                    : 'bg-[#071317] border-[#1A3A44] text-slate-400 hover:text-slate-200'
                }`}
              >
                🎯 Weak Inbound Capture
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-[#02A0A0] hover:text-[#5EEAD4] flex items-center gap-1 font-semibold transition-colors"
            >
              <SlidersHorizontal className="w-3 h-3" />
              {showAdvanced ? 'Hide Extended Matrix' : 'Extended Verification Matrix'}
              <ChevronDown className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showAdvanced && (
            <div className="p-3.5 bg-[#071317] rounded-xl border border-[#1A3A44] grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">Has Active Website</label>
                <select
                  value={hasWebsite === undefined ? 'any' : hasWebsite ? 'yes' : 'no'}
                  onChange={(e) => setHasWebsite(e.target.value === 'any' ? undefined : e.target.value === 'yes')}
                  className="w-full bg-[#0D1E24] border border-[#1A3A44] rounded-lg p-2 text-slate-200 outline-none text-xs"
                >
                  <option value="any">Any</option>
                  <option value="yes">Yes (Must be reachable)</option>
                  <option value="no">No Website</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">Public Email Address</label>
                <select
                  value={hasEmail === undefined ? 'any' : hasEmail ? 'yes' : 'no'}
                  onChange={(e) => setHasEmail(e.target.value === 'any' ? undefined : e.target.value === 'yes')}
                  className="w-full bg-[#0D1E24] border border-[#1A3A44] rounded-lg p-2 text-slate-200 outline-none text-xs"
                >
                  <option value="any">Any</option>
                  <option value="yes">Must have Email</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">Direct Phone Dial</label>
                <select
                  value={hasPhone === undefined ? 'any' : hasPhone ? 'yes' : 'no'}
                  onChange={(e) => setHasPhone(e.target.value === 'any' ? undefined : e.target.value === 'yes')}
                  className="w-full bg-[#0D1E24] border border-[#1A3A44] rounded-lg p-2 text-slate-200 outline-none text-xs"
                >
                  <option value="any">Any</option>
                  <option value="yes">Must have Phone</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">Target Jurisdiction</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-[#0D1E24] border border-[#1A3A44] rounded-lg p-2 text-slate-200 outline-none text-xs"
                />
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Real-time Streaming Status Bar */}
      {searchStatus !== 'idle' && (
        <div className="bg-[#0D1E24] border border-[#02A0A0]/40 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              {searchStatus === 'running' ? (
                <RefreshCw className="w-3.5 h-3.5 text-[#02A0A0] animate-spin" />
              ) : searchStatus === 'completed' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#02A0A0]" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              )}
              <span className="text-xs font-semibold text-slate-100">{statusMessage}</span>
            </div>
            <span className="text-xs font-mono text-[#FFBD65] font-bold">
              {discoveredBusinesses.length} clients live-verified
            </span>
          </div>
          <div className="w-full bg-[#071317] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#02A0A0] via-[#52D4D4] to-[#FFBD65] h-full transition-all duration-300 rounded-full"
              style={{ width: `${providerProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Discovered Businesses Stream List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Prospective Clients Feed
            </h2>
            {discoveredBusinesses.length > 0 && (
              <span className="text-[11px] px-2 py-0.2 rounded-full bg-[#02A0A0]/15 text-[#02A0A0] font-mono font-bold border border-[#02A0A0]/30">
                {discoveredBusinesses.length}
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Server-Sent Events (SSE) Active
          </span>
        </div>

        {discoveredBusinesses.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-[#1A3A44] rounded-2xl bg-[#0D1E24]/60">
            <Building className="w-10 h-10 text-[#02A0A0]/40 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-white">Ready for Client Ingestion</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Select an industry niche above or enter a search query to start crawling live business records and calculating opportunities.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {discoveredBusinesses.map((b) => {
              const opps = liveOpportunities[b.id] || [];
              return (
                <div
                  key={b.id}
                  className="bg-[#0D1E24] border border-[#1A3A44] hover:border-[#02A0A0]/60 rounded-xl p-4 transition-all shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left Metadata */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/businesses/${b.id}`}
                        className="text-sm font-bold text-white hover:text-[#02A0A0] transition-colors flex items-center gap-1"
                      >
                        {b.name}
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </Link>

                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#122931] text-slate-300 font-medium">
                        {b.industry}
                      </span>

                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#02A0A0]/10 text-[#02A0A0] font-mono border border-[#02A0A0]/20">
                        {b.website_load_time_ms ? `${b.website_load_time_ms}ms` : '200 OK'}
                      </span>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider border ${
                          b.priority === 'HIGH'
                            ? 'bg-[#FFBD65]/15 text-[#FFBD65] border-[#FFBD65]/30'
                            : 'bg-[#02A0A0]/15 text-[#02A0A0] border-[#02A0A0]/30'
                        }`}
                      >
                        {b.priority} Priority ({b.priority_score}%)
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      {b.city && <span>📍 {b.city}, {b.country}</span>}
                      {b.domain && (
                        <span className="text-[#02A0A0] font-mono">{b.domain}</span>
                      )}
                      {b.email && (
                        <span className="text-slate-300 font-mono flex items-center gap-1">
                          <Mail className="w-3 h-3 text-[#02A0A0]" />
                          {b.email}
                        </span>
                      )}
                      {b.phone && (
                        <span className="text-slate-300 font-mono flex items-center gap-1">
                          <Phone className="w-3 h-3 text-[#FFBD65]" />
                          {b.phone}
                        </span>
                      )}
                      {b.rating && (
                        <span className="text-[#FFBD65] font-semibold flex items-center gap-1">
                          <Star className="w-3 h-3 fill-[#FFBD65]" />
                          {b.rating.toFixed(1)} ({b.review_count})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Deal Value & Action */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden lg:block">
                      <span className="text-xs font-bold text-[#FFBD65] flex items-center justify-end gap-1">
                        <Zap className="w-3 h-3" />
                        {opps[0]?.estimated_revenue_potential || '$4,500 - $9,000/mo'}
                      </span>
                      <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
                        {opps[0]?.onefolk_service || 'Direct Booking Engine'}
                      </p>
                    </div>

                    <Link
                      href={`/businesses/${b.id}`}
                      className="px-3.5 py-1.5 rounded-lg bg-[#122931] hover:bg-[#02A0A0] hover:text-[#071317] text-white text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      Inspect Profile
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
