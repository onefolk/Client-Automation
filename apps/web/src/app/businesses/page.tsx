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
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Master Client Directory
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/[0.08]">
              {businesses.length} Records
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Deduplicated master database with full source provenance and confidence metrics.
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row items-center gap-2">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by client name, industry, or location..."
            className="w-full bg-[#111113] border border-white/[0.08] focus:border-zinc-500 rounded-md pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 outline-none transition-colors"
          />
        </div>

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
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <RefreshCw className="w-5 h-5 text-zinc-400 animate-spin mb-3" />
          <p className="text-xs text-zinc-400">Loading master records...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-white/[0.08] bg-[#111113] p-10 text-center space-y-2">
          <Building2 className="w-5 h-5 text-zinc-500 mx-auto" />
          <h3 className="text-xs font-semibold text-white">No Clients Found</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Try launching a new search from the Discover page.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((b) => (
            <div
              key={b.id}
              className="rounded-lg border border-white/[0.08] hover:border-white/[0.18] bg-[#111113] p-4 transition-colors flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase block truncate">
                      {b.industry || 'Business'}
                    </span>
                    <h3 className="text-sm font-semibold text-white truncate">{b.name}</h3>
                  </div>
                  <span
                    className={`text-[9px] font-mono font-medium px-2 py-0.5 rounded border shrink-0 ${
                      b.priority === 'HIGH'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-zinc-800 text-zinc-400 border-white/[0.06]'
                    }`}
                  >
                    {b.priority}
                  </span>
                </div>

                <div className="space-y-1.5 pt-3 mt-3 border-t border-white/[0.06] text-xs">
                  {b.city && (
                    <p className="flex items-center gap-1.5 text-zinc-400">
                      <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      {b.city}, {b.country}
                    </p>
                  )}
                  {b.website && (
                    <p className="flex items-center gap-1.5 truncate text-zinc-300 font-mono text-[11px]">
                      <Globe className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      {b.domain}
                    </p>
                  )}
                  {b.email && (
                    <p className="flex items-center gap-1.5 truncate text-zinc-300 font-mono text-[11px]">
                      <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      {b.email}
                    </p>
                  )}
                  {b.rating && (
                    <p className="flex items-center gap-1.5 text-amber-400 font-medium text-xs">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                      {b.rating.toFixed(1)} <span className="text-zinc-500 font-normal">({b.review_count} reviews)</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 font-mono">
                  Confidence: {Math.round((b.confidence || 0.95) * 100)}%
                </span>
                <Link
                  href={`/businesses/${b.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-white hover:text-zinc-300 transition-colors"
                >
                  Intelligence <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
