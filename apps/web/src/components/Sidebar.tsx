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
    <aside className="w-64 bg-[#0A191F] border-r border-[#152E36] flex flex-col h-screen sticky top-0 shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-6 border-b border-[#152E36] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#02A0A0] to-[#FFBD65] flex items-center justify-center shadow-lg shadow-[#02A0A0]/25">
            <Radar className="w-5 h-5 text-[#071317] font-bold" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wider text-white flex items-center gap-1.5">
              ONEFOLK
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#FFBD65]/15 text-[#FFBD65] border border-[#FFBD65]/30">
                PRO
              </span>
            </h1>
            <p className="text-[11px] text-[#02A0A0] font-medium">Client Intelligence</p>
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
                  ? 'bg-gradient-to-r from-[#02A0A0] to-[#028383] text-[#071317] font-bold shadow-md shadow-[#02A0A0]/30'
                  : 'text-slate-300 hover:text-white hover:bg-[#122931]'
              }`}
            >
              <item.icon className={`w-4 h-4 ${isActive ? 'text-[#071317]' : 'text-[#02A0A0]'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Pipeline Status Indicator */}
      <div className="p-4 mx-4 mb-4 rounded-xl bg-[#0D1E24] border border-[#1A3A44] text-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-300 font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#02A0A0] animate-ping" />
            Live Ingestion Active
          </span>
          <span className="text-[10px] font-mono text-[#FFBD65] bg-[#FFBD65]/10 px-1.5 py-0.5 rounded border border-[#FFBD65]/20 font-bold">
            SSE READY
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          PostgreSQL Master + Redis Streams Real-time pipeline.
        </p>
      </div>
    </aside>
  );
}
