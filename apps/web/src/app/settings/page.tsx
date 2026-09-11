'use client';

import React from 'react';
import { Settings, Cpu, Database, Network, CheckCircle2, ShieldCheck, Globe, Server, Terminal, Lock } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Settings className="w-5 h-5" />
          </div>
          System & Engine Settings
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Telemetry configuration for real-time discovery providers, HTTP crawler pipelines, and Grok AI intelligence engines.
        </p>
      </div>

      <div className="space-y-4">
        {/* Provider Registry Card */}
        <div className="bg-[#0E1118] border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Network className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Active Discovery Providers</h3>
                <p className="text-xs text-slate-400">Real-time public web & local registry discovery plugins</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
              Live Ingestion Active
            </span>
          </div>

          <div className="p-4 bg-[#090A0F] rounded-2xl border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-white">Live Public Registry & Web Search</span>
                <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">
                  live_public_registry
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Real-time query ingestion across OpenStreetMap, public municipal business registries, and live HTTP domain crawlers.
              </p>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold shrink-0">
              <CheckCircle2 className="w-4 h-4" />
              Active (100% Live)
            </span>
          </div>
        </div>

        {/* Live HTTP Crawler & Technology Detection Engine */}
        <div className="bg-[#0E1118] border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Level 1 HTTP Crawler & Technology Detector</h3>
              <p className="text-xs text-slate-400">Inspects live HTML, extracts public emails, phones, and fingerprints tech stacks</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-4 bg-[#090A0F] rounded-2xl border border-white/[0.06]">
              <span className="text-slate-500 block text-[11px] mb-1">User-Agent Identifier</span>
              <span className="text-slate-200 font-mono font-medium">OneFolkClientBot/1.0</span>
            </div>
            <div className="p-4 bg-[#090A0F] rounded-2xl border border-white/[0.06]">
              <span className="text-slate-500 block text-[11px] mb-1">HTTP Request Timeout</span>
              <span className="text-amber-400 font-mono font-bold">6,000 ms</span>
            </div>
            <div className="p-4 bg-[#090A0F] rounded-2xl border border-white/[0.06]">
              <span className="text-slate-500 block text-[11px] mb-1">SSRF Protection Filter</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Enabled & Enforced
              </span>
            </div>
          </div>
        </div>

        {/* AI Engine Configuration */}
        <div className="bg-[#0E1118] border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">AI Intelligence Engine</h3>
              <p className="text-xs text-slate-400">Synthesizes structured fact store data into agency conversion briefs</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-400 block text-[11px] font-medium">Active AI Model</label>
              <input
                type="text"
                disabled
                value="grok-beta (xAI)"
                className="w-full bg-[#090A0F] border border-white/[0.08] rounded-2xl p-3 text-blue-400 font-mono font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-400 block text-[11px] font-medium">Inference Architecture</label>
              <input
                type="text"
                disabled
                value="Live Fact-Guided Deterministic Analysis"
                className="w-full bg-[#090A0F] border border-white/[0.08] rounded-2xl p-3 text-slate-300 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Infrastructure Info */}
        <div className="bg-[#0E1118] border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Database & Realtime Infrastructure</h3>
              <p className="text-xs text-slate-400">PostgreSQL master store + Redis Streams job broker + SSE pipeline</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-4 bg-[#090A0F] rounded-2xl border border-white/[0.06]">
              <span className="text-slate-500 block text-[11px] mb-1">Master Database</span>
              <span className="text-blue-400 font-semibold">PostgreSQL (Deduplicated Master)</span>
            </div>
            <div className="p-4 bg-[#090A0F] rounded-2xl border border-white/[0.06]">
              <span className="text-slate-500 block text-[11px] mb-1">Queue & Stream System</span>
              <span className="text-blue-400 font-semibold">Redis Streams (Asynchronous)</span>
            </div>
            <div className="p-4 bg-[#090A0F] rounded-2xl border border-white/[0.06]">
              <span className="text-slate-500 block text-[11px] mb-1">Streaming Protocol</span>
              <span className="text-amber-400 font-semibold font-mono">Server-Sent Events (SSE)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
