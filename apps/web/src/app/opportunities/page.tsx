'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { listOpportunities } from '@/lib/api';
import { Sparkles, Zap, ArrowRight, DollarSign, CheckCircle2 } from 'lucide-react';

export default function OpportunitiesPage() {
  const { data: opportunities = [], isLoading } = useQuery({
    queryKey: ['opportunities'],
    queryFn: listOpportunities,
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <Sparkles className="w-7 h-7 text-amber-400" />
          Agency Opportunity Matrix
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          High-probability agency value creation opportunities automatically detected and mapped to OneFolk services.
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-slate-400">Loading opportunities matrix...</div>
      ) : opportunities.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[#1E293B] rounded-2xl bg-[#0F172A]/40 text-slate-400">
          No opportunities generated yet. Launch a search from the Discover page to evaluate target clients.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {opportunities.map((opp) => (
            <div
              key={opp.id}
              className="bg-[#0F172A] border border-[#1E293B] hover:border-indigo-500/50 rounded-2xl p-6 flex flex-col justify-between transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                    <h3 className="text-base font-bold text-white">{opp.title}</h3>
                  </div>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                    {opp.impact} Impact
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{opp.description}</p>

                <div className="p-3 bg-[#090D16] rounded-xl border border-[#1E293B] space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Mapped Agency Service:</span>
                    <span className="text-indigo-400 font-semibold">{opp.onefolk_service}</span>
                  </div>
                  {opp.estimated_revenue_potential && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Estimated Value:</span>
                      <span className="text-emerald-400 font-semibold font-mono">
                        {opp.estimated_revenue_potential}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-[#1E293B] flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-mono">
                  Confidence: {(opp.confidence * 100).toFixed(0)}%
                </span>
                <Link
                  href={`/businesses/${opp.business_id}`}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  View Client Profile
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
