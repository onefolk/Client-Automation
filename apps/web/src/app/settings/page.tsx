'use client';

import React from 'react';
import { Settings, Shield, Cpu, Database, Network, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <Settings className="w-7 h-7 text-indigo-400" />
          System & Provider Settings
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure active discovery providers, AI intelligence engines, and local-first infrastructure.
        </p>
      </div>

      <div className="space-y-4">
        {/* Provider Registry Card */}
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Network className="w-5 h-5 text-indigo-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Discovery Provider Plugins</h3>
                <p className="text-xs text-slate-400">Modular provider architecture for client search</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              1 Active Provider
            </span>
          </div>

          <div className="p-4 bg-[#090D16] rounded-xl border border-[#1E293B] flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">Universal Business Directory</span>
                <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">
                  mock_universal_discovery
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Deterministic high-fidelity discovery provider covering businesses, contact signals, and ratings.
              </p>
            </div>
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              Healthy
            </span>
          </div>
        </div>

        {/* AI Engine Configuration */}
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Grok AI Intelligence Model</h3>
              <p className="text-xs text-slate-400">Interprets structured fact store data after collection</p>
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
                value="Deterministic Rule + Fact-Guided LLM"
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
              <h3 className="text-sm font-bold text-white">Database & Queue Infrastructure</h3>
              <p className="text-xs text-slate-400">PostgreSQL master store + Redis Streams job broker</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-[#090D16] rounded-xl border border-[#1E293B]">
              <span className="text-slate-400 block">PostgreSQL</span>
              <span className="text-emerald-400 font-semibold">onefolk_intelligence (Port 5432)</span>
            </div>
            <div className="p-3 bg-[#090D16] rounded-xl border border-[#1E293B]">
              <span className="text-slate-400 block">Redis Streams</span>
              <span className="text-emerald-400 font-semibold">onefolk:jobs:discovery (Port 6379)</span>
            </div>
            <div className="p-3 bg-[#090D16] rounded-xl border border-[#1E293B]">
              <span className="text-slate-400 block">Real-time Delivery</span>
              <span className="text-cyan-400 font-semibold">Server-Sent Events (SSE)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
