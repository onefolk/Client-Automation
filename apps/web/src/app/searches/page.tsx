'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { listSearches } from '@/lib/api';
import { History, Search, ArrowRight, Clock, RefreshCw, Layers } from 'lucide-react';

export default function SearchesPage() {
  const { data: searches = [], isLoading } = useQuery({
    queryKey: ['searches'],
    queryFn: listSearches,
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <History className="w-5 h-5" />
            </div>
            Search Session History
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Historical audit log of real-time discovery queries, execution runtimes, and client yield statistics.
          </p>
        </div>

        <span className="text-xs font-mono text-slate-300 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] w-fit">
          Total Sessions: <strong className="text-white font-bold">{searches.length}</strong>
        </span>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <RefreshCw className="w-6 h-6 text-blue-400 animate-spin mb-3" />
          <p className="text-xs text-slate-400">Loading discovery session logs...</p>
        </div>
      ) : searches.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-white/[0.08] rounded-3xl bg-[#0E1118]/50 p-8">
          <History className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No Search Sessions Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            You have not run any discovery sessions yet. Start your first search on the Discover page.
          </p>
          <Link
            href="/discover"
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition-all"
          >
            Start Discovery
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="bg-[#0E1118] border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl divide-y divide-white/[0.06]">
          {searches.map((s) => (
            <div
              key={s.id}
              className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-blue-400" />
                    &quot;{s.query}&quot;
                  </h3>
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border font-mono ${
                      s.status === 'COMPLETED'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : s.status === 'RUNNING'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                    }`}
                  >
                    {s.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span>Target: <strong className="text-slate-300">{s.filters.industry || 'All Industries'}</strong> in <strong className="text-slate-300">{s.filters.city || s.filters.location || 'Global'}</strong></span>
                  <span className="text-slate-600">•</span>
                  <span>Yield: <strong className="text-blue-400">{s.total_discovered} clients</strong></span>
                  <span className="text-slate-600">•</span>
                  <span>Master Saved: <strong className="text-emerald-400">{s.total_saved}</strong></span>
                  <span className="text-slate-600">•</span>
                  <span className="text-[11px] text-slate-500 font-mono">{new Date(s.created_at).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {s.duration_ms && (
                  <span className="text-xs font-mono text-amber-400 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    {(s.duration_ms / 1000).toFixed(2)}s
                  </span>
                )}
                <Link
                  href="/discover"
                  className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-blue-600 text-slate-300 hover:text-white border border-white/[0.06] hover:border-blue-500/30 transition-all text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  Repeat
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
