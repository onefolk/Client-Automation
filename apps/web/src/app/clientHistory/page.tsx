'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  History,
  Building2,
  Globe,
  Mail,
  Phone,
  Star,
  Search,
  ArrowRight,
  ShieldCheck,
  Trash2,
  Download,
  Filter,
  Sparkles,
  Zap,
  Check,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { Business } from '@/lib/types';
import {
  getClientHistory,
  removeClientFromHistory,
  clearClientHistory,
} from '@/lib/client-history';

export default function ClientHistoryPage() {
  const [history, setHistory] = useState<Business[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [industryFilter, setIndustryFilter] = useState('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    // Load initial history
    setHistory(getClientHistory());

    const handleUpdate = (e: any) => {
      setHistory(e.detail || getClientHistory());
    };

    window.addEventListener('onefolk:history-updated', handleUpdate);
    return () => window.removeEventListener('onefolk:history-updated', handleUpdate);
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleRemove = (id: string) => {
    const updated = removeClientFromHistory(id);
    setHistory(updated);
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all discovered client history?')) {
      clearClientHistory();
      setHistory([]);
    }
  };

  const handleExportCSV = () => {
    if (history.length === 0) return;
    const headers = ['Name', 'Industry', 'City', 'Country', 'Website', 'Email', 'Phone', 'Priority', 'Rating', 'DiscoveredAt'];
    const rows = history.map((b) => [
      `"${b.name}"`,
      `"${b.industry || ''}"`,
      `"${b.city || ''}"`,
      `"${b.country || ''}"`,
      `"${b.website || b.domain || ''}"`,
      `"${b.email || ''}"`,
      `"${b.phone || ''}"`,
      `"${b.priority || 'MEDIUM'}"`,
      b.rating || '',
      `"${b.discovered_at || b.created_at || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `onefolk_client_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Extract unique industries for filter dropdown
  const industries = Array.from(new Set(history.map((b) => b.industry).filter(Boolean)));

  const filtered = history.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.industry && b.industry.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (b.city && b.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (b.domain && b.domain.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesPriority = priorityFilter === 'ALL' || b.priority === priorityFilter;
    const matchesIndustry = industryFilter === 'ALL' || b.industry === industryFilter;

    return matchesSearch && matchesPriority && matchesIndustry;
  });

  const highPriorityCount = history.filter((b) => b.priority === 'HIGH').length;
  const verifiedEmailCount = history.filter((b) => b.email).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1A3A44]/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#02A0A0]/20 to-[#FFBD65]/10 border border-[#02A0A0]/30 text-[#02A0A0]">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Discovered Client History
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#02A0A0]/15 text-[#02A0A0] border border-[#02A0A0]/30">
                  {history.length} SAVED
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                All clients discovered across your search sessions. Deduplicated and preserved permanently.
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {history.length > 0 && (
            <>
              <button
                onClick={handleExportCSV}
                className="bg-[#0D1E24] hover:bg-[#122931] text-slate-200 hover:text-white px-3 py-2 rounded-xl text-xs font-semibold border border-[#1A3A44] transition-all flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-[#02A0A0]" />
                Export CSV
              </button>
              <button
                onClick={handleClear}
                className="bg-[#0D1E24] hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 px-3 py-2 rounded-xl text-xs font-semibold border border-[#1A3A44] hover:border-rose-900/50 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All
              </button>
            </>
          )}

          <Link
            href="/discover"
            className="bg-[#02A0A0] hover:bg-[#22BDBD] text-[#071317] font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md shadow-[#02A0A0]/20 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Discover More
          </Link>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#0D1E24] border border-[#1A3A44] rounded-xl p-3.5">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Discovered</div>
          <div className="text-xl font-bold text-white mt-1">{history.length}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Deduplicated entities</div>
        </div>

        <div className="bg-[#0D1E24] border border-[#1A3A44] rounded-xl p-3.5">
          <div className="text-[10px] font-bold text-[#FFBD65] uppercase tracking-wider">High Priority</div>
          <div className="text-xl font-bold text-[#FFBD65] mt-1">{highPriorityCount}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Immediate qualification</div>
        </div>

        <div className="bg-[#0D1E24] border border-[#1A3A44] rounded-xl p-3.5">
          <div className="text-[10px] font-bold text-[#02A0A0] uppercase tracking-wider">Contact Complete</div>
          <div className="text-xl font-bold text-[#02A0A0] mt-1">{verifiedEmailCount}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Verified emails extracted</div>
        </div>

        <div className="bg-[#0D1E24] border border-[#1A3A44] rounded-xl p-3.5">
          <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Industries</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{industries.length || 1}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Active market verticals</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search history by name, domain, city, or industry..."
            className="w-full bg-[#0D1E24] border border-[#1A3A44] focus:border-[#02A0A0] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition-all"
          />
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`px-3 py-2 rounded-xl text-[11px] font-bold border transition-all ${
                priorityFilter === p
                  ? 'bg-[#02A0A0] border-[#02A0A0] text-[#071317] shadow-sm shadow-[#02A0A0]/20'
                  : 'bg-[#0D1E24] border-[#1A3A44] text-slate-400 hover:text-slate-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Industry Filter Dropdown */}
        {industries.length > 0 && (
          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            className="bg-[#0D1E24] border border-[#1A3A44] text-slate-300 text-[11px] rounded-xl px-3 py-2 outline-none focus:border-[#02A0A0] font-medium"
          >
            <option value="ALL">All Industries</option>
            {industries.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Client List */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((biz) => {
            const domain = biz.domain || (biz.website ? new URL(biz.website).hostname.replace(/^www\./, '') : '');

            return (
              <div
                key={biz.id}
                className="bg-[#0D1E24] border border-[#1A3A44] hover:border-[#02A0A0]/50 rounded-2xl p-4.5 transition-all duration-200 shadow-xl flex flex-col justify-between group"
              >
                <div>
                  {/* Top Bar: Priority + Delete */}
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                        biz.priority === 'HIGH'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : biz.priority === 'MEDIUM'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                      }`}
                    >
                      {biz.priority} PRIORITY ({biz.priority_score || 75}/100)
                    </span>

                    <button
                      onClick={() => handleRemove(biz.id)}
                      title="Remove from history"
                      className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-950/30 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Business Name & Industry */}
                  <div className="mb-2.5">
                    <h3 className="text-sm font-bold text-white group-hover:text-[#02A0A0] transition-colors leading-tight">
                      {biz.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                      <Building2 className="w-3 h-3 text-[#02A0A0]" />
                      <span>{biz.industry}</span>
                      <span>•</span>
                      <span>{biz.city || 'Dubai'}, {biz.country || 'UAE'}</span>
                    </div>
                  </div>

                  {/* Key Contact / Domain Badges */}
                  <div className="space-y-1.5 pt-2 border-t border-[#1A3A44]/60 text-xs">
                    {/* Website */}
                    {biz.website && (
                      <div className="flex items-center justify-between text-slate-300">
                        <div className="flex items-center gap-1.5 truncate">
                          <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="text-[11px] font-mono truncate">{domain}</span>
                        </div>
                        <a
                          href={biz.website.startsWith('http') ? biz.website : `https://${biz.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-[#02A0A0] p-0.5 shrink-0"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {/* Email */}
                    {biz.email && (
                      <div className="flex items-center justify-between text-slate-300">
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="w-3 h-3 text-[#02A0A0] shrink-0" />
                          <span className="text-[11px] font-mono truncate">{biz.email}</span>
                        </div>
                        <button
                          onClick={() => handleCopy(biz.email!, `email-${biz.id}`)}
                          className="text-slate-400 hover:text-[#02A0A0] p-0.5 shrink-0"
                          title="Copy email"
                        >
                          {copiedId === `email-${biz.id}` ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* Phone */}
                    {biz.phone && (
                      <div className="flex items-center justify-between text-slate-300">
                        <div className="flex items-center gap-1.5 truncate">
                          <Phone className="w-3 h-3 text-[#FFBD65] shrink-0" />
                          <span className="text-[11px] font-mono truncate">{biz.phone}</span>
                        </div>
                        <button
                          onClick={() => handleCopy(biz.phone!, `phone-${biz.id}`)}
                          className="text-slate-400 hover:text-[#02A0A0] p-0.5 shrink-0"
                          title="Copy phone"
                        >
                          {copiedId === `phone-${biz.id}` ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Signals Bar */}
                  <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                    {biz.has_ssl && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-medium flex items-center gap-1">
                        <ShieldCheck className="w-2.5 h-2.5" /> SSL
                      </span>
                    )}
                    {biz.is_mobile_friendly && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono font-medium">
                        Mobile Ready
                      </span>
                    )}
                    {biz.rating && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono font-medium flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 fill-amber-300" /> {biz.rating} ({biz.review_count})
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-3.5 mt-3 border-t border-[#1A3A44]/60 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">
                    Confidence: {Math.round((biz.confidence || 0.98) * 100)}%
                  </span>

                  <Link
                    href={`/businesses/${biz.id}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#02A0A0] hover:text-[#22BDBD] transition-colors"
                  >
                    Deep Intelligence <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#0D1E24] border border-[#1A3A44] rounded-2xl p-12 text-center space-y-3">
          <div className="p-3 bg-slate-800/40 rounded-full w-fit mx-auto text-slate-400">
            <Filter className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white">
            {history.length === 0 ? 'No Discovered Clients in History Yet' : 'No Matching Clients Found'}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {history.length === 0
              ? 'Run a Live Discovery search to uncover high-intent prospective clients across any niche and location.'
              : 'Try clearing your search query or adjusting your priority filter.'}
          </p>
          {history.length === 0 && (
            <Link
              href="/discover"
              className="inline-flex items-center gap-2 bg-[#02A0A0] text-[#071317] font-bold px-4 py-2 rounded-xl text-xs shadow-md shadow-[#02A0A0]/20 hover:bg-[#22BDBD] transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Go to Live Discovery
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
