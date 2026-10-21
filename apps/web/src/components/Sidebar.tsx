'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Compass,
  History,
  Building2,
  Sparkles,
  Search,
  Settings,
  ShieldCheck,
  Zap,
  GraduationCap,
} from 'lucide-react';

const navigation = [
  { name: 'Institutional Leads', href: '/', icon: GraduationCap },
  { name: 'Live Discovery', href: '/discover', icon: Compass },
  { name: 'Client History', href: '/clientHistory', icon: History },
  { name: 'Client Directory', href: '/businesses', icon: Building2 },
  { name: 'Opportunity Matrix', href: '/opportunities', icon: Zap },
  { name: 'Search Sessions', href: '/searches', icon: Search },
  { name: 'System Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-[#0c0c0e] border-r border-white/[0.08] flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none">
      <div>
        {/* Brand Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-white/[0.08]">
          <Link href="/discover" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-zinc-800 border border-white/[0.12] flex items-center justify-center font-bold text-xs text-white">
              OF
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-tight text-white uppercase">OneFolk</span>
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-zinc-800/80 text-zinc-400 border border-white/[0.06]">
                  v2.4
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 font-medium leading-none">Intelligence Engine</p>
            </div>
          </Link>
        </div>

        {/* Navigation Group */}
        <div className="p-3 space-y-1">
          <div className="px-2 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            Workspace
          </div>

          <nav className="space-y-0.5">
            {navigation.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-zinc-800 text-white shadow-sm border border-white/[0.08]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent'
                  }`}
                >
                  <item.icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-zinc-100' : 'text-zinc-500 group-hover:text-zinc-300'
                    }`}
                    strokeWidth={1.75}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer Status */}
      <div className="p-3 border-t border-white/[0.08]">
        <div className="px-2 py-2 rounded-md bg-zinc-900/60 border border-white/[0.06] flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-zinc-400 font-medium">Pipeline Active</span>
          </div>
          <span className="text-zinc-600 font-mono text-[10px]">SSE Live</span>
        </div>
      </div>
    </aside>
  );
}
