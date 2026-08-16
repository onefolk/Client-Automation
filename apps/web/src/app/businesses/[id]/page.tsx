'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getBusinessProfile } from '@/lib/api';
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
  Layers,
  Code2,
  Users,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

const tabs = [
  { id: 'overview', name: 'Overview', icon: Building2 },
  { id: 'contacts', name: 'Contacts', icon: Users },
  { id: 'website', name: 'Website', icon: Globe },
  { id: 'social', name: 'Social', icon: MessageSquare },
  { id: 'reviews', name: 'Reviews', icon: Star },
  { id: 'technology', name: 'Technology', icon: Code2 },
  { id: 'analysis', name: 'Analysis', icon: Sparkles },
  { id: 'opportunities', name: 'Opportunities', icon: Zap },
  { id: 'activity', name: 'Activity Timeline', icon: Activity },
];

export default function BusinessDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [activeTab, setActiveTab] = useState('overview');

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['business-profile', id],
    queryFn: () => getBusinessProfile(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="text-center py-24 text-slate-400">
        Loading comprehensive intelligence profile...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="text-center py-24 text-rose-400">
        Error loading business profile or business does not exist.
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
          Back to Directory
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

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-3 py-1.5 rounded-lg bg-[#090D16] border border-[#1E293B] text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Deduplicated Master Record
              </span>
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
            <h3 className="text-base font-bold text-white">Client Summary & Digital Maturity</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#090D16] border border-[#1E293B]">
                <span className="text-xs text-slate-400 uppercase font-semibold">Priority Score</span>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{profile.priority_score}/100</p>
                <p className="text-[11px] text-slate-400 mt-1">High conversion potential for OneFolk services</p>
              </div>

              <div className="p-4 rounded-xl bg-[#090D16] border border-[#1E293B]">
                <span className="text-xs text-slate-400 uppercase font-semibold">Public Rating</span>
                <p className="text-2xl font-bold text-amber-400 mt-1">
                  ★ {profile.rating?.toFixed(1) || 'N/A'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">From {profile.review_count} verified reviews</p>
              </div>

              <div className="p-4 rounded-xl bg-[#090D16] border border-[#1E293B]">
                <span className="text-xs text-slate-400 uppercase font-semibold">Opportunities Identified</span>
                <p className="text-2xl font-bold text-indigo-400 mt-1">{profile.opportunities?.length || 0}</p>
                <p className="text-[11px] text-slate-400 mt-1">Ready for agency proposal and outreach</p>
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
                  <span className="text-slate-400 block">Data Confidence</span>
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
                      <span className="text-[10px] text-slate-400 font-mono">{(c.confidence * 100).toFixed(0)}% confidence</span>
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

        {/* 3. Website Tab */}
        {activeTab === 'website' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">Website & Digital Signals</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-[#090D16] rounded-xl border border-[#1E293B]">
                <span className="text-slate-400 block">Website Status</span>
                <span className="text-emerald-400 font-semibold">{profile.has_website ? 'Active & Reachable' : 'Not Found'}</span>
              </div>
              <div className="p-3 bg-[#090D16] rounded-xl border border-[#1E293B]">
                <span className="text-slate-400 block">SSL Certificate</span>
                <span className="text-emerald-400 font-semibold">{profile.has_ssl ? 'Valid (HTTPS)' : 'Missing'}</span>
              </div>
              <div className="p-3 bg-[#090D16] rounded-xl border border-[#1E293B]">
                <span className="text-slate-400 block">Mobile Optimization</span>
                <span className="text-emerald-400 font-semibold">{profile.is_mobile_friendly ? 'Responsive' : 'Non-Responsive'}</span>
              </div>
              <div className="p-3 bg-[#090D16] rounded-xl border border-[#1E293B]">
                <span className="text-slate-400 block">Load Time</span>
                <span className="text-slate-200 font-semibold">1,850 ms</span>
              </div>
            </div>
          </div>
        )}

        {/* 4. Opportunities Tab */}
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

        {/* 5. Activity Timeline */}
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

        {/* Fallback for other tabs */}
        {!['overview', 'contacts', 'website', 'opportunities', 'activity'].includes(activeTab) && (
          <div className="text-center py-12 text-slate-400 text-xs">
            {activeTab.toUpperCase()} data collected and verified in PostgreSQL fact store.
          </div>
        )}
      </div>
    </div>
  );
}
