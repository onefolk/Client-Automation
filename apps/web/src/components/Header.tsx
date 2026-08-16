'use client';

import React from 'react';
import { Search, Bell, ShieldCheck, Zap } from 'lucide-react';

export function Header() {
  return (
    <header className="h-16 border-b border-[#1E293B] bg-[#0B1120]/80 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="text-slate-300 font-medium">OneFolk</span>
          <span>/</span>
          <span className="text-indigo-400 font-semibold">Client Intelligence Engine</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0F172A] border border-[#1E293B] text-xs text-slate-300">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-slate-400">Deterministic Opportunity Engine</span>
        </div>

        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-500 flex items-center justify-center font-bold text-xs text-white shadow-md">
          OF
        </div>
      </div>
    </header>
  );
}
