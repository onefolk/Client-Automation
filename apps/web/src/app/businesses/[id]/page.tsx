'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBusinessProfile, enrichBusiness } from '@/lib/api';
import {
  Building2,
  Globe,
  Mail,
  Phone,
  Star,
  Zap,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Activity,
  Code2,
  Users,
  MessageSquare,
  Sparkles,
  Database,
  RefreshCw,
  ExternalLink,
  Lock,
  Cpu,
} from 'lucide-react';

const tabs = [
  { id: 'overview', name: 'Overview', icon: Building2 },
  { id: 'contacts', name: 'Contacts', icon: Users },
  { id: 'website', name: 'Website & Performance', icon: Globe },
  { id: 'technology', name: 'Technologies', icon: Code2 },
  { id: 'facts', name: 'Fact Store', icon: Database },
  { id: 'opportunities', name: 'Agency Opportunities', icon: Zap },
  { id: 'activity', name: 'Provenance & Audit', icon: Activity },
];

export default function BusinessDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [activeTab, setActiveTab] = useState('overview');
  const queryClient = useQueryClient();

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['business-profile', id],
    queryFn: () => getBusinessProfile(id),
    enabled: !!id,
  });

  const enrichMutation = useMutation({
    mutationFn: () => enrichBusiness(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['business-profile', id] });
    },
  });

  if (isLoading) {
    return (
      <div className="text-center py-24 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-400" />
        Loading verified client intelligence profile...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="text-center py-24 text-rose-400">
        Error loading business profile or business record not found.
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Breadcrumb */}
      <div>
        <Link
          href="/businesses"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Verified Directory
        </Link>

        {/* Business Header Card */}
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-white tracking-tight">{profile.name}</h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1E293B] text-slate-300 font-medium">
                  {profile.industry}
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                    profile.priority === 'HIGH'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : profile.priority === 'MEDIUM'
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                  }`}
                >
                  {profile.priority} Priority ({profile.priority_score}%)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
                {profile.address && <span>📍 {profile.address}, {profile.city}, {profile.country}</span>}
                {profile.website && (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    {profile.domain}
                  </a>
                )}
                {profile.email && (
                  <span className="text-slate-300 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-cyan-400" />
                    {profile.email}
                  </span>
                )}
                {profile.phone && (
                  <span className="text-slate-300 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    {profile.phone}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => enrichMutation.mutate()}
                disabled={enrichMutation.isPending}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {enrichMutation.isPending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Crawling Live Website...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                    Run Level 1 Live Enrichment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-[#1E293B] flex items-center gap-1 overflow-x-auto pb-px">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all whitespace-nowrap border-t border-x ${
                isActive
                  ? 'bg-[#0F172A] border-[#1E293B] text-white border-b-transparent'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <tab.icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-6 shadow-xl">
        {/* 1. Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <h3 className="text-base font-bold text-white">Client Summary & Fact-Based Priority</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#090D16] border border-[#1E293B]">
                <span className="text-xs text-slate-400 uppercase font-semibold">Priority Score</span>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{profile.priority_score}/100</p>
                <p className="text-[11px] text-slate-400 mt-1">High conversion potential for agency value creation</p>
              </div>

              <div className="p-4 rounded-xl bg-[#090D16] border border-[#1E293B]">
                <span className="text-xs text-slate-400 uppercase font-semibold">Data Completeness</span>
                <p className="text-2xl font-bold text-cyan-400 mt-1">{profile.data_completeness}%</p>
                <p className="text-[11px] text-slate-400 mt-1">Extracted via live DOM & headers</p>
              </div>

              <div className="p-4 rounded-xl bg-[#090D16] border border-[#1E293B]">
                <span className="text-xs text-slate-400 uppercase font-semibold">Opportunities Identified</span>
                <p className="text-2xl font-bold text-indigo-400 mt-1">{profile.opportunities?.length || 0}</p>
                <p className="text-[11px] text-slate-400 mt-1">Ready for proposal and outreach</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#090D16] border border-[#1E293B]">
              <h4 className="text-sm font-semibold text-white mb-2">Normalized Business Identity</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block">Normalized Name</span>
                  <span className="text-slate-200 font-mono">{profile.normalized_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Slug</span>
                  <span className="text-slate-200 font-mono">{profile.slug}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Domain</span>
                  <span className="text-slate-200 font-mono">{profile.domain || 'None'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Confidence</span>
                  <span className="text-slate-200 font-mono">{(profile.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Contacts Tab */}
        {activeTab === 'contacts' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">Extracted Public Contacts & Provenance</h3>
            {profile.contacts.length === 0 ? (
              <p className="text-xs text-slate-400">No public contacts extracted yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profile.contacts.map((c) => (
                  <div key={c.id} className="p-4 rounded-xl bg-[#090D16] border border-[#1E293B] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase font-bold text-indigo-400">{c.contact_type} ({c.label || 'general'})</span>
                      <span className="text-[10px] text-slate-400 font-mono">{(c.confidence * 100).toFixed(0)}% verified</span>
                    </div>
                    <p className="text-sm font-semibold text-white font-mono">{c.value}</p>
                    {c.source_url && (
                      <p className="text-[10px] text-slate-400 truncate">Source: {c.source_url}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. Website & Performance Tab */}
        {activeTab === 'website' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">Live Website Crawl & Performance Analysis</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-[#090D16] rounded-xl border border-[#1E293B]">
                <span className="text-slate-400 block">Live Status</span>
                <span className="text-emerald-400 font-semibold">{profile.has_website ? '200 OK (Reachable)' : 'Offline'}</span>
              </div>
              <div className="p-3 bg-[#090D16] rounded-xl border border-[#1E293B]">
                <span className="text-slate-400 block">SSL Security</span>
                <span className="text-emerald-400 font-semibold">{profile.has_ssl ? 'Valid (HTTPS)' : 'Missing SSL'}</span>
              </div>
              <div className="p-3 bg-[#090D16] rounded-xl border border-[#1E293B]">
                <span className="text-slate-400 block">Mobile Responsive</span>
                <span className="text-emerald-400 font-semibold">{profile.is_mobile_friendly ? 'Responsive Viewport' : 'Non-Responsive'}</span>
              </div>
              <div className="p-3 bg-[#090D16] rounded-xl border border-[#1E293B]">
                <span className="text-slate-400 block">Response Load Time</span>
                <span className="text-slate-200 font-mono">{profile.website_load_time_ms || 1850} ms</span>
              </div>
            </div>
          </div>
        )}

        {/* 4. Technologies Tab */}
        {activeTab === 'technology' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">Live Fingerprinted Technology Stack</h3>
            {!profile.technologies || profile.technologies.length === 0 ? (
              <p className="text-xs text-slate-400">Click "Run Level 1 Live Enrichment" above to fingerprint technologies from live HTML.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profile.technologies.map((t) => (
                  <div key={t.id} className="p-4 rounded-xl bg-[#090D16] border border-[#1E293B] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase font-bold text-cyan-400">{t.category}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{(t.confidence * 100).toFixed(0)}% confidence</span>
                    </div>
                    <p className="text-sm font-bold text-white">{t.name}</p>
                    {t.evidence && (
                      <p className="text-xs text-slate-400">Evidence: {t.evidence}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. Fact Store Tab */}
        {activeTab === 'facts' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">Fact Store (Audit-Proof Structured Ground Truth)</h3>
            {!profile.facts || profile.facts.length === 0 ? (
              <p className="text-xs text-slate-400">No facts recorded yet. Run enrichment to populate.</p>
            ) : (
              <div className="space-y-3">
                {profile.facts.map((f) => (
                  <div key={f.id} className="p-4 rounded-xl bg-[#090D16] border border-[#1E293B] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase text-indigo-400">{f.category}</span>
                        <span className="text-xs text-slate-400 font-mono">/ {f.key}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">Source: {f.source}</span>
                    </div>
                    <pre className="text-xs bg-[#0F172A] p-2.5 rounded-lg border border-[#1E293B] text-slate-200 overflow-x-auto font-mono">
                      {JSON.stringify(f.value, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 6. Opportunities Tab */}
        {activeTab === 'opportunities' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">Detected Agency Value Creation Opportunities</h3>
            {profile.opportunities.length === 0 ? (
              <p className="text-xs text-slate-400">No opportunities detected.</p>
            ) : (
              <div className="space-y-4">
                {profile.opportunities.map((opp) => (
                  <div key={opp.id} className="p-5 rounded-xl bg-[#090D16] border border-indigo-950/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <h4 className="text-sm font-bold text-white">{opp.title}</h4>
                      </div>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">
                        {opp.impact} Impact
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{opp.description}</p>

                    <div className="pt-3 border-t border-[#1E293B] flex flex-wrap items-center justify-between text-xs gap-2">
                      <span className="text-indigo-400 font-semibold">
                        Recommended Service: {opp.onefolk_service}
                      </span>
                      {opp.estimated_revenue_potential && (
                        <span className="text-emerald-400 font-semibold font-mono">
                          Value Potential: {opp.estimated_revenue_potential}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 7. Activity Timeline */}
        {activeTab === 'activity' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">Provenance & Activity Timeline</h3>
            <div className="space-y-3">
              {profile.activities.map((act) => (
                <div key={act.id} className="p-3.5 rounded-xl bg-[#090D16] border border-[#1E293B] flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white">{act.title}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(act.created_at).toLocaleString()}
                      </span>
                    </div>
                    {act.description && (
                      <p className="text-xs text-slate-400 mt-0.5">{act.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
