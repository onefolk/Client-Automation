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
  Layers,
  Flame,
} from 'lucide-react';

const primaryNav = [
  { name: 'Live Discovery', href: '/discover', icon: Compass, badge: 'Live', badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  { name: 'Client History', href: '/clientHistory', icon: History, badge: 'Saved', badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  { name: 'Client Directory', href: '/businesses', icon: Building2 },
  { name: 'Opportunity Matrix', href: '/opportunities', icon: Sparkles },
  { name: 'Search Sessions', href: '/searches', icon: Layers },
  { name: 'Platform Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#0B0D13] border-r border-white/[0.07] flex flex-col h-screen sticky top-0 shrink-0 select-none z-40">
      {/* Brand Header */}
      <div className="p-4.5 border-b border-white/[0.07]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-600/20 text-white font-bold text-xs">
              OF
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-white font-sans">ONEFOLK</span>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-white/[0.06] text-zinc-400 border border-white/[0.08]">
                  v2.4
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-medium tracking-tight">Agency Intelligence</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-2.5 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 pt-1 flex items-center justify-between text-[10px] font-bold tracking-wider text-zinc-500 uppercase font-mono">
          <span>Workspaces</span>
          <span className="text-[9px] text-blue-400 font-mono bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/20">PRO</span>
        </div>

        {primaryNav.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/discover' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <item.icon className={`w-4 h-4 transition-colors ${isActive ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'}`} />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold border ${
                    isActive ? 'bg-white/20 text-white border-white/20' : item.badgeColor
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* System Status Card */}
      <div className="p-3 m-3 rounded-xl bg-[#0E1118] border border-white/[0.06]">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
            <span className="text-xs font-semibold text-zinc-200">Live Ingestion</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold">
            99.9%
          </span>
        </div>
        <p className="text-[11px] text-zinc-400 leading-normal font-sans">
          Real-time OpenStreetMap & live HTTP domain crawlers active.
        </p>
      </div>
    </aside>
  );
}
