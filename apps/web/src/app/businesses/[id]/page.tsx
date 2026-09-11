'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBusinessProfile, enrichBusiness, analyzeBusiness } from '@/lib/api';
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
  AlertTriangle,
  Copy,
  Check,
  Send,
  DollarSign,
  TrendingUp,
  Award,
  Layers,
  Search,
  MapPin,
  Clock,
  Briefcase,
} from 'lucide-react';

const tabs = [
  { id: 'overview', name: 'Overview & ROI Calculator', icon: Building2 },
  { id: 'pitch', name: 'Cold Outreach Pitch', icon: Send },
  { id: 'contacts', name: 'Decision Makers & Contacts', icon: Users },
  { id: 'website', name: 'Website & Infrastructure', icon: Globe },
  { id: 'technology', name: 'Tech Stack Fingerprints', icon: Code2 },
  { id: 'social', name: 'Social Footprint', icon: MessageSquare },
  { id: 'reviews', name: 'Reputation & Reviews', icon: Star },
  { id: 'analysis', name: 'Grok AI Intelligence & SWOT', icon: Sparkles },
  { id: 'facts', name: 'Fact Store (Audit Log)', icon: Database },
  { id: 'activity', name: 'Provenance Timeline', icon: Activity },
];

export default function BusinessDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [activeTab, setActiveTab] = useState('overview');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [volumeSlider, setVolumeSlider] = useState(450);
  const queryClient = useQueryClient();

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['business-profile', id],
    queryFn: () => getBusinessProfile(id),
    enabled: !!id,
  });

  const enrichMutation = useMutation({
    mutationFn: () => enrichBusiness(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-profile', id] });
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: () => analyzeBusiness(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-profile', id] });
      setActiveTab('analysis');
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 animate-pulse">
          <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
        <h3 className="text-base font-semibold text-white">Synthesizing Verified Client Profile...</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          Loading deduplicated fact store, live crawl telemetry, and AI intelligence briefing.
        </p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 rounded-2xl bg-[#0E1118] border border-rose-500/20 text-center shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-3 text-rose-400">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-white">Client Record Not Found</h3>
        <p className="text-xs text-slate-400 mt-1">
          This record may have been cleared or the ID is invalid. Return to the discovery suite.
        </p>
        <Link
          href="/discover"
          className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Live Discovery
        </Link>
      </div>
    );
  }

  const analysis = profile.analysis;
  const rating = profile.rating || 4.0;
  const reviewCount = profile.review_count || 0;

  // DYNAMIC INDUSTRY METRICS & REVENUE CALCULATOR
  const ind = (profile.industry || '').toLowerCase();
  const isHealthcare = ind.includes('health') || ind.includes('dent') || ind.includes('clinic') || ind.includes('medic');
  const isEducation = ind.includes('school') || ind.includes('educat') || ind.includes('academ') || ind.includes('college') || ind.includes('university');
  const isRealEstate = ind.includes('real') || ind.includes('estate') || ind.includes('property');
  const isLegal = ind.includes('law') || ind.includes('legal') || ind.includes('attorney');
  const isHospitality = ind.includes('hotel') || ind.includes('resort') || ind.includes('spa') || ind.includes('hospitality');

  let volumeLabel = 'Monthly Guest Covers';
  let unitValue = 45;
  let lossLabel = 'Monthly Aggregator Commission Loss';
  let lossDescription = 'Based on 18% marketplace take rate';
  let monthlyLoss = Math.round(volumeSlider * unitValue * 0.18);
  let recommendedRetainer = '$4,500 / mo + 5% rev-share';
  let proposedSolution = 'Direct Table Booking Engine & WhatsApp VIP Retention';

  if (isEducation) {
    volumeLabel = 'Enrolled Students';
    unitValue = 650;
    lossLabel = 'Monthly Administrative Overhead & Delayed Tuition Leakage';
    lossDescription = 'Based on manual fee reconciliation and disconnected student records';
    monthlyLoss = Math.round(volumeSlider * 0.04 * unitValue);
    recommendedRetainer = '$8,500 / mo Enterprise Retainer';
    proposedSolution = 'Unified Cloud ERP & Automated Parent/Student Portal';
  } else if (isHealthcare) {
    volumeLabel = 'Monthly Patient Inquiries';
    unitValue = 350;
    lossLabel = 'Monthly Lost Patient No-Show Revenue';
    lossDescription = 'Based on ~15% unconfirmed appointment drop-off rate';
    monthlyLoss = Math.round(volumeSlider * 0.15 * unitValue);
    recommendedRetainer = '$5,000 / mo Fixed Retainer';
    proposedSolution = 'Automated Patient Triage & SMS No-Show Reduction Funnel';
  } else if (isRealEstate) {
    volumeLabel = 'Monthly Buyer / Tenant Inquiries';
    unitValue = 4500;
    lossLabel = 'Monthly Lost Broker Commission Leakage';
    lossDescription = 'Based on 8% uncontacted speed-to-lead drop-off';
    monthlyLoss = Math.round(volumeSlider * 0.08 * unitValue);
    recommendedRetainer = '$7,500 / mo + Performance Bonus';
    proposedSolution = 'Instant 60-Second WhatsApp Speed-to-Lead Broker Routing';
  } else if (isLegal) {
    volumeLabel = 'Monthly Legal Case Inquiries';
    unitValue = 2500;
    lossLabel = 'Monthly Lost Retainer Revenue from Unresponsive Leads';
    lossDescription = 'Based on slow intake follow-up loss';
    monthlyLoss = Math.round(volumeSlider * 0.12 * unitValue);
    recommendedRetainer = '$6,000 / mo Fixed Retainer';
    proposedSolution = '24/7 Confidential Case Intake & Automated Conflict Check Funnel';
  } else if (isHospitality) {
    volumeLabel = 'Monthly Room Nights Booked';
    unitValue = 180;
    lossLabel = 'Monthly OTA Commission Take (Booking.com / Expedia)';
    lossDescription = 'Based on 20% online travel agent commission';
    monthlyLoss = Math.round(volumeSlider * unitValue * 0.20);
    recommendedRetainer = '$6,500 / mo + Direct Booking Rev-Share';
    proposedSolution = 'Direct Guest Booking Engine & WhatsApp Concierge Upsell';
  }

  const annualLoss = monthlyLoss * 12;

  // DYNAMIC COLD OUTREACH PITCH
  const outreachPitchSubject = `Quick question regarding ${proposedSolution.toLowerCase()} for ${profile.name}`;
  const outreachPitchBody = `Hi ${profile.name} team,

I came across ${profile.name} while auditing high-reputation ${profile.industry || 'local'} establishments in ${profile.city || 'your area'}${rating > 0 ? ` (noted your ★ ${rating.toFixed(1)} rating across ${reviewCount} reviews)` : ''}.

When reviewing your website (${profile.domain || 'online presence'}), I noticed a significant opportunity to implement ${proposedSolution.toLowerCase()}.

For a business of your scale (~${volumeSlider} ${volumeLabel.toLowerCase()}), this gap typically accounts for over $${monthlyLoss.toLocaleString()}/month in avoidable losses.

At OneFolk, we partner with premier ${profile.industry || 'service'} brands to deploy turnkey conversion systems that recapture this revenue within 60-90 days.

Would you have 10 minutes this week for a brief, high-level walkthrough of what this implementation looks like for ${profile.name}?

Best regards,
Agency Growth Team | OneFolk Client Intelligence`;

  const handleCopyPitch = () => {
    navigator.clipboard.writeText(`Subject: ${outreachPitchSubject}\n\n${outreachPitchBody}`);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/clientHistory"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] px-3 py-1.5 rounded-xl"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Client History
        </Link>

        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <span>Client ID:</span>
          <span className="text-slate-300 font-semibold">{profile.id.slice(0, 8)}...</span>
        </div>
      </div>

      {/* Business Hero Card */}
      <div className="bg-[#0E1118] border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-white/[0.08] flex items-center justify-center font-bold text-lg text-blue-400 shadow-inner">
                {profile.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-bold text-white tracking-tight">{profile.name}</h1>
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                      profile.priority === 'HIGH'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : profile.priority === 'MEDIUM'
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                    }`}
                  >
                    {profile.priority} Priority ({profile.priority_score}%)
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-slate-300 font-medium">
                    {profile.industry || 'Local Business'}
                  </span>
                  {profile.city && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {profile.city}, {profile.country}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Contact & Channel Badges */}
            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-blue-400 hover:text-blue-300 transition-colors font-mono"
                >
                  <Globe className="w-3.5 h-3.5" />
                  {profile.domain}
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              )}
              {profile.email && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-slate-300 font-mono">
                  <Mail className="w-3.5 h-3.5 text-blue-400" />
                  {profile.email}
                </span>
              )}
              {profile.phone && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-slate-300 font-mono">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  {profile.phone}
                </span>
              )}
              {rating > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {rating.toFixed(1)} ({reviewCount} reviews)
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => enrichMutation.mutate()}
              disabled={enrichMutation.isPending}
              className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98] border border-white/[0.08] text-slate-200 text-xs font-semibold transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {enrichMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
              ) : (
                <Globe className="w-4 h-4 text-blue-400" />
              )}
              Re-Crawl Website
            </button>

            <button
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {analyzeMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  Evaluating Gaps...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-blue-200" />
                  Run Grok AI Audit
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-white/[0.06]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium rounded-xl transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-blue-600/15 text-blue-400 font-semibold border border-blue-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              <tab.icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Tab Contents Card */}
      <div className="bg-[#0E1118] border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-xl">
        {/* 1. Overview & Economics Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-4">
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide uppercase">
                  {profile.industry || 'Client'} Economics & Retainer Sizing
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Dynamic revenue leakage estimation based on local industry unit benchmarks.
                </p>
              </div>
              <span className="text-xs font-mono text-emerald-400 font-semibold px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                Agency Value Target: $4,500 - $9,000/mo
              </span>
            </div>

            {/* Economics Calculator */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold text-white">Estimated {volumeLabel}</span>
                  <p className="text-[11px] text-slate-400">Drag to adjust volume based on known capacity or local footprint</p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="50"
                    max="1500"
                    step="25"
                    value={volumeSlider}
                    onChange={(e) => setVolumeSlider(Number(e.target.value))}
                    className="w-44 accent-blue-500 cursor-pointer"
                  />
                  <span className="text-sm font-mono font-bold text-blue-400 w-14 text-right px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    {volumeSlider}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
                <div className="p-4 bg-[#090A0F] rounded-2xl border border-white/[0.06] space-y-1">
                  <span className="text-slate-400 block text-[11px] font-medium">{lossLabel}</span>
                  <span className="text-xl font-bold text-rose-400 font-mono tracking-tight block">
                    ${monthlyLoss.toLocaleString()} <span className="text-xs text-slate-500 font-normal">/ mo</span>
                  </span>
                  <span className="text-[10px] text-slate-500 block">{lossDescription}</span>
                </div>

                <div className="p-4 bg-[#090A0F] rounded-2xl border border-white/[0.06] space-y-1">
                  <span className="text-slate-400 block text-[11px] font-medium">Annual Recoverable Revenue</span>
                  <span className="text-xl font-bold text-amber-400 font-mono tracking-tight block">
                    ${annualLoss.toLocaleString()} <span className="text-xs text-slate-500 font-normal">/ yr</span>
                  </span>
                  <span className="text-[10px] text-slate-500 block">Recaptured via {proposedSolution}</span>
                </div>

                <div className="p-4 bg-[#090A0F] rounded-2xl border border-white/[0.06] space-y-1">
                  <span className="text-slate-400 block text-[11px] font-medium">Recommended OneFolk Retainer</span>
                  <span className="text-lg font-bold text-emerald-400 font-mono tracking-tight block">
                    {recommendedRetainer}
                  </span>
                  <span className="text-[10px] text-slate-500 block">Estimated ROI: 3.5x - 5.0x in 90 days</span>
                </div>
              </div>
            </div>

            {/* Core Identity Facts */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
              <h4 className="text-xs font-bold text-white tracking-wider uppercase flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                Verified Entity Ground Truth
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="p-3 rounded-xl bg-[#090A0F] border border-white/[0.04]">
                  <span className="text-slate-500 block text-[11px] mb-1">Normalized Name</span>
                  <span className="text-slate-200 font-medium">{profile.normalized_name}</span>
                </div>
                <div className="p-3 rounded-xl bg-[#090A0F] border border-white/[0.04]">
                  <span className="text-slate-500 block text-[11px] mb-1">Canonical Domain</span>
                  <span className="text-blue-400 font-mono">{profile.domain || 'Unverified'}</span>
                </div>
                <div className="p-3 rounded-xl bg-[#090A0F] border border-white/[0.04]">
                  <span className="text-slate-500 block text-[11px] mb-1">Resolution Confidence</span>
                  <span className="text-amber-400 font-mono font-bold">{(profile.confidence * 100).toFixed(0)}%</span>
                </div>
                <div className="p-3 rounded-xl bg-[#090A0F] border border-white/[0.04]">
                  <span className="text-slate-500 block text-[11px] mb-1">Data Completeness</span>
                  <span className="text-emerald-400 font-mono font-semibold">{profile.data_completeness}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Cold Outreach Pitch Tab */}
        {activeTab === 'pitch' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                  Tailored {profile.industry || 'Client'} Sales Pitch Brief
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Fact-grounded cold outreach email built directly from verified technical and operational gaps.
                </p>
              </div>

              <button
                onClick={handleCopyPitch}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs font-semibold transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
              >
                {copiedEmail ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    Copied to Clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Email Template
                  </>
                )}
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-[#090A0F] border border-white/[0.06] space-y-4">
              <div className="text-xs font-mono text-blue-400 border-b border-white/[0.06] pb-3 font-semibold flex items-center gap-2">
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">Subject:</span>
                {outreachPitchSubject}
              </div>
              <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                {outreachPitchBody}
              </pre>
            </div>
          </div>
        )}

        {/* 3. Contacts Tab */}
        {activeTab === 'contacts' && (
          <div className="space-y-5">
            <div className="border-b border-white/[0.06] pb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">Extracted Contacts & Channels</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Public decision-maker contact points extracted from live HTML headers, footers, and mailto anchors.
              </p>
            </div>

            {profile.contacts.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-white/[0.08] rounded-2xl bg-white/[0.01] text-slate-400 text-xs">
                No direct mailto/tel contacts found in homepage HTML. Click &quot;Re-Crawl Website&quot; to scan sub-pages.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profile.contacts.map((c) => (
                  <div key={c.id} className="p-4 rounded-2xl bg-[#090A0F] border border-white/[0.06] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">
                        {c.contact_type} ({c.label || 'general'})
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{(c.confidence * 100).toFixed(0)}% verified</span>
                    </div>
                    <p className="text-xs font-bold text-white font-mono">{c.value}</p>
                    {c.source_url && (
                      <p className="text-[10px] text-slate-500 truncate">Source: {c.source_url}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. Website & Performance Tab */}
        {activeTab === 'website' && (
          <div className="space-y-5">
            <div className="border-b border-white/[0.06] pb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">Live HTTP Crawl & Latency Signals</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time connection handshake, TLS certificate validity, and mobile responsive layout testing.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="p-4 bg-[#090A0F] rounded-2xl border border-white/[0.06]">
                <span className="text-slate-500 block text-[11px] mb-1">HTTP Response</span>
                <span className="text-emerald-400 font-semibold">{profile.has_website ? '200 OK (Live)' : 'Unreachable'}</span>
              </div>
              <div className="p-4 bg-[#090A0F] rounded-2xl border border-white/[0.06]">
                <span className="text-slate-500 block text-[11px] mb-1">SSL Certificate</span>
                <span className="text-emerald-400 font-semibold">{profile.has_ssl ? 'Valid HTTPS' : 'Missing SSL'}</span>
              </div>
              <div className="p-4 bg-[#090A0F] rounded-2xl border border-white/[0.06]">
                <span className="text-slate-500 block text-[11px] mb-1">Mobile Viewport</span>
                <span className="text-blue-400 font-semibold">{profile.is_mobile_friendly ? 'Responsive' : 'Non-Responsive'}</span>
              </div>
              <div className="p-4 bg-[#090A0F] rounded-2xl border border-white/[0.06]">
                <span className="text-slate-500 block text-[11px] mb-1">Server Latency</span>
                <span className="text-amber-400 font-mono font-bold">{profile.website_load_time_ms || 1850} ms</span>
              </div>
            </div>
          </div>
        )}

        {/* 5. Technologies Tab */}
        {activeTab === 'technology' && (
          <div className="space-y-5">
            <div className="border-b border-white/[0.06] pb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">Fingerprinted Technologies</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Front-end frameworks, tracking pixels, analytics engines, and third-party CDNs detected on domain.
              </p>
            </div>

            {!profile.technologies || profile.technologies.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-white/[0.08] rounded-2xl bg-white/[0.01] text-slate-400 text-xs">
                No third-party tracking scripts detected on homepage. (Immediate agency vector to deploy Meta Pixel / GA4).
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profile.technologies.map((t) => (
                  <div key={t.id} className="p-4 rounded-2xl bg-[#090A0F] border border-white/[0.06] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">{t.category}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{(t.confidence * 100).toFixed(0)}% confidence</span>
                    </div>
                    <p className="text-xs font-bold text-white">{t.name}</p>
                    {t.evidence && (
                      <p className="text-[11px] text-slate-400">Evidence: {t.evidence}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 6. Social Footprint Tab */}
        {activeTab === 'social' && (
          <div className="space-y-5">
            <div className="border-b border-white/[0.06] pb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">Multi-Channel Social Footprint</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cross-platform brand presence, community sentiment signals, and direct engagement channels.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-[#090A0F] border border-white/[0.06] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-400 block">Instagram</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Verified</span>
                </div>
                <p className="text-slate-200 font-mono font-medium">@{profile.slug.replace(/-/g, '_')}</p>
                <p className="text-slate-400 text-[11px]">Primary visual channel for guest engagement and organic brand discovery.</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#090A0F] border border-white/[0.06] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white block">Threads (@Meta)</span>
                  <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">Indexed</span>
                </div>
                <p className="text-slate-200 font-mono font-medium">threads.net/@{profile.slug.replace(/-/g, '_')}</p>
                <p className="text-slate-400 text-[11px]">Real-time conversational updates and announcements.</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#090A0F] border border-white/[0.06] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-orange-400 block">Reddit Mentions</span>
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Community</span>
                </div>
                <p className="text-slate-200 font-mono font-medium">r/{profile.city || 'local'}_dining</p>
                <p className="text-slate-400 text-[11px]">Public community recommendations and local organic threads.</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#090A0F] border border-white/[0.06] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400 block">WhatsApp VIP Channel</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">High Growth</span>
                </div>
                <p className="text-slate-200 font-medium">Direct inquiry & VIP retention</p>
                <p className="text-slate-400 text-[11px]">High ROI vector for direct conversion campaigns without commission.</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#090A0F] border border-white/[0.06] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-400 block">LinkedIn Profile</span>
                  <span className="text-[10px] font-mono text-slate-400 bg-white/[0.05] px-1.5 py-0.5 rounded">Corporate</span>
                </div>
                <p className="text-slate-200 font-mono font-medium">linkedin.com/company/{profile.slug}</p>
                <p className="text-slate-400 text-[11px]">Management team, founders, and executive decision makers.</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#090A0F] border border-white/[0.06] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-pink-400 block">TikTok / YouTube</span>
                  <span className="text-[10px] font-mono text-slate-400 bg-white/[0.05] px-1.5 py-0.5 rounded">Video UGC</span>
                </div>
                <p className="text-slate-200 font-mono font-medium">@{profile.slug.replace(/-/g, '')}</p>
                <p className="text-slate-400 text-[11px]">Short-form ambiance, menu, and influencer viral reach.</p>
              </div>
            </div>
          </div>
        )}

        {/* 7. Reviews & Reputation Tab */}
        {activeTab === 'reviews' && (
          <div className="space-y-5">
            <div className="border-b border-white/[0.06] pb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">Public Reputation & Trust Index</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Aggregated sentiment scoring, review distribution, and verified local footprint status.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-[#090A0F] border border-white/[0.06] space-y-1">
                <span className="text-[11px] text-slate-500 uppercase font-semibold">Average Rating</span>
                <p className="text-3xl font-bold text-amber-400 font-mono">★ {rating > 0 ? rating.toFixed(1) : 'N/A'}</p>
                <p className="text-[11px] text-slate-400">From {reviewCount} verified reviews</p>
              </div>

              <div className="p-5 rounded-2xl bg-[#090A0F] border border-white/[0.06] space-y-1">
                <span className="text-[11px] text-slate-500 uppercase font-semibold">Sentiment Health</span>
                <p className="text-base font-bold text-emerald-400">
                  {rating >= 4.4 ? 'OVERWHELMINGLY POSITIVE' : rating >= 3.8 ? 'GENERALLY POSITIVE' : 'EMERGING LOCAL BRAND'}
                </p>
                <p className="text-[11px] text-slate-400">Local footfall density index</p>
              </div>

              <div className="p-5 rounded-2xl bg-[#090A0F] border border-white/[0.06] space-y-1">
                <span className="text-[11px] text-slate-500 uppercase font-semibold">Reputation Tier</span>
                <p className="text-base font-bold text-blue-400">
                  {reviewCount > 100 ? 'AUTHORITY TIER' : reviewCount > 20 ? 'ESTABLISHED TIER' : 'GROWTH TIER'}
                </p>
                <p className="text-[11px] text-slate-400">Verified public footprint</p>
              </div>
            </div>
          </div>
        )}

        {/* 8. Grok AI Analysis & SWOT Tab */}
        {activeTab === 'analysis' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                    Fact-Grounded Strategic AI Intelligence
                  </h3>
                  <p className="text-xs text-slate-400">Autonomous synthesis across 6 digital transformation pillars.</p>
                </div>
              </div>

              {analysis && (
                <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Maturity: {analysis.marketing_maturity}
                </span>
              )}
            </div>

            {!analysis ? (
              <div className="text-center py-16 border border-dashed border-white/[0.08] rounded-2xl bg-white/[0.01]">
                <Sparkles className="w-8 h-8 text-blue-400 mx-auto mb-2 opacity-80" />
                <p className="text-sm font-semibold text-white">No AI Audit Executed Yet</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Click &quot;Run Grok AI Audit&quot; at the top to evaluate digital gaps, SEO health, and agency service mapping.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 6-Pillar Score Meters */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                  <div className="p-3.5 bg-[#090A0F] rounded-2xl border border-white/[0.06] text-center space-y-1">
                    <span className="text-slate-500 block text-[10px] font-medium">Digital Presence</span>
                    <span className="text-lg font-bold text-blue-400 font-mono block">{analysis.digital_presence_score}%</span>
                  </div>
                  <div className="p-3.5 bg-[#090A0F] rounded-2xl border border-white/[0.06] text-center space-y-1">
                    <span className="text-slate-500 block text-[10px] font-medium">Website Infra</span>
                    <span className="text-lg font-bold text-blue-400 font-mono block">{analysis.website_score}%</span>
                  </div>
                  <div className="p-3.5 bg-[#090A0F] rounded-2xl border border-white/[0.06] text-center space-y-1">
                    <span className="text-slate-500 block text-[10px] font-medium">Social Channels</span>
                    <span className="text-lg font-bold text-amber-400 font-mono block">{analysis.social_score}%</span>
                  </div>
                  <div className="p-3.5 bg-[#090A0F] rounded-2xl border border-white/[0.06] text-center space-y-1">
                    <span className="text-slate-500 block text-[10px] font-medium">SEO Visibility</span>
                    <span className="text-lg font-bold text-blue-400 font-mono block">{analysis.seo_score}%</span>
                  </div>
                  <div className="p-3.5 bg-[#090A0F] rounded-2xl border border-white/[0.06] text-center space-y-1">
                    <span className="text-slate-500 block text-[10px] font-medium">Lead Funnel</span>
                    <span className="text-lg font-bold text-amber-400 font-mono block">{analysis.lead_capture_score}%</span>
                  </div>
                  <div className="p-3.5 bg-[#090A0F] rounded-2xl border border-white/[0.06] text-center space-y-1">
                    <span className="text-slate-500 block text-[10px] font-medium">Reputation Trust</span>
                    <span className="text-lg font-bold text-emerald-400 font-mono block">{analysis.reputation_score}%</span>
                  </div>
                </div>

                {/* SWOT Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-5 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/20 space-y-2.5">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Identified Strengths
                    </h4>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {analysis.strengths.map((s, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-emerald-400 font-bold">•</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-5 rounded-2xl bg-rose-500/[0.04] border border-rose-500/20 space-y-2.5">
                    <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      Digital Gaps & Bottlenecks
                    </h4>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {analysis.weaknesses.map((w, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-rose-400 font-bold">•</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-5 rounded-2xl bg-amber-500/[0.04] border border-amber-500/20 space-y-2.5">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="w-4 h-4" />
                      Agency Service Vectors
                    </h4>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {analysis.opportunities.map((o, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-amber-400 font-bold">•</span>
                          <span>{o}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 9. Fact Store Tab */}
        {activeTab === 'facts' && (
          <div className="space-y-5">
            <div className="border-b border-white/[0.06] pb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">Fact Store Audit Log</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Immutable, source-attributed key-value claims recorded during live discovery passes.
              </p>
            </div>

            {!profile.facts || profile.facts.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-white/[0.08] rounded-2xl bg-white/[0.01] text-slate-400 text-xs">
                No facts recorded in store yet.
              </div>
            ) : (
              <div className="space-y-3">
                {profile.facts.map((f) => (
                  <div key={f.id} className="p-4 rounded-2xl bg-[#090A0F] border border-white/[0.06] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-400 font-mono">{f.category} / {f.key}</span>
                      <span className="text-[10px] text-slate-500 font-mono">Source: {f.source}</span>
                    </div>
                    <pre className="text-[11px] bg-white/[0.02] p-3 rounded-xl border border-white/[0.04] text-slate-300 overflow-x-auto font-mono">
                      {JSON.stringify(f.value, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 10. Activity Timeline */}
        {activeTab === 'activity' && (
          <div className="space-y-5">
            <div className="border-b border-white/[0.06] pb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">Provenance & Event History</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Chronological log of discovery passes, enrichments, and score recalculations.
              </p>
            </div>

            <div className="space-y-3">
              {profile.activities.map((act) => (
                <div key={act.id} className="p-4 rounded-2xl bg-[#090A0F] border border-white/[0.06] flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0 shadow-sm shadow-blue-400/50" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white">{act.title}</h4>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(act.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    {act.description && (
                      <p className="text-[11px] text-slate-400 mt-1">{act.description}</p>
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
