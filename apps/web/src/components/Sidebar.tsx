'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Compass,
  Building2,
  Sparkles,
  History,
  Settings,
  Radar,
  Activity,
  Layers,
} from 'lucide-react';

const navigation = [
  { name: 'Discover', href: '/discover', icon: Compass },
  { name: 'Businesses', href: '/businesses', icon: Building2 },
  { name: 'Opportunities', href: '/opportunities', icon: Sparkles },
  { name: 'Search History', href: '/searches', icon: History },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#0B1120] border-r border-[#1E293B] flex flex-col h-screen sticky top-0 shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-6 border-b border-[#1E293B]/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Radar className="w-5 h-5 text-white animate-pulse-subtle" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wider text-white flex items-center gap-1.5">
              ONEFOLK
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                PRO
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Client Intelligence</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
          Agency Workflow
        </div>
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/discover' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600/90 to-indigo-700 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#1E293B]/60'
              }`}
            >
              <item.icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Pipeline Status Indicator */}
      <div className="p-4 mx-4 mb-4 rounded-xl bg-[#0F172A] border border-[#1E293B] text-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-400 font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Workers Active
          </span>
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
            SSE ONLINE
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          PostgreSQL Master + Redis Streams Real-time pipeline.
        </p>
      </div>
    </aside>
  );
}
