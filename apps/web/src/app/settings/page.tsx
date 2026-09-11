'use client';

import React from 'react';
import { Settings, Cpu, Database, Network, ShieldCheck, Globe, CheckCircle2, Lock, Terminal } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Page Header */}
      <div className="border-b border-white/[0.08] pb-5">
        <h1 className="text-xl font-bold text-white tracking-tight">System & Engine Settings</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Infrastructure configurations, real-time discovery providers, and Grok AI intelligence parameters.
        </p>
      </div>

      <div className="space-y-6">
        {/* Section 1: Discovery Ingestion Providers */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Discovery Ingestion Providers</h2>
              <p className="text-xs text-zinc-400">Public registry aggregators and geographic data sources.</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Ingestion Active
            </span>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-[#111113] divide-y divide-white/[0.06]">
            <div className="p-4 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-200">OpenStreetMap & Municipal Web Search</span>
                  <code className="text-[11px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-white/[0.06]">
                    live_public_registry
                  </code>
                </div>
                <p className="text-xs text-zinc-400">
                  Real-time query ingestion across OpenStreetMap, public municipal registries, and live HTTP domain crawlers.
                </p>
              </div>
              <span className="text-xs font-medium text-emerald-400 flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Operational
              </span>
            </div>
          </div>
        </section>

        {/* Section 2: HTTP Crawler Engine */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-white">HTTP Crawler & Technology Detector</h2>
            <p className="text-xs text-zinc-400">Live HTML scraping parameters, bot headers, and security filters.</p>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-[#111113] divide-y divide-white/[0.06]">
            <div className="p-3.5 px-4 flex items-center justify-between text-xs">
              <span className="text-zinc-400">User-Agent Identifier</span>
              <code className="font-mono text-zinc-200 bg-zinc-900 px-2 py-1 rounded border border-white/[0.06]">
                OneFolkClientBot/1.0
              </code>
            </div>
            <div className="p-3.5 px-4 flex items-center justify-between text-xs">
              <span className="text-zinc-400">HTTP Connection Timeout</span>
              <span className="font-mono text-zinc-200 font-medium">6,000 ms</span>
            </div>
            <div className="p-3.5 px-4 flex items-center justify-between text-xs">
              <span className="text-zinc-400">SSRF Protection & Host Validation</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Enabled
              </span>
            </div>
          </div>
        </section>

        {/* Section 3: AI Intelligence Engine */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-white">AI Intelligence Engine</h2>
            <p className="text-xs text-zinc-400">Large language model provider and structured fact synthesis mode.</p>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-[#111113] divide-y divide-white/[0.06]">
            <div className="p-3.5 px-4 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Model Provider</span>
              <code className="font-mono text-zinc-200 bg-zinc-900 px-2 py-1 rounded border border-white/[0.06]">
                grok-beta (xAI)
              </code>
            </div>
            <div className="p-3.5 px-4 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Inference Architecture</span>
              <span className="text-zinc-300 font-medium">Deterministic Fact-Guided Synthesis</span>
            </div>
          </div>
        </section>

        {/* Section 4: Data Infrastructure */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Data Infrastructure</h2>
            <p className="text-xs text-zinc-400">Core storage, message broker, and real-time streaming pipeline.</p>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-[#111113] divide-y divide-white/[0.06]">
            <div className="p-3.5 px-4 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Master Database</span>
              <span className="font-medium text-zinc-200">PostgreSQL (Deduplicated Master Store)</span>
            </div>
            <div className="p-3.5 px-4 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Queue & Job Broker</span>
              <span className="font-medium text-zinc-200">Redis Streams (Asynchronous Pipeline)</span>
            </div>
            <div className="p-3.5 px-4 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Streaming Protocol</span>
              <span className="font-mono text-zinc-200 font-medium">Server-Sent Events (SSE)</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
