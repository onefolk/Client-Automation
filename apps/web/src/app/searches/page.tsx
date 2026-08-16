'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { listSearches } from '@/lib/api';
import { History, Search, ArrowRight } from 'lucide-react';

export default function SearchesPage() {
  const { data: searches = [], isLoading } = useQuery({
    queryKey: ['searches'],
    queryFn: listSearches,
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <History className="w-7 h-7 text-[#02A0A0]" />
          Search Session History
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Historical log of live discovery searches, execution runtimes, and client yield statistics.
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-slate-400">Loading search sessions...</div>
      ) : searches.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[#1A3A44] rounded-2xl bg-[#0D1E24]/60 text-slate-400">
          No searches conducted yet.
        </div>
      ) : (
        <div className="bg-[#0D1E24] border border-[#1A3A44] rounded-2xl overflow-hidden shadow-xl shadow-black/20">
          <div className="divide-y divide-[#1A3A44]">
            {searches.map((s) => (
              <div key={s.id} className="p-5 flex items-center justify-between hover:bg-[#122931]/50 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-[#02A0A0]" />
                      &quot;{s.query}&quot;
                    </h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        s.status === 'COMPLETED'
                          ? 'bg-[#02A0A0]/20 text-[#02A0A0]'
                          : s.status === 'RUNNING'
                          ? 'bg-[#FFBD65]/20 text-[#FFBD65] animate-pulse'
                          : 'bg-slate-500/15 text-slate-400'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>Target: {s.filters.industry || 'All'} in {s.filters.city || s.filters.location || 'Global'}</span>
                    <span>•</span>
                    <span>Discovered: {s.total_discovered} clients</span>
                    <span>•</span>
                    <span>Saved: {s.total_saved} master records</span>
                    <span>•</span>
                    <span>{new Date(s.created_at).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {s.duration_ms && (
                    <span className="text-xs font-mono text-[#FFBD65]">
                      {(s.duration_ms / 1000).toFixed(2)}s
                    </span>
                  )}
                  <Link
                    href={`/discover`}
                    className="p-2 rounded-xl bg-[#122931] text-slate-300 hover:text-[#071317] hover:bg-[#02A0A0] transition-all text-xs font-bold flex items-center gap-1"
                  >
                    Repeat
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
