'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { listBusinesses } from '@/lib/api';
import {
  Building2,
  Globe,
  Mail,
  Phone,
  Star,
  Search,
  ArrowRight,
  ShieldCheck,
  MapPin,
  RefreshCw,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';

export default function BusinessesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  const { data: businesses = [], isLoading } = useQuery({
    queryKey: ['businesses', priorityFilter],
    queryFn: () => listBusinesses({ priority: priorityFilter === 'ALL' ? undefined : priorityFilter }),
  });

  const filtered = businesses.filter(
    (b) =>
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.industry.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.city && b.city.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Building2 className="w-5 h-5" />
            </div>
            Master Client Directory
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Verified, deduplicated master database of discovered clients with full source provenance and confidence metrics.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-slate-300">
            Total Records: <strong className="text-white font-bold">{businesses.length}</strong>
          </span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by client name, industry, or location..."
            className="w-full bg-[#0E1118] border border-white/[0.08] focus:border-blue-500/50 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition-all shadow-inner"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto p-1 bg-[#0E1118] border border-white/[0.08] rounded-2xl">
          {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => {
            const isSelected = priorityFilter === p;
            return (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of businesses */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <RefreshCw className="w-6 h-6 text-blue-400 animate-spin mb-3" />
          <p className="text-xs text-slate-400">Loading master records from database...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-white/[0.08] rounded-3xl bg-[#0E1118]/50 p-8">
          <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No Clients Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            No businesses match your active search or priority filter. Try launching a live discovery run.
          </p>
          <Link
            href="/discover"
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition-all"
          >
            Launch Live Discovery
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((b) => (
            <div
              key={b.id}
              className="bg-[#0E1118] border border-white/[0.08] hover:border-blue-500/40 rounded-3xl p-5 flex flex-col justify-between transition-all group shadow-xl hover:shadow-2xl hover:shadow-black/60 relative overflow-hidden"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider block font-mono">
                      {b.industry || 'Local Business'}
                    </span>
                    <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                      {b.name}
                    </h3>
                  </div>
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border shrink-0 ${
                      b.priority === 'HIGH'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : b.priority === 'MEDIUM'
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                    }`}
                  >
                    {b.priority}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-400 mb-5">
                  {b.city && (
                    <p className="flex items-center gap-1.5 text-slate-400 text-xs">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      {b.city}, {b.country}
                    </p>
                  )}
                  {b.website && (
                    <p className="flex items-center gap-1.5 truncate text-slate-300 font-mono text-[11px]">
                      <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      {b.domain}
                    </p>
                  )}
                  {b.email && (
                    <p className="flex items-center gap-1.5 truncate text-slate-300 font-mono text-[11px]">
                      <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      {b.email}
                    </p>
                  )}
                  {b.rating && (
                    <p className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                      {b.rating.toFixed(1)} <span className="text-slate-500 font-normal">({b.review_count} reviews)</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-mono">
                  Confidence: <strong className="text-slate-300">{(b.confidence * 100).toFixed(0)}%</strong>
                </span>
                <Link
                  href={`/businesses/${b.id}`}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 group/btn"
                >
                  Intelligence
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-1" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
