'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { listSearches } from '@/lib/api';
import { History, Search, ArrowRight, RefreshCw } from 'lucide-react';

export default function SearchesPage() {
  const { data: searches = [], isLoading } = useQuery({
    queryKey: ['searches'],
    queryFn: listSearches,
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Search Sessions
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/[0.08]">
              {searches.length} Logs
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Audit history of real-time discovery queries and run statistics.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <RefreshCw className="w-5 h-5 text-zinc-400 animate-spin mb-3" />
          <p className="text-xs text-zinc-400">Loading session logs...</p>
        </div>
      ) : searches.length === 0 ? (
        <div className="rounded-lg border border-white/[0.08] bg-[#111113] p-10 text-center space-y-2">
          <History className="w-5 h-5 text-zinc-500 mx-auto" />
          <h3 className="text-xs font-semibold text-white">No Search Sessions</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Run a discovery session to record query logs.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-white/[0.08] bg-[#111113] divide-y divide-white/[0.06]">
          {searches.map((s) => (
            <div
              key={s.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white">&quot;{s.query}&quot;</span>
                  <span
                    className={`text-[9px] font-mono font-medium px-2 py-0.5 rounded border ${
                      s.status === 'COMPLETED'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-zinc-800 text-zinc-400 border-white/[0.06]'
                    }`}
                  >
                    {s.status}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-zinc-400 text-[11px] flex-wrap">
                  <span>Target: {s.filters.industry || 'All'} in {s.filters.city || 'Global'}</span>
                  <span>•</span>
                  <span>Yield: {s.total_discovered}</span>
                  <span>•</span>
                  <span>Saved: {s.total_saved}</span>
                  <span>•</span>
                  <span className="text-zinc-500 font-mono">{new Date(s.created_at).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {s.duration_ms && (
                  <span className="text-zinc-400 font-mono text-[11px]">
                    {(s.duration_ms / 1000).toFixed(2)}s
                  </span>
                )}
                <Link
                  href="/discover"
                  className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/[0.08] transition-colors text-xs flex items-center gap-1 font-medium"
                >
                  Rerun <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
