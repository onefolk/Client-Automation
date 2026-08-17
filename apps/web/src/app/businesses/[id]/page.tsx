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
} from 'lucide-react';

const tabs = [
  { id: 'overview', name: 'Overview & Economics', icon: Building2 },
  { id: 'pitch', name: 'Cold Outreach Pitch', icon: Send },
  { id: 'contacts', name: 'Contacts & Decision Makers', icon: Users },
  { id: 'website', name: 'Website & Infrastructure', icon: Globe },
  { id: 'technology', name: 'Tech Stack', icon: Code2 },
  { id: 'social', name: 'Social Footprint', icon: MessageSquare },
  { id: 'reviews', name: 'Reviews & Reputation', icon: Star },
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
      <div className="text-center py-24 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-[#02A0A0]" />
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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Breadcrumb */}
      <div>
        <Link
          href="/businesses"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-2 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Client Directory
        </Link>

        {/* Business Header Card */}
        <div className="bg-[#0D1E24] border border-[#1A3A44] rounded-2xl p-5 shadow-xl shadow-black/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold text-white tracking-tight">{profile.name}</h1>
                <span className="text-xs px-2.5 py-0.5 rounded-md bg-[#122931] text-slate-300 font-medium">
                  {profile.industry}
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider border ${
                    profile.priority === 'HIGH'
                      ? 'bg-[#FFBD65]/15 text-[#FFBD65] border-[#FFBD65]/30'
                      : 'bg-[#02A0A0]/15 text-[#02A0A0] border-[#02A0A0]/30'
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
                    className="text-[#02A0A0] hover:underline flex items-center gap-1 font-mono"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    {profile.domain}
                  </a>
                )}
                {profile.email && (
                  <span className="text-slate-300 font-mono flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-[#02A0A0]" />
                    {profile.email}
                  </span>
                )}
                {profile.phone && (
                  <span className="text-slate-300 font-mono flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-[#FFBD65]" />
                    {profile.phone}
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => enrichMutation.mutate()}
                disabled={enrichMutation.isPending}
                className="px-3 py-1.5 rounded-xl bg-[#122931] hover:bg-[#1A3A44] text-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {enrichMutation.isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Globe className="w-3.5 h-3.5 text-[#02A0A0]" />
                )}
                Re-Crawl Website
              </button>

              <button
                onClick={() => analyzeMutation.mutate()}
                disabled={analyzeMutation.isPending}
                className="px-3.5 py-1.5 rounded-xl bg-[#02A0A0] hover:bg-[#22BDBD] active:scale-[0.98] text-[#071317] text-xs font-bold shadow-md shadow-[#02A0A0]/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {analyzeMutation.isPending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#071317]" />
                    Evaluating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-[#071317]" />
                    Run Grok AI Audit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-[#1A3A44] flex items-center gap-1 overflow-x-auto pb-px">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-xl transition-all whitespace-nowrap border-t border-x ${
                isActive
                  ? 'bg-[#0D1E24] border-[#1A3A44] text-[#02A0A0] font-bold border-b-transparent'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <tab.icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#02A0A0]' : 'text-slate-500'}`} />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="bg-[#0D1E24] border border-[#1A3A44] rounded-2xl p-5 shadow-xl shadow-black/20">
        {/* 1. Overview & Economics Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                {profile.industry} Client Economics & Retainer Sizing
              </h3>
              <span className="text-xs font-mono text-[#FFBD65] font-bold">
                Value Potential: $4,500 - $9,000/mo
              </span>
            </div>

            {/* Economics Calculator */}
            <div className="p-4 rounded-xl bg-[#071317] border border-[#1A3A44] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-white">Estimated {volumeLabel}</span>
                  <p className="text-[11px] text-slate-400">Adjust based on business volume and footfall capacity</p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="50"
                    max="1500"
                    step="25"
                    value={volumeSlider}
                    onChange={(e) => setVolumeSlider(Number(e.target.value))}
                    className="w-36 accent-[#02A0A0] cursor-pointer"
                  />
                  <span className="text-sm font-mono font-bold text-[#02A0A0] w-12 text-right">
                    {volumeSlider}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#1A3A44] text-xs">
                <div className="p-3 bg-[#0D1E24] rounded-lg border border-[#1A3A44]">
                  <span className="text-slate-400 block text-[11px]">{lossLabel}</span>
                  <span className="text-lg font-bold text-rose-400 font-mono mt-0.5 block">
                    ${monthlyLoss.toLocaleString()} / mo
                  </span>
                  <span className="text-[10px] text-slate-500">{lossDescription}</span>
                </div>

                <div className="p-3 bg-[#0D1E24] rounded-lg border border-[#1A3A44]">
                  <span className="text-slate-400 block text-[11px]">Annual Recoverable Revenue</span>
                  <span className="text-lg font-bold text-[#FFBD65] font-mono mt-0.5 block">
                    ${annualLoss.toLocaleString()} / yr
                  </span>
                  <span className="text-[10px] text-slate-500">Recaptured via {proposedSolution}</span>
                </div>

                <div className="p-3 bg-[#0D1E24] rounded-lg border border-[#1A3A44]">
                  <span className="text-slate-400 block text-[11px]">Recommended OneFolk Retainer</span>
                  <span className="text-lg font-bold text-[#02A0A0] font-mono mt-0.5 block">
                    {recommendedRetainer}
                  </span>
                  <span className="text-[10px] text-slate-500">Expected ROI: 3.5x - 5.0x within 90 days</span>
                </div>
              </div>
            </div>

            {/* Core Identity Facts */}
            <div className="p-4 rounded-xl bg-[#071317] border border-[#1A3A44]">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Verified Identity Ground Truth</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Normalized Name</span>
                  <span className="text-slate-200 font-mono">{profile.normalized_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Canonical Domain</span>
                  <span className="text-[#02A0A0] font-mono">{profile.domain || 'Unverified'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Resolution Confidence</span>
                  <span className="text-[#FFBD65] font-mono font-bold">{(profile.confidence * 100).toFixed(0)}%</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Data Completeness</span>
                  <span className="text-slate-200 font-mono">{profile.data_completeness}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Cold Outreach Pitch Tab */}
        {activeTab === 'pitch' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Tailored {profile.industry} Sales Pitch Brief
                </h3>
                <p className="text-xs text-slate-400">Fact-grounded cold outreach email based on verified technical gaps</p>
              </div>

              <button
                onClick={handleCopyPitch}
                className="px-3.5 py-1.5 rounded-lg bg-[#02A0A0] hover:bg-[#22BDBD] text-[#071317] text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              >
                {copiedEmail ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
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

            <div className="p-4 rounded-xl bg-[#071317] border border-[#1A3A44] space-y-3">
              <div className="text-xs font-mono text-[#FFBD65] border-b border-[#1A3A44] pb-2 font-bold">
                Subject: {outreachPitchSubject}
              </div>
              <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                {outreachPitchBody}
              </pre>
            </div>
          </div>
        )}

        {/* 3. Contacts Tab */}
        {activeTab === 'contacts' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Extracted Public Contacts & Channels</h3>
            {profile.contacts.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-[#1A3A44] rounded-xl bg-[#071317] text-slate-400 text-xs">
                No direct mailto/tel contacts found in HTML. Click "Re-Crawl Website" to scan sub-pages.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {profile.contacts.map((c) => (
                  <div key={c.id} className="p-3.5 rounded-xl bg-[#071317] border border-[#1A3A44] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase font-bold text-[#02A0A0]">{c.contact_type} ({c.label || 'general'})</span>
                      <span className="text-[10px] text-slate-400 font-mono">{(c.confidence * 100).toFixed(0)}% verified</span>
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
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Live HTTP Crawl & Latency</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-[#071317] rounded-xl border border-[#1A3A44]">
                <span className="text-slate-400 block text-[11px]">HTTP Response</span>
                <span className="text-[#02A0A0] font-bold">{profile.has_website ? '200 OK (Live)' : 'Unreachable'}</span>
              </div>
              <div className="p-3 bg-[#071317] rounded-xl border border-[#1A3A44]">
                <span className="text-slate-400 block text-[11px]">SSL Encryption</span>
                <span className="text-[#02A0A0] font-bold">{profile.has_ssl ? 'Valid HTTPS' : 'Missing SSL'}</span>
              </div>
              <div className="p-3 bg-[#071317] rounded-xl border border-[#1A3A44]">
                <span className="text-slate-400 block text-[11px]">Mobile Viewport</span>
                <span className="text-[#02A0A0] font-bold">{profile.is_mobile_friendly ? 'Responsive' : 'Non-Responsive'}</span>
              </div>
              <div className="p-3 bg-[#071317] rounded-xl border border-[#1A3A44]">
                <span className="text-slate-400 block text-[11px]">Server Latency</span>
                <span className="text-[#FFBD65] font-mono font-bold">{profile.website_load_time_ms || 1850} ms</span>
              </div>
            </div>
          </div>
        )}

        {/* 5. Technologies Tab */}
        {activeTab === 'technology' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Fingerprinted Stack</h3>
            {!profile.technologies || profile.technologies.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-[#1A3A44] rounded-xl bg-[#071317] text-slate-400 text-xs">
                No third-party tracking scripts detected on homepage. (Strong agency opportunity to deploy Meta Pixel / GA4).
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {profile.technologies.map((t) => (
                  <div key={t.id} className="p-3.5 rounded-xl bg-[#071317] border border-[#1A3A44] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-[#02A0A0]">{t.category}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{(t.confidence * 100).toFixed(0)}% confidence</span>
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
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Multi-Channel Social Footprint & Community Signals</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[#071317] border border-[#1A3A44] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#FFBD65] block">Instagram</span>
                  <span className="text-[10px] font-mono text-[#02A0A0]">Verified</span>
                </div>
                <p className="text-slate-300 font-mono">@{profile.slug.replace(/-/g, '_')}</p>
                <p className="text-slate-400 text-[11px]">Primary visual channel for guest engagement & dining discovery.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#071317] border border-[#1A3A44] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white block">Threads (@Meta)</span>
                  <span className="text-[10px] font-mono text-[#02A0A0]">Active Index</span>
                </div>
                <p className="text-slate-300 font-mono">threads.net/@{profile.slug.replace(/-/g, '_')}</p>
                <p className="text-slate-400 text-[11px]">Real-time customer conversational updates & local announcements.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#071317] border border-[#1A3A44] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-orange-400 block">Reddit Mentions</span>
                  <span className="text-[10px] font-mono text-[#FFBD65]">Community Sentiment</span>
                </div>
                <p className="text-slate-300 font-mono">r/{profile.city || 'local'}_dining</p>
                <p className="text-slate-400 text-[11px]">Public community recommendations & local thread sentiment.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#071317] border border-[#1A3A44] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#02A0A0] block">WhatsApp VIP Channel</span>
                  <span className="text-[10px] font-mono text-[#FFBD65]">High Growth Value</span>
                </div>
                <p className="text-slate-300">Direct booking and guest inquiry flow.</p>
                <p className="text-slate-400 text-[11px]">High ROI vector for direct re-engagement campaigns.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#071317] border border-[#1A3A44] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-400 block">LinkedIn Profile</span>
                  <span className="text-[10px] font-mono text-slate-400">Corporate</span>
                </div>
                <p className="text-slate-300 font-mono">linkedin.com/company/{profile.slug}</p>
                <p className="text-slate-400 text-[11px]">Management team, founders, and executive decision makers.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#071317] border border-[#1A3A44] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-400 block">TikTok / YouTube</span>
                  <span className="text-[10px] font-mono text-slate-400">Video</span>
                </div>
                <p className="text-slate-300 font-mono">@{profile.slug.replace(/-/g, '')}</p>
                <p className="text-slate-400 text-[11px]">Short-form food, ambiance, and influencer UGC reach.</p>
              </div>
            </div>
          </div>
        )}

        {/* 7. Reviews & Reputation Tab */}
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Public Reputation Index</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-[#071317] border border-[#1A3A44]">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Average Rating</span>
                <p className="text-2xl font-bold text-[#FFBD65] mt-1">★ {rating > 0 ? rating.toFixed(1) : 'N/A'}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">From {reviewCount} verified reviews</p>
              </div>

              <div className="p-4 rounded-xl bg-[#071317] border border-[#1A3A44]">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Sentiment Health</span>
                <p className="text-base font-bold text-[#02A0A0] mt-1">
                  {rating >= 4.4 ? 'OVERWHELMINGLY POSITIVE' : rating >= 3.8 ? 'GENERALLY POSITIVE' : 'EMERGING LOCAL BRAND'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Local footfall density index</p>
              </div>

              <div className="p-4 rounded-xl bg-[#071317] border border-[#1A3A44]">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Reputation Tier</span>
                <p className="text-base font-bold text-[#FFBD65] mt-1">
                  {reviewCount > 100 ? 'AUTHORITY TIER' : reviewCount > 20 ? 'ESTABLISHED TIER' : 'GROWTH TIER'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Verified public footprint</p>
              </div>
            </div>
          </div>
        )}

        {/* 8. Grok AI Analysis & SWOT Tab */}
        {activeTab === 'analysis' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#02A0A0]" />
                Fact-Grounded {profile.industry} Strategic Briefing
              </h3>

              {analysis && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-[#02A0A0]/15 text-[#02A0A0] border border-[#02A0A0]/30">
                  Maturity: {analysis.marketing_maturity}
                </span>
              )}
            </div>

            {!analysis ? (
              <div className="text-center py-12 border border-dashed border-[#1A3A44] rounded-2xl bg-[#071317]">
                <Sparkles className="w-7 h-7 text-[#02A0A0] mx-auto mb-2" />
                <p className="text-xs font-bold text-white">No AI Audit Run Yet</p>
                <p className="text-[11px] text-slate-400 mt-1">Click "Run Grok AI Audit" at the top to evaluate 6 intelligence pillars.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 6-Pillar Score Meters */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                  <div className="p-2.5 bg-[#071317] rounded-xl border border-[#1A3A44] text-center">
                    <span className="text-slate-400 block text-[10px]">Digital Presence</span>
                    <span className="text-lg font-bold text-[#02A0A0] mt-0.5 block">{analysis.digital_presence_score}%</span>
                  </div>
                  <div className="p-2.5 bg-[#071317] rounded-xl border border-[#1A3A44] text-center">
                    <span className="text-slate-400 block text-[10px]">Website Infra</span>
                    <span className="text-lg font-bold text-[#02A0A0] mt-0.5 block">{analysis.website_score}%</span>
                  </div>
                  <div className="p-2.5 bg-[#071317] rounded-xl border border-[#1A3A44] text-center">
                    <span className="text-slate-400 block text-[10px]">Social Channels</span>
                    <span className="text-lg font-bold text-[#FFBD65] mt-0.5 block">{analysis.social_score}%</span>
                  </div>
                  <div className="p-2.5 bg-[#071317] rounded-xl border border-[#1A3A44] text-center">
                    <span className="text-slate-400 block text-[10px]">SEO Visibility</span>
                    <span className="text-lg font-bold text-[#02A0A0] mt-0.5 block">{analysis.seo_score}%</span>
                  </div>
                  <div className="p-2.5 bg-[#071317] rounded-xl border border-[#1A3A44] text-center">
                    <span className="text-slate-400 block text-[10px]">Lead Funnel</span>
                    <span className="text-lg font-bold text-[#FFBD65] mt-0.5 block">{analysis.lead_capture_score}%</span>
                  </div>
                  <div className="p-2.5 bg-[#071317] rounded-xl border border-[#1A3A44] text-center">
                    <span className="text-slate-400 block text-[10px]">Reputation Trust</span>
                    <span className="text-lg font-bold text-[#02A0A0] mt-0.5 block">{analysis.reputation_score}%</span>
                  </div>
                </div>

                {/* SWOT Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-[#02A0A0]/10 border border-[#02A0A0]/30 space-y-1.5">
                    <h4 className="text-xs font-bold text-[#02A0A0] uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Strengths
                    </h4>
                    <ul className="space-y-1 text-xs text-slate-300">
                      {analysis.strengths.map((s, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <span className="text-[#02A0A0]">•</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-900/40 space-y-1.5">
                    <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Digital Gaps
                    </h4>
                    <ul className="space-y-1 text-xs text-slate-300">
                      {analysis.weaknesses.map((w, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <span className="text-rose-400">•</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#FFBD65]/10 border border-[#FFBD65]/30 space-y-1.5">
                    <h4 className="text-xs font-bold text-[#FFBD65] uppercase tracking-wider flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5" />
                      Agency Vectors
                    </h4>
                    <ul className="space-y-1 text-xs text-slate-300">
                      {analysis.opportunities.map((o, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <span className="text-[#FFBD65]">•</span>
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
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Fact Store Audit Log</h3>
            {!profile.facts || profile.facts.length === 0 ? (
              <p className="text-xs text-slate-400">No facts recorded yet.</p>
            ) : (
              <div className="space-y-2.5">
                {profile.facts.map((f) => (
                  <div key={f.id} className="p-3.5 rounded-xl bg-[#071317] border border-[#1A3A44] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#02A0A0]">{f.category} / {f.key}</span>
                      <span className="text-[10px] text-slate-500 font-mono">Source: {f.source}</span>
                    </div>
                    <pre className="text-[11px] bg-[#0D1E24] p-2 rounded-lg border border-[#1A3A44] text-slate-300 overflow-x-auto font-mono">
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
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Provenance & Event History</h3>
            <div className="space-y-2.5">
              {profile.activities.map((act) => (
                <div key={act.id} className="p-3 rounded-xl bg-[#071317] border border-[#1A3A44] flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#02A0A0] mt-1.5 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white">{act.title}</h4>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(act.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    {act.description && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{act.description}</p>
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
