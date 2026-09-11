'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { listOpportunities } from '@/lib/api';
import { Sparkles, Zap, ArrowRight, TrendingUp, Layers, RefreshCw, Briefcase } from 'lucide-react';

export default function OpportunitiesPage() {
  const { data: opportunities = [], isLoading } = useQuery({
    queryKey: ['opportunities'],
    queryFn: listOpportunities,
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            Agency Opportunity Matrix
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            High-probability agency value creation vectors automatically mapped to OneFolk conversion systems.
          </p>
        </div>

        <span className="text-xs font-mono text-slate-300 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] w-fit">
          Active Opportunities: <strong className="text-white font-bold">{opportunities.length}</strong>
        </span>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <RefreshCw className="w-6 h-6 text-blue-400 animate-spin mb-3" />
          <p className="text-xs text-slate-400">Synthesizing opportunities across discovered accounts...</p>
        </div>
      ) : opportunities.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-white/[0.08] rounded-3xl bg-[#0E1118]/50 p-8">
          <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No Opportunities Generated Yet</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Launch a discovery search or run Grok AI audits to populate high-value agency opportunities.
          </p>
          <Link
            href="/discover"
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition-all"
          >
            Launch Discovery Run
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {opportunities.map((opp) => (
            <div
              key={opp.id}
              className="bg-[#0E1118] border border-white/[0.08] hover:border-blue-500/40 rounded-3xl p-6 flex flex-col justify-between transition-all shadow-xl hover:shadow-2xl relative overflow-hidden group"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                      <Zap className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                      {opp.title}
                    </h3>
                  </div>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 font-mono">
                    {opp.impact} Impact
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{opp.description}</p>

                <div className="p-4 bg-[#090A0F] rounded-2xl border border-white/[0.06] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Mapped OneFolk Service:</span>
                    <span className="text-blue-400 font-semibold">{opp.onefolk_service}</span>
                  </div>
                  {opp.estimated_revenue_potential && (
                    <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                      <span className="text-slate-400 font-medium">Estimated Retainer Value:</span>
                      <span className="text-emerald-400 font-bold font-mono">
                        {opp.estimated_revenue_potential}
                      </span>
                    </div>
                  )}
                </div>

                {opp.evidence && opp.evidence.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {opp.evidence.map((ev, idx) => {
                      const isDetected =
                        ev.toLowerCase().includes('detected') &&
                        !ev.toLowerCase().includes('not_detected') &&
                        !ev.toLowerCase().includes('not detected');
                      const isNotDetected =
                        ev.toLowerCase().includes('not_detected') || ev.toLowerCase().includes('not detected');

                      return (
                        <span
                          key={idx}
                          className={`text-[10px] px-2.5 py-1 rounded-lg font-mono font-medium border ${
                            isDetected
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : isNotDetected
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-white/[0.04] text-slate-400 border-white/[0.06]'
                          }`}
                        >
                          {ev}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-mono">
                  Confidence: <strong className="text-slate-300">{(opp.confidence * 100).toFixed(0)}%</strong>
                </span>
                <Link
                  href={`/businesses/${opp.business_id}`}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 group/btn"
                >
                  View Client Profile
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
