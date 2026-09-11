'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Search, Activity, Database } from 'lucide-react';

const titleMap: Record<string, { title: string; category: string }> = {
  '/': { title: 'Live Client Discovery', category: 'Intelligence' },
  '/discover': { title: 'Live Client Discovery', category: 'Intelligence' },
  '/clientHistory': { title: 'Client History', category: 'Discovery Audit' },
  '/businesses': { title: 'Client Directory', category: 'Master Database' },
  '/opportunities': { title: 'Opportunity Matrix', category: 'Value Vectors' },
  '/searches': { title: 'Search Sessions', category: 'Execution Logs' },
  '/settings': { title: 'System Settings', category: 'Engine Config' },
};

export function Header() {
  const pathname = usePathname();

  // Handle dynamic routes like /businesses/[id]
  let current = titleMap[pathname];
  if (!current && pathname.startsWith('/businesses/')) {
    current = { title: 'Client Intelligence Profile', category: 'Deep Audit' };
  } else if (!current) {
    current = { title: 'Intelligence Suite', category: 'Workspace' };
  }

  return (
    <header className="h-14 border-b border-white/[0.08] bg-[#09090b]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40 select-none">
      {/* Breadcrumb Info */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-zinc-500 font-medium">{current.category}</span>
        <span className="text-zinc-700">/</span>
        <span className="font-semibold text-zinc-200">{current.title}</span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-white/[0.08] text-[11px] text-zinc-400 font-mono">
          <Database className="w-3 h-3 text-zinc-500" />
          <span>PostgreSQL + Redis</span>
        </div>
      </div>
    </header>
  );
}
