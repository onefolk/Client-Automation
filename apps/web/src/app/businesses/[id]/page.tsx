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
  MapPin,
  Lock,
} from 'lucide-react';

const tabs = [
  { id: 'overview', name: 'Overview & Economics', icon: Building2 },
  { id: 'pitch', name: 'Outreach Pitch', icon: Send },
  { id: 'contacts', name: 'Contacts & Channels', icon: Users },
  { id: 'website', name: 'Infrastructure', icon: Globe },
  { id: 'technology', name: 'Tech Stack', icon: Code2 },
  { id: 'social', name: 'Social Footprint', icon: MessageSquare },
  { id: 'reviews', name: 'Reputation', icon: Star },
  { id: 'analysis', name: 'SWOT Intelligence', icon: Sparkles },
  { id: 'facts', name: 'Fact Store', icon: Database },
  { id: 'activity', name: 'Audit Timeline', icon: Activity },
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
      <div className="flex flex-col items-center justify-center py-28 text-center">
        <RefreshCw className="w-5 h-5 text-zinc-400 animate-spin mb-3" />
        <p className="text-xs text-zinc-400">Loading intelligence profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-md mx-auto my-20 p-6 rounded-lg border border-white/[0.08] bg-[#111113] text-center space-y-3">
        <AlertTriangle className="w-5 h-5 text-zinc-500 mx-auto" />
        <h3 className="text-xs font-semibold text-white">Client Record Not Found</h3>
        <p className="text-xs text-zinc-400">
          The requested profile could not be retrieved.
        </p>
        <Link
          href="/discover"
          className="inline-flex items-center gap-1 text-xs text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-md transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Return to Discovery
        </Link>
      </div>
    );
  }

  const analysis = profile.analysis;
  const rating = profile.rating || 4.0;
  const reviewCount = profile.review_count || 0;

  // Dynamic industry metrics calculation
  const ind = (profile.industry || '').toLowerCase();
  const isHealthcare = ind.includes('health') || ind.includes('dent') || ind.includes('clinic') || ind.includes('medic');
  const isEducation = ind.includes('school') || ind.includes('educat') || ind.includes('academ') || ind.includes('college') || ind.includes('university');
  const isRealEstate = ind.includes('real') || ind.includes('estate') || ind.includes('property');
  const isLegal = ind.includes('law') || ind.includes('legal') || ind.includes('attorney');
  const isHospitality = ind.includes('hotel') || ind.includes('resort') || ind.includes('spa') || ind.includes('hospitality');

  let volumeLabel = 'Monthly Guest Volume';
  let unitValue = 45;
  let lossLabel = 'Monthly Aggregator Commission Loss';
  let lossDescription = 'Based on 18% marketplace take rate';
  let monthlyLoss = Math.round(volumeSlider * unitValue * 0.18);
  let recommendedRetainer = '$4,500 / mo + 5% rev-share';
  let proposedSolution = 'Direct Booking Engine & VIP Retention';

  if (isEducation) {
    volumeLabel = 'Enrolled Students';
    unitValue = 650;
    lossLabel = 'Monthly Administrative Overhead & Delayed Tuition Leakage';
    lossDescription = 'Based on manual fee reconciliation and disconnected records';
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

  const outreachPitchSubject = `Quick question regarding ${proposedSolution.toLowerCase()} for ${profile.name}`;
  const outreachPitchBody = `Hi ${profile.name} team,

I came across ${profile.name} while auditing high-reputation ${profile.industry || 'local'} establishments in ${profile.city || 'your area'}${rating > 0 ? ` (noted your ★ ${rating.toFixed(1)} rating across ${reviewCount} reviews)` : ''}.

When reviewing your website (${profile.domain || 'online presence'}), I noticed an opportunity to implement ${proposedSolution.toLowerCase()}.

For a business of your scale (~${volumeSlider} ${volumeLabel.toLowerCase()}), this gap typically accounts for over $${monthlyLoss.toLocaleString()}/month in avoidable losses.

At OneFolk, we partner with premier ${profile.industry || 'service'} brands to deploy turnkey conversion systems that recapture this revenue within 60-90 days.

Would you have 10 minutes this week for a brief walkthrough of what this implementation looks like for ${profile.name}?

Best regards,
Agency Growth Team | OneFolk Client Intelligence`;

  const handleCopyPitch = () => {
    navigator.clipboard.writeText(`Subject: ${outreachPitchSubject}\n\n${outreachPitchBody}`);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/clientHistory"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Client History
        </Link>

        <span className="text-[11px] font-mono text-zinc-500">
          ID: {profile.id.slice(0, 8)}...
        </span>
      </div>

      {/* Hero Card */}
      <div className="rounded-lg border border-white/[0.08] bg-[#111113] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-white tracking-tight">{profile.name}</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/[0.06]">
                {profile.industry || 'General'}
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border font-medium ${
                  profile.priority === 'HIGH'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-zinc-800 text-zinc-400 border-white/[0.06]'
                }`}
              >
                {profile.priority} Priority ({profile.priority_score}%)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-zinc-400">
              {profile.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                  {profile.city}, {profile.country}
                </span>
              )}
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-zinc-300 hover:text-white flex items-center gap-1 font-mono text-[11px]"
                >
                  <Globe className="w-3.5 h-3.5 text-zinc-500" />
                  {profile.domain}
                </a>
              )}
              {profile.email && (
                <span className="text-zinc-300 font-mono text-[11px] flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-zinc-500" />
                  {profile.email}
                </span>
              )}
              {profile.phone && (
                <span className="text-zinc-300 font-mono text-[11px] flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-zinc-500" />
                  {profile.phone}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => enrichMutation.mutate()}
              disabled={enrichMutation.isPending}
              className="px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-medium border border-white/[0.08] transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${enrichMutation.isPending ? 'animate-spin' : ''}`} />
              Re-Crawl
            </button>

            <button
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
              className="px-3 py-1.5 rounded-md bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {analyzeMutation.isPending ? 'Evaluating...' : 'Run LLaMA Audit'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-white/[0.08] text-xs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-md font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                isActive
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="rounded-lg border border-white/[0.08] bg-[#111113] p-5">
        {/* 1. Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            <div className="border-b border-white/[0.06] pb-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                {profile.industry || 'Client'} Economics & Sizing
              </h3>
            </div>

            <div className="p-4 rounded-md bg-zinc-900/60 border border-white/[0.06] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-medium text-white">{volumeLabel}</span>
                  <p className="text-[11px] text-zinc-400">Adjust volume to calculate estimated monthly leakage</p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="50"
                    max="1500"
                    step="25"
                    value={volumeSlider}
                    onChange={(e) => setVolumeSlider(Number(e.target.value))}
                    className="w-36 accent-white cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold text-white w-10 text-right">
                    {volumeSlider}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div className="p-3 bg-[#111113] rounded border border-white/[0.06]">
                  <span className="text-[10px] text-zinc-500 uppercase block font-mono">{lossLabel}</span>
                  <span className="text-base font-bold text-rose-400 font-mono mt-0.5 block">
                    ${monthlyLoss.toLocaleString()} / mo
                  </span>
                </div>

                <div className="p-3 bg-[#111113] rounded border border-white/[0.06]">
                  <span className="text-[10px] text-zinc-500 uppercase block font-mono">Annual Loss</span>
                  <span className="text-base font-bold text-amber-400 font-mono mt-0.5 block">
                    ${annualLoss.toLocaleString()} / yr
                  </span>
                </div>

                <div className="p-3 bg-[#111113] rounded border border-white/[0.06]">
                  <span className="text-[10px] text-zinc-500 uppercase block font-mono">Target Retainer</span>
                  <span className="text-base font-bold text-emerald-400 font-mono mt-0.5 block">
                    {recommendedRetainer}
                  </span>
                </div>
              </div>
            </div>

            {/* Entity Facts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2">
              <div className="p-3 rounded bg-zinc-900/60 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block uppercase font-mono">Normalized Name</span>
                <span className="text-zinc-200 font-medium truncate block">{profile.normalized_name}</span>
              </div>
              <div className="p-3 rounded bg-zinc-900/60 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block uppercase font-mono">Canonical Domain</span>
                <span className="text-zinc-200 font-mono truncate block">{profile.domain || 'Unverified'}</span>
              </div>
              <div className="p-3 rounded bg-zinc-900/60 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block uppercase font-mono">Resolution Confidence</span>
                <span className="text-zinc-200 font-mono font-medium block">{(profile.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="p-3 rounded bg-zinc-900/60 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 block uppercase font-mono">Data Completeness</span>
                <span className="text-zinc-200 font-mono font-medium block">{profile.data_completeness}%</span>
              </div>
            </div>
          </div>
        )}

        {/* 2. Cold Outreach Pitch */}
        {activeTab === 'pitch' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Cold Outreach Template
              </h3>
              <button
                onClick={handleCopyPitch}
                className="px-3 py-1.5 rounded-md bg-white hover:bg-zinc-200 text-black text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedEmail ? 'Copied' : 'Copy Pitch'}
              </button>
            </div>

            <div className="p-4 rounded-md bg-zinc-900/70 border border-white/[0.06] space-y-3 text-xs">
              <div className="font-mono text-zinc-300 border-b border-white/[0.06] pb-2 font-medium">
                Subject: {outreachPitchSubject}
              </div>
              <pre className="font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {outreachPitchBody}
              </pre>
            </div>
          </div>
        )}

        {/* 3. Contacts */}
        {activeTab === 'contacts' && (
          <div className="space-y-4">
            <div className="border-b border-white/[0.06] pb-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Discovered Contacts & Decision Makers
              </h3>
            </div>

            {profile.contacts.length === 0 ? (
              <p className="text-xs text-zinc-400 py-6 text-center">No contacts extracted yet. Try re-crawling the website.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {profile.contacts.map((c) => (
                  <div key={c.id} className="p-3 rounded-md bg-zinc-900/60 border border-white/[0.06] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase">{c.contact_type}</span>
                      <span className="text-[10px] font-mono text-zinc-500">{(c.confidence * 100).toFixed(0)}% verified</span>
                    </div>
                    <p className="font-mono text-white font-medium">{c.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. Infrastructure */}
        {activeTab === 'website' && (
          <div className="space-y-4">
            <div className="border-b border-white/[0.06] pb-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Website Telemetry
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded bg-zinc-900/60 border border-white/[0.06]">
                <span className="text-[10px] text-zinc-500 uppercase block font-mono">Status</span>
                <span className="text-emerald-400 font-medium block mt-1">
                  {profile.has_website ? '200 OK' : 'Offline'}
                </span>
              </div>
              <div className="p-3 rounded bg-zinc-900/60 border border-white/[0.06]">
                <span className="text-[10px] text-zinc-500 uppercase block font-mono">SSL</span>
                <span className="text-emerald-400 font-medium block mt-1">
                  {profile.has_ssl ? 'Valid TLS' : 'Missing'}
                </span>
              </div>
              <div className="p-3 rounded bg-zinc-900/60 border border-white/[0.06]">
                <span className="text-[10px] text-zinc-500 uppercase block font-mono">Mobile</span>
                <span className="text-zinc-200 font-medium block mt-1">
                  {profile.is_mobile_friendly ? 'Responsive' : 'Non-Responsive'}
                </span>
              </div>
              <div className="p-3 rounded bg-zinc-900/60 border border-white/[0.06]">
                <span className="text-[10px] text-zinc-500 uppercase block font-mono">Latency</span>
                <span className="text-zinc-200 font-mono font-medium block mt-1">
                  {profile.website_load_time_ms || 1850} ms
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 5. Tech Stack */}
        {activeTab === 'technology' && (
          <div className="space-y-4">
            <div className="border-b border-white/[0.06] pb-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Fingerprinted Technologies
              </h3>
            </div>

            {!profile.technologies || profile.technologies.length === 0 ? (
              <p className="text-xs text-zinc-400 py-6 text-center">No third-party trackers detected on homepage.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {profile.technologies.map((t) => (
                  <div key={t.id} className="p-3 rounded-md bg-zinc-900/60 border border-white/[0.06] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase">{t.category}</span>
                      <span className="text-[10px] font-mono text-zinc-500">{(t.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <p className="text-white font-medium">{t.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 6. Social Footprint */}
        {activeTab === 'social' && (
          <div className="space-y-4">
            <div className="border-b border-white/[0.06] pb-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Social Channels
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-md bg-zinc-900/60 border border-white/[0.06] space-y-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Instagram</span>
                <p className="text-white font-mono">@{profile.slug.replace(/-/g, '_')}</p>
              </div>
              <div className="p-3 rounded-md bg-zinc-900/60 border border-white/[0.06] space-y-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Threads</span>
                <p className="text-white font-mono">threads.net/@{profile.slug.replace(/-/g, '_')}</p>
              </div>
              <div className="p-3 rounded-md bg-zinc-900/60 border border-white/[0.06] space-y-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">LinkedIn</span>
                <p className="text-white font-mono">linkedin.com/company/{profile.slug}</p>
              </div>
            </div>
          </div>
        )}

        {/* 7. Reviews */}
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            <div className="border-b border-white/[0.06] pb-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Reputation Metrics
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-4 rounded-md bg-zinc-900/60 border border-white/[0.06]">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Rating</span>
                <div className="text-xl font-bold text-amber-400 mt-1">★ {rating.toFixed(1)}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">{reviewCount} reviews</div>
              </div>
              <div className="p-4 rounded-md bg-zinc-900/60 border border-white/[0.06]">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Sentiment</span>
                <div className="text-sm font-bold text-emerald-400 mt-1">
                  {rating >= 4.4 ? 'Positive' : 'Emerging'}
                </div>
              </div>
              <div className="p-4 rounded-md bg-zinc-900/60 border border-white/[0.06]">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Tier</span>
                <div className="text-sm font-bold text-zinc-200 mt-1">
                  {reviewCount > 100 ? 'Authority' : 'Established'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 8. SWOT Analysis */}
        {activeTab === 'analysis' && (
          <div className="space-y-4">
            <div className="border-b border-white/[0.06] pb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                AI Strategic Assessment
              </h3>
              {analysis && (
                <span className="text-[10px] font-mono text-zinc-400">Maturity: {analysis.marketing_maturity}</span>
              )}
            </div>

            {!analysis ? (
              <p className="text-xs text-zinc-400 py-6 text-center">Click &quot;Run LLaMA Audit&quot; to synthesize strategic SWOT analysis.</p>
            ) : (
              <div className="space-y-4 text-xs">
                {/* 6 scores */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                  <div className="p-2 rounded bg-zinc-900/60 border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 block font-mono">Digital</span>
                    <span className="font-mono font-bold text-white">{analysis.digital_presence_score}%</span>
                  </div>
                  <div className="p-2 rounded bg-zinc-900/60 border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 block font-mono">Web</span>
                    <span className="font-mono font-bold text-white">{analysis.website_score}%</span>
                  </div>
                  <div className="p-2 rounded bg-zinc-900/60 border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 block font-mono">Social</span>
                    <span className="font-mono font-bold text-white">{analysis.social_score}%</span>
                  </div>
                  <div className="p-2 rounded bg-zinc-900/60 border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 block font-mono">SEO</span>
                    <span className="font-mono font-bold text-white">{analysis.seo_score}%</span>
                  </div>
                  <div className="p-2 rounded bg-zinc-900/60 border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 block font-mono">Funnels</span>
                    <span className="font-mono font-bold text-white">{analysis.lead_capture_score}%</span>
                  </div>
                  <div className="p-2 rounded bg-zinc-900/60 border border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500 block font-mono">Trust</span>
                    <span className="font-mono font-bold text-white">{analysis.reputation_score}%</span>
                  </div>
                </div>

                {/* SWOT grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded bg-zinc-900/60 border border-white/[0.06] space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold block">Strengths</span>
                    <ul className="space-y-1 text-zinc-300">
                      {analysis.strengths.map((s, idx) => (
                        <li key={idx}>• {s}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 rounded bg-zinc-900/60 border border-white/[0.06] space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-rose-400 font-bold block">Gaps & Bottlenecks</span>
                    <ul className="space-y-1 text-zinc-300">
                      {analysis.weaknesses.map((w, idx) => (
                        <li key={idx}>• {w}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 rounded bg-zinc-900/60 border border-white/[0.06] space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-amber-400 font-bold block">Opportunities</span>
                    <ul className="space-y-1 text-zinc-300">
                      {analysis.opportunities.map((o, idx) => (
                        <li key={idx}>• {o}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 9. Facts */}
        {activeTab === 'facts' && (
          <div className="space-y-4">
            <div className="border-b border-white/[0.06] pb-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Fact Store Audit Log
              </h3>
            </div>

            {!profile.facts || profile.facts.length === 0 ? (
              <p className="text-xs text-zinc-400 py-6 text-center">No facts recorded yet.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {profile.facts.map((f) => (
                  <div key={f.id} className="p-3 rounded bg-zinc-900/60 border border-white/[0.06] space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                      <span>{f.category} / {f.key}</span>
                      <span>Source: {f.source}</span>
                    </div>
                    <pre className="p-2 rounded bg-black/40 text-zinc-300 font-mono text-[11px] overflow-x-auto">
                      {JSON.stringify(f.value, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 10. Activity */}
        {activeTab === 'activity' && (
          <div className="space-y-4">
            <div className="border-b border-white/[0.06] pb-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Audit Timeline
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              {profile.activities.map((act) => (
                <div key={act.id} className="p-3 rounded bg-zinc-900/60 border border-white/[0.06] flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{act.title}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(act.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    {act.description && (
                      <p className="text-[11px] text-zinc-400 mt-0.5">{act.description}</p>
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
