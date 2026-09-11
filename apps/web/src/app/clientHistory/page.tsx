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
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.07] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <History className="w-4.5 h-4.5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Discovered Client History
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-300 border border-white/[0.08]">
                  {history.length} SAVED
                </span>
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                All discovered prospects saved permanently. Deduplicated across all search sessions.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {history.length > 0 && (
            <>
              <button
                onClick={handleExportCSV}
                className="bg-white/[0.03] hover:bg-white/[0.07] text-zinc-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-medium border border-white/[0.08] transition-all flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                Export CSV
              </button>
              <button
                onClick={handleClear}
                className="bg-white/[0.03] hover:bg-rose-500/10 text-zinc-400 hover:text-rose-400 px-3 py-1.5 rounded-xl text-xs font-medium border border-white/[0.08] hover:border-rose-500/20 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All
              </button>
            </>
          )}

          <Link
            href="/discover"
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3.5 py-1.5 rounded-xl text-xs transition-all shadow-md shadow-blue-600/25 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Discover More
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#0E1118] border border-white/[0.07] rounded-xl p-4">
          <div className="text-[10px] font-bold text-zinc-500 uppercase font-mono tracking-wider">Total Discovered</div>
          <div className="text-xl font-bold text-white mt-1">{history.length}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Deduplicated entities</div>
        </div>

        <div className="bg-[#0E1118] border border-white/[0.07] rounded-xl p-4">
          <div className="text-[10px] font-bold text-rose-400 uppercase font-mono tracking-wider">High Priority</div>
          <div className="text-xl font-bold text-rose-400 mt-1">{highPriorityCount}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Immediate qualification</div>
        </div>

        <div className="bg-[#0E1118] border border-white/[0.07] rounded-xl p-4">
          <div className="text-[10px] font-bold text-blue-400 uppercase font-mono tracking-wider">Contact Complete</div>
          <div className="text-xl font-bold text-blue-400 mt-1">{verifiedEmailCount}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Verified emails extracted</div>
        </div>

        <div className="bg-[#0E1118] border border-white/[0.07] rounded-xl p-4">
          <div className="text-[10px] font-bold text-emerald-400 uppercase font-mono tracking-wider">Industries</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{industries.length || 1}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Active market verticals</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-2.5">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search history by name, domain, city, or industry..."
            className="w-full bg-[#0E1118] border border-white/[0.08] focus:border-blue-500/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 outline-none transition-all font-medium"
          />
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-1 w-full sm:w-auto">
          {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`px-3 py-2 rounded-xl text-[11px] font-semibold border transition-all ${
                priorityFilter === p
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'bg-[#0E1118] border-white/[0.07] text-zinc-400 hover:text-white'
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
            className="bg-[#0E1118] border border-white/[0.08] text-zinc-300 text-[11px] rounded-xl px-3 py-2 outline-none focus:border-blue-500/80 font-medium"
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
                className="bg-[#0E1118] border border-white/[0.08] hover:border-white/[0.18] rounded-2xl p-4.5 transition-all duration-200 shadow-xl flex flex-col justify-between group"
              >
                <div>
                  {/* Top Bar: Avatar + Priority + Delete */}
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600/30 via-indigo-600/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center font-bold text-xs text-blue-300 font-mono shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors leading-tight truncate">
                          {biz.name}
                        </h3>
                        <div className="text-[11px] text-zinc-400 truncate">
                          {biz.industry} • {biz.city || 'Dubai'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                          biz.priority === 'HIGH'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : biz.priority === 'MEDIUM'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                        }`}
                      >
                        {biz.priority}
                      </span>

                      <button
                        onClick={() => handleRemove(biz.id)}
                        title="Remove from history"
                        className="text-zinc-500 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-1.5 py-2 border-t border-white/[0.06] text-xs">
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
                          className="text-zinc-500 hover:text-blue-400 p-0.5 shrink-0"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {biz.email && (
                      <div className="flex items-center justify-between text-zinc-300">
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="text-[11px] font-mono truncate">{biz.email}</span>
                        </div>
                        <button
                          onClick={() => handleCopy(biz.email!, `em-${biz.id}`)}
                          className="text-zinc-500 hover:text-blue-400 p-0.5 shrink-0"
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
                          <Phone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-[11px] font-mono truncate">{biz.phone}</span>
                        </div>
                        <button
                          onClick={() => handleCopy(biz.phone!, `ph-${biz.id}`)}
                          className="text-zinc-500 hover:text-blue-400 p-0.5 shrink-0"
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

                  {/* Signals */}
                  <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
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
                        <Star className="w-2.5 h-2.5 fill-amber-300" /> {biz.rating} ({biz.review_count})
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-3 mt-3.5 border-t border-white/[0.06] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">
                    Confidence: {Math.round((biz.confidence || 0.98) * 100)}%
                  </span>

                  <Link
                    href={`/businesses/${biz.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Deep Intelligence <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#0E1118] border border-white/[0.08] rounded-2xl p-12 text-center space-y-3">
          <div className="p-3 bg-white/[0.03] rounded-full w-fit mx-auto text-zinc-400">
            <Filter className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white">
            {history.length === 0 ? 'No Saved Clients in History Yet' : 'No Matching Clients Found'}
          </h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            {history.length === 0
              ? 'Run a Live Discovery search to uncover high-intent prospective clients across any niche and location.'
              : 'Try clearing your search query or adjusting your priority filter.'}
          </p>
          {history.length === 0 && (
            <Link
              href="/discover"
              className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold px-4 py-2 rounded-xl text-xs shadow-md shadow-blue-600/25 hover:bg-blue-500 transition-all"
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
