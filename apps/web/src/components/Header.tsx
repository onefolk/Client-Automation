'use client';

import React from 'react';
import { ShieldCheck, Zap } from 'lucide-react';

export function Header() {
  return (
    <header className="h-16 border-b border-[#152E36] bg-[#071317]/90 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="text-slate-200 font-medium">OneFolk</span>
          <span className="text-slate-600">/</span>
          <span className="text-[#02A0A0] font-semibold">Client Intelligence Platform</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0D1E24] border border-[#1A3A44] text-xs text-slate-300">
          <Zap className="w-3.5 h-3.5 text-[#FFBD65]" />
          <span className="text-slate-300 font-medium">Deterministic Opportunity Engine</span>
        </div>

        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#02A0A0] to-[#FFBD65] flex items-center justify-center font-bold text-xs text-[#071317] shadow-md shadow-[#02A0A0]/20">
          OF
        </div>
      </div>
    </header>
  );
}
