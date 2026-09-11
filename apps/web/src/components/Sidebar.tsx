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
  Radio,
  FileSpreadsheet,
  ChevronRight,
} from 'lucide-react';

const primaryNav = [
  { name: 'Live Discovery', href: '/discover', icon: Compass, count: 'Live' },
  { name: 'Client History', href: '/clientHistory', icon: History, count: 'Saved' },
  { name: 'Client Directory', href: '/businesses', icon: Building2 },
  { name: 'Opportunity Matrix', href: '/opportunities', icon: Sparkles },
  { name: 'Search Sessions', href: '/searches', icon: History },
  { name: 'Platform Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#0A191F] border-r border-[#152E36] flex flex-col h-screen sticky top-0 shrink-0 select-none z-40">
      {/* Brand Header */}
      <div className="p-5 border-b border-[#152E36]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#02A0A0] flex items-center justify-center shadow-lg shadow-[#02A0A0]/20 text-[#071317]">
              <Radar className="w-4 h-4 animate-spin-slow stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-white">ONEFOLK</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#FFBD65]/15 text-[#FFBD65] border border-[#FFBD65]/30">
                  v2.4
                </span>
              </div>
              <p className="text-[11px] text-[#02A0A0] font-medium tracking-tight">Agency Intelligence</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 pt-1 flex items-center justify-between text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          <span>Workspaces</span>
          <span className="text-[10px] text-[#02A0A0] font-mono">PRO</span>
        </div>

        {primaryNav.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/discover' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                isActive
                  ? 'bg-[#02A0A0] text-[#071317] shadow-sm font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-[#122931]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <item.icon className={`w-4 h-4 ${isActive ? 'text-[#071317]' : 'text-[#02A0A0]'}`} />
                <span>{item.name}</span>
              </div>
              {item.count && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                    isActive ? 'bg-[#071317]/20 text-[#071317]' : 'bg-[#152E36] text-[#FFBD65]'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* System Status Footprint */}
      <div className="p-3 m-3 rounded-xl bg-[#0D1E24] border border-[#1A3A44]">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-[#02A0A0] animate-pulse" />
            <span className="text-xs font-bold text-white">Live Ingestion</span>
          </div>
          <span className="text-[10px] font-mono text-[#02A0A0] bg-[#02A0A0]/10 px-1.5 py-0.5 rounded border border-[#02A0A0]/20 font-bold">
            99.9%
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-normal">
          Real-time OpenStreetMap index & live HTTP domain crawlers active.
        </p>
      </div>
    </aside>
  );
}
