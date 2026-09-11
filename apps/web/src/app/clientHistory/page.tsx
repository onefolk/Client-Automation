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
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Client History
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/[0.08]">
              {history.length} Saved
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Verified prospect records deduplicated across discovery sessions.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {history.length > 0 && (
            <>
              <button
                onClick={handleExportCSV}
                className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white px-3 py-1.5 rounded-md text-xs font-medium border border-white/[0.08] transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
              <button
                onClick={handleClear}
                className="bg-zinc-900 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 px-3 py-1.5 rounded-md text-xs font-medium border border-white/[0.08] hover:border-rose-500/20 transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            </>
          )}

          <Link
            href="/discover"
            className="bg-white hover:bg-zinc-200 text-black font-semibold px-3.5 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Discover More
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-white/[0.08] bg-[#111113] p-3.5">
          <div className="text-[10px] font-mono text-zinc-500 uppercase">Total Saved</div>
          <div className="text-lg font-bold text-white mt-1">{history.length}</div>
        </div>

        <div className="rounded-lg border border-white/[0.08] bg-[#111113] p-3.5">
          <div className="text-[10px] font-mono text-amber-400 uppercase">High Priority</div>
          <div className="text-lg font-bold text-amber-400 mt-1">{highPriorityCount}</div>
        </div>

        <div className="rounded-lg border border-white/[0.08] bg-[#111113] p-3.5">
          <div className="text-[10px] font-mono text-zinc-400 uppercase">Emails Found</div>
          <div className="text-lg font-bold text-zinc-200 mt-1">{verifiedEmailCount}</div>
        </div>

        <div className="rounded-lg border border-white/[0.08] bg-[#111113] p-3.5">
          <div className="text-[10px] font-mono text-zinc-400 uppercase">Industries</div>
          <div className="text-lg font-bold text-zinc-200 mt-1">{industries.length || 1}</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-2">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search saved clients by name, domain, city..."
            className="w-full bg-[#111113] border border-white/[0.08] focus:border-zinc-500 rounded-md pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 outline-none transition-colors"
          />
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-1 w-full sm:w-auto">
          {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                priorityFilter === p
                  ? 'bg-zinc-800 border-white/[0.12] text-white'
                  : 'bg-[#111113] border-white/[0.06] text-zinc-400 hover:text-white'
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
            className="bg-[#111113] border border-white/[0.08] text-zinc-300 text-xs rounded-md px-2.5 py-2 outline-none focus:border-zinc-500"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((biz) => {
            const domain = biz.domain || (biz.website ? new URL(biz.website).hostname.replace(/^www\./, '') : '');

            return (
              <div
                key={biz.id}
                className="rounded-lg border border-white/[0.08] hover:border-white/[0.18] bg-[#111113] p-4 transition-colors flex flex-col justify-between space-y-3"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase block truncate">
                        {biz.industry} • {biz.city || 'Dubai'}
                      </span>
                      <h3 className="text-sm font-semibold text-white truncate">{biz.name}</h3>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`text-[9px] font-mono font-medium px-2 py-0.5 rounded border ${
                          biz.priority === 'HIGH'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-zinc-800 text-zinc-400 border-white/[0.06]'
                        }`}
                      >
                        {biz.priority}
                      </span>

                      <button
                        onClick={() => handleRemove(biz.id)}
                        title="Remove"
                        className="text-zinc-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Contact Info */}
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
                </div>

                {/* Footer */}
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
      ) : (
        <div className="rounded-lg border border-white/[0.08] bg-[#111113] p-10 text-center space-y-2">
          <Filter className="w-5 h-5 text-zinc-500 mx-auto" />
          <h3 className="text-xs font-semibold text-white">
            {history.length === 0 ? 'No Saved Clients in History' : 'No Matching Clients Found'}
          </h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            {history.length === 0
              ? 'Run a Live Discovery search to uncover high-intent prospective clients.'
              : 'Try adjusting your search filters.'}
          </p>
        </div>
      )}
    </div>
  );
}
