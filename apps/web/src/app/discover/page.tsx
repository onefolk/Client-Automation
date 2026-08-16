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
} from 'lucide-react';
import { createSearch } from '@/lib/api';
import { useSearchSSE } from '@/lib/sse';
import { Business, SearchFilters, SystemEvent, Opportunity } from '@/lib/types';

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
        setStatusMessage(`Scanning live directory: ${event.data.query_variation}`);
        setProviderProgress((prev) => Math.min(prev + 12, 85));
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
          `100% Live Discovery Complete: ${event.data.total_saved} real businesses discovered & crawled (${event.data.duration_ms}ms)`
        );
        break;

      case 'search.failed':
        setSearchStatus('failed');
        setStatusMessage(`Search failed: ${event.data.error}`);
        break;
    }
  }, []);

  useSearchSSE(currentSearchId, handleSSEEvent);

  const handleStartSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setDiscoveredBusinesses([]);
    setLiveOpportunities({});
    setSearchStatus('running');
    setProviderProgress(10);
    setStatusMessage('Querying live public web registries & crawling domains...');

    try {
      const filters: SearchFilters = {
        industry: industry || undefined,
        city: city || undefined,
        country: country || undefined,
        has_website: hasWebsite,
        has_email: hasEmail,
        has_phone: hasPhone,
        no_booking_system: noBooking ? true : undefined,
        no_lead_form: weakLeadCapture ? true : undefined,
      };

      const res = await createSearch(query, filters, ['live_public_registry']);
      setCurrentSearchId(res.search_id);
    } catch (err: any) {
      setSearchStatus('failed');
      setStatusMessage(`Error launching live search: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Target className="w-7 h-7 text-indigo-400" />
            Live Client Discovery & Intelligence
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time public web discovery, live HTTP website crawling, automated contact extraction, and opportunity mapping.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          100% Live Real-Time Mode Active
        </div>
      </div>

      {/* Main Search Filter Panel */}
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-6 shadow-xl shadow-black/20">
        <form onSubmit={handleStartSearch} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Query Input */}
            <div className="md:col-span-5 relative">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Target Business Query or Keywords
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. Japanese restaurants, dental clinics, luxury spas, law firms..."
                  className="w-full bg-[#090D16] border border-[#1E293B] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 transition-all outline-none"
                />
              </div>
            </div>

            {/* Industry Input */}
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Industry
              </label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Restaurant & Hospitality"
                className="w-full bg-[#090D16] border border-[#1E293B] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition-all outline-none"
              />
            </div>

            {/* City / Location Input */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                City / Location
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Dubai"
                className="w-full bg-[#090D16] border border-[#1E293B] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition-all outline-none"
              />
            </div>

            {/* Submit Action */}
            <div className="md:col-span-2 flex items-end">
              <button
                type="submit"
                disabled={searchStatus === 'running'}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.98] text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {searchStatus === 'running' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    Crawling...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-cyan-300" />
                    Start Live Search
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Filters / Advanced Accordion */}
          <div className="pt-3 border-t border-[#1E293B]/60 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">Verification Filters:</span>
              <button
                type="button"
                onClick={() => setNoBooking(!noBooking)}
                className={`px-3 py-1 rounded-lg border transition-all ${
                  noBooking
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                    : 'bg-[#090D16] border-[#1E293B] text-slate-400 hover:text-slate-300'
                }`}
              >
                ⚡ No Direct Booking Engine
              </button>
              <button
                type="button"
                onClick={() => setWeakLeadCapture(!weakLeadCapture)}
                className={`px-3 py-1 rounded-lg border transition-all ${
                  weakLeadCapture
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                    : 'bg-[#090D16] border-[#1E293B] text-slate-400 hover:text-slate-300'
                }`}
              >
                🎯 Weak Lead Capture
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {showAdvanced ? 'Hide Advanced Matrix' : 'Digital & Opportunity Matrix'}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showAdvanced && (
            <div className="p-4 bg-[#090D16]/80 rounded-xl border border-[#1E293B] grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Has Website</label>
                <select
                  value={hasWebsite === undefined ? 'any' : hasWebsite ? 'yes' : 'no'}
                  onChange={(e) => setHasWebsite(e.target.value === 'any' ? undefined : e.target.value === 'yes')}
                  className="w-full bg-[#0F172A] border border-[#1E293B] rounded-lg p-2 text-slate-200 outline-none"
                >
                  <option value="any">Any</option>
                  <option value="yes">Yes (Must have)</option>
                  <option value="no">No Website</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Public Email</label>
                <select
                  value={hasEmail === undefined ? 'any' : hasEmail ? 'yes' : 'no'}
                  onChange={(e) => setHasEmail(e.target.value === 'any' ? undefined : e.target.value === 'yes')}
                  className="w-full bg-[#0F172A] border border-[#1E293B] rounded-lg p-2 text-slate-200 outline-none"
                >
                  <option value="any">Any</option>
                  <option value="yes">Must have Email</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Phone Contact</label>
                <select
                  value={hasPhone === undefined ? 'any' : hasPhone ? 'yes' : 'no'}
                  onChange={(e) => setHasPhone(e.target.value === 'any' ? undefined : e.target.value === 'yes')}
                  className="w-full bg-[#0F172A] border border-[#1E293B] rounded-lg p-2 text-slate-200 outline-none"
                >
                  <option value="any">Any</option>
                  <option value="yes">Must have Phone</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Target Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-[#0F172A] border border-[#1E293B] rounded-lg p-2 text-slate-200 outline-none"
                />
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Real-time Streaming Status Bar */}
      {searchStatus !== 'idle' && (
        <div className="bg-[#0F172A] border border-indigo-900/50 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              {searchStatus === 'running' ? (
                <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
              ) : searchStatus === 'completed' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              )}
              <span className="text-sm font-semibold text-slate-200">{statusMessage}</span>
            </div>
            <span className="text-xs font-mono text-indigo-400 font-medium">
              {discoveredBusinesses.length} live businesses crawled
            </span>
          </div>
          <div className="w-full bg-[#090D16] h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 h-full transition-all duration-300 rounded-full"
              style={{ width: `${providerProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Discovered Businesses Stream List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Live Discovered Businesses</span>
            {discoveredBusinesses.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                {discoveredBusinesses.length} Verified
              </span>
            )}
          </h2>
          <span className="text-xs text-slate-400">
            Realtime Stream via Server-Sent Events (SSE)
          </span>
        </div>

        {discoveredBusinesses.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-[#1E293B] rounded-2xl bg-[#0F172A]/40">
            <Building className="w-12 h-12 text-slate-600 mx-auto mb-3 animate-pulse-subtle" />
            <h3 className="text-base font-semibold text-slate-300">Ready to Discover Live Clients</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Select your target industry and location above to initiate real-time public discovery, HTTP crawling, and agency opportunity mapping.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {discoveredBusinesses.map((b) => {
              const opps = liveOpportunities[b.id] || [];
              return (
                <div
                  key={b.id}
                  className="bg-[#0F172A] border border-[#1E293B] hover:border-indigo-500/50 rounded-2xl p-5 transition-all shadow-md hover:shadow-indigo-500/5"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Identity & Core attributes */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <Link
                          href={`/businesses/${b.id}`}
                          className="text-base font-bold text-white hover:text-indigo-400 transition-colors flex items-center gap-1.5"
                        >
                          {b.name}
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                        </Link>
                        
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1E293B] text-slate-300 font-medium">
                          {b.industry}
                        </span>

                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-mono flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          Live Crawled ({b.website_load_time_ms}ms)
                        </span>

                        {/* Priority Badge */}
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                            b.priority === 'HIGH'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : b.priority === 'MEDIUM'
                              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                          }`}
                        >
                          {b.priority} Priority ({b.priority_score}%)
                        </span>
                      </div>

                      {/* Location & Contact Meta */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                        {b.city && <span>📍 {b.city}, {b.country}</span>}
                        {b.website && (
                          <a
                            href={b.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-400 hover:underline flex items-center gap-1"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            {b.domain || 'Website'}
                          </a>
                        )}
                        {b.email && (
                          <span className="text-slate-300 flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-cyan-400" />
                            {b.email}
                          </span>
                        )}
                        {b.phone && (
                          <span className="text-slate-300 flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-emerald-400" />
                            {b.phone}
                          </span>
                        )}
                        {b.rating && (
                          <span className="flex items-center gap-1 text-amber-400 font-medium">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            {b.rating.toFixed(1)} ({b.review_count} reviews)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Detected Opportunities & Quick Action */}
                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <div className="text-xs font-semibold text-indigo-400 flex items-center justify-end gap-1">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          {opps.length > 0 ? `${opps.length} Real Opportunities` : 'High Agency Value Fit'}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {opps[0]?.onefolk_service || 'Direct Funnel + Retention Architecture'}
                        </p>
                      </div>

                      <Link
                        href={`/businesses/${b.id}`}
                        className="px-4 py-2 rounded-xl bg-[#1E293B] hover:bg-indigo-600 text-slate-200 hover:text-white text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0"
                      >
                        View Profile
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
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
