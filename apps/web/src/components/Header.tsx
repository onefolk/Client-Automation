'use client';

import React from 'react';
import { Search, Activity, Sparkles } from 'lucide-react';
import Link from 'next/link';

export function Header() {
  return (
    <header className="h-14 border-b border-white/[0.07] bg-[#090A0F]/80 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      <div className="flex items-center gap-4">
        {/* Command shortcut indicator */}
        <Link
          href="/discover"
          className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-xs text-zinc-300 transition-colors cursor-pointer group"
        >
          <Search className="w-3.5 h-3.5 text-zinc-400 group-hover:text-blue-400 transition-colors" />
          <span className="text-zinc-400 group-hover:text-zinc-200">Universal Client Search</span>
          <kbd className="text-[10px] bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/[0.1] font-mono text-zinc-400">
            ⌘K
          </kbd>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.07] text-xs">
          <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span className="text-zinc-400 font-medium">Pipeline:</span>
          <span className="text-zinc-200 font-mono font-semibold">PostgreSQL + SSE</span>
        </div>

        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow-sm shadow-blue-600/20">
          OF
        </div>
      </div>
    </header>
  );
}
