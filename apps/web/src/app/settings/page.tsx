'use client';

import React from 'react';
import { Settings, Cpu, Database, Network, CheckCircle2, ShieldCheck, Globe } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <Settings className="w-7 h-7 text-indigo-400" />
          System & Provider Settings
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure real-time discovery providers, HTTP crawler pipelines, and intelligence engines.
        </p>
      </div>

      <div className="space-y-4">
        {/* Provider Registry Card */}
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Network className="w-5 h-5 text-indigo-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Active Discovery Providers</h3>
                <p className="text-xs text-slate-400">Real-time public web & local registry discovery plugins</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Live Provider Active
            </span>
          </div>

          <div className="p-4 bg-[#090D16] rounded-xl border border-[#1E293B] flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white">Live Public Registry & Web Search</span>
                <span className="text-[10px] font-mono bg-cyan-950/60 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-800/40">
                  live_public_registry
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Real-time query ingestion across OpenStreetMap, public municipal registries, and live HTTP domain crawlers.
              </p>
            </div>
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              Active (100% Live)
            </span>
          </div>
        </div>

        {/* Live HTTP Crawler & Technology Detection Engine */}
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Level 1 HTTP Crawler & Technology Detector</h3>
              <p className="text-xs text-slate-400">Inspects live HTML, extracts public emails, phones, and fingerprints tech stacks</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-[#090D16] rounded-xl border border-[#1E293B]">
              <span className="text-slate-400 block">User-Agent</span>
              <span className="text-slate-200 font-mono">OneFolkClientBot/1.0</span>
            </div>
            <div className="p-3 bg-[#090D16] rounded-xl border border-[#1E293B]">
              <span className="text-slate-400 block">HTTP Timeout</span>
              <span className="text-slate-200 font-mono">6,000 ms</span>
            </div>
            <div className="p-3 bg-[#090D16] rounded-xl border border-[#1E293B]">
              <span className="text-slate-400 block">SSRF Protection</span>
              <span className="text-emerald-400 font-semibold">Enabled</span>
            </div>
          </div>
        </div>

        {/* AI Engine Configuration */}
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-white">AI Intelligence Engine</h3>
              <p className="text-xs text-slate-400">Interprets structured fact store data after live collection</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Active AI Model</label>
              <input
                type="text"
                disabled
                value="grok-beta (xAI)"
                className="w-full bg-[#090D16] border border-[#1E293B] rounded-xl p-2.5 text-slate-300 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Inference Mode</label>
              <input
                type="text"
                disabled
                value="Live Fact-Guided Deterministic Analysis"
                className="w-full bg-[#090D16] border border-[#1E293B] rounded-xl p-2.5 text-slate-300 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Infrastructure Info */}
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Database & Realtime Infrastructure</h3>
              <p className="text-xs text-slate-400">PostgreSQL master store + Redis Streams job broker + SSE</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-[#090D16] rounded-xl border border-[#1E293B]">
              <span className="text-slate-400 block">Master Store</span>
              <span className="text-emerald-400 font-semibold">PostgreSQL (Deduplicated Master)</span>
            </div>
            <div className="p-3 bg-[#090D16] rounded-xl border border-[#1E293B]">
              <span className="text-slate-400 block">Queue System</span>
              <span className="text-emerald-400 font-semibold">Redis Streams</span>
            </div>
            <div className="p-3 bg-[#090D16] rounded-xl border border-[#1E293B]">
              <span className="text-slate-400 block">Real-time Protocol</span>
              <span className="text-cyan-400 font-semibold">Server-Sent Events (SSE)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
