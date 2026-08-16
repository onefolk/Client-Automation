'use client';

import React from 'react';
import { Search, Sparkles, Command, ShieldCheck, Zap, Activity } from 'lucide-react';

export function Header() {
  return (
    <header className="h-14 border-b border-[#152E36] bg-[#071317]/95 backdrop-blur-lg px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4">
        {/* Command shortcut indicator */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-[#0D1E24] border border-[#1A3A44] text-xs text-slate-300">
          <Search className="w-3.5 h-3.5 text-[#02A0A0]" />
          <span className="text-slate-400">Global Client Search</span>
          <kbd className="text-[10px] bg-[#071317] px-1.5 py-0.5 rounded border border-[#1A3A44] font-mono text-[#FFBD65]">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#0D1E24] border border-[#1A3A44] text-xs text-slate-300">
          <Activity className="w-3.5 h-3.5 text-[#02A0A0] animate-pulse" />
          <span className="text-slate-300 font-medium">Pipeline:</span>
          <span className="text-[#FFBD65] font-mono font-bold">PostgreSQL + SSE</span>
        </div>

        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#02A0A0] to-[#FFBD65] flex items-center justify-center font-bold text-xs text-[#071317] shadow-sm">
          OF
        </div>
      </div>
    </header>
  );
}
