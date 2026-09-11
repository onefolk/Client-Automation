'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { listOpportunities } from '@/lib/api';
import { Zap, ArrowRight, RefreshCw } from 'lucide-react';

export default function OpportunitiesPage() {
  const { data: opportunities = [], isLoading } = useQuery({
    queryKey: ['opportunities'],
    queryFn: listOpportunities,
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Opportunity Matrix
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/[0.08]">
              {opportunities.length} Active
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Automated value creation opportunities mapped to OneFolk services.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <RefreshCw className="w-5 h-5 text-zinc-400 animate-spin mb-3" />
          <p className="text-xs text-zinc-400">Loading opportunities...</p>
        </div>
      ) : opportunities.length === 0 ? (
        <div className="rounded-lg border border-white/[0.08] bg-[#111113] p-10 text-center space-y-2">
          <Zap className="w-5 h-5 text-zinc-500 mx-auto" />
          <h3 className="text-xs font-semibold text-white">No Opportunities Generated</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Launch a discovery run to evaluate conversion gaps across target accounts.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {opportunities.map((opp) => (
            <div
              key={opp.id}
              className="rounded-lg border border-white/[0.08] hover:border-white/[0.18] bg-[#111113] p-4 transition-colors flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white leading-snug">{opp.title}</h3>
                  <span className="text-[9px] font-mono font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                    {opp.impact} Impact
                  </span>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">{opp.description}</p>

                <div className="p-3 bg-zinc-900/60 rounded border border-white/[0.04] space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Mapped Service:</span>
                    <span className="text-zinc-200 font-medium">{opp.onefolk_service}</span>
                  </div>
                  {opp.estimated_revenue_potential && (
                    <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                      <span className="text-zinc-400">Estimated Value:</span>
                      <span className="text-emerald-400 font-mono font-medium">
                        {opp.estimated_revenue_potential}
                      </span>
                    </div>
                  )}
                </div>

                {opp.evidence && opp.evidence.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {opp.evidence.map((ev, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-white/[0.04] font-mono"
                      >
                        {ev}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500">
                  Confidence: {Math.round((opp.confidence || 0.95) * 100)}%
                </span>
                <Link
                  href={`/businesses/${opp.business_id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-white hover:text-zinc-300 transition-colors"
                >
                  View Client Profile <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
