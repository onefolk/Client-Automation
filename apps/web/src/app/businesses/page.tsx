'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { listBusinesses } from '@/lib/api';
import { Building2, Globe, Mail, Phone, Star, Search, ArrowRight, ShieldCheck } from 'lucide-react';

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
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-indigo-400" />
            Master Client Directory
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Verified, deduplicated master database of discovered businesses with full source provenance.
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter businesses by name, industry, or location..."
            className="w-full bg-[#0F172A] border border-[#1E293B] focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                priorityFilter === p
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                  : 'bg-[#0F172A] border-[#1E293B] text-slate-400 hover:text-slate-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of businesses */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-400">Loading master businesses...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[#1E293B] rounded-2xl bg-[#0F172A]/40 text-slate-400">
          No businesses found matching your criteria. Try launching a new search from the Discover page.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((b) => (
            <div
              key={b.id}
              className="bg-[#0F172A] border border-[#1E293B] hover:border-indigo-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block mb-1">
                      {b.industry}
                    </span>
                    <h3 className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors">
                      {b.name}
                    </h3>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border shrink-0 ${
                      b.priority === 'HIGH'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : b.priority === 'MEDIUM'
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                    }`}
                  >
                    {b.priority}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-400 mb-4">
                  {b.city && <p>📍 {b.city}, {b.country}</p>}
                  {b.website && (
                    <p className="flex items-center gap-1.5 truncate text-slate-300">
                      <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      {b.domain}
                    </p>
                  )}
                  {b.email && (
                    <p className="flex items-center gap-1.5 truncate text-slate-300">
                      <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      {b.email}
                    </p>
                  )}
                  {b.rating && (
                    <p className="flex items-center gap-1.5 text-amber-400 font-medium">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                      {b.rating.toFixed(1)} ({b.review_count} reviews)
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-[#1E293B] flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-mono">
                  Confidence: {(b.confidence * 100).toFixed(0)}%
                </span>
                <Link
                  href={`/businesses/${b.id}`}
                  className="text-xs font-semibold text-indigo-400 group-hover:text-indigo-300 flex items-center gap-1"
                >
                  Intelligence Profile
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
