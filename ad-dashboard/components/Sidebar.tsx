"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, Settings, Plus, Leaf } from "lucide-react";

const NAV = [
  { href: "/",         Icon: BarChart2, label: "Analytics"  },
  { href: "/settings", Icon: Settings,  label: "Settings"   },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <aside className="w-60 shrink-0 flex flex-col h-full bg-surface-container-lowest border-r border-outline-variant no-print">
      {/* Brand */}
      <div className="px-5 py-6 border-b border-outline-variant/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Leaf size={16} color="#FFFFFF" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-on-surface tracking-tight leading-tight">Ad Intel</h1>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest leading-tight">Little Joys</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, Icon, label }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                active
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.25 : 1.75} />
              <span className="text-sm">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* New Analysis + user */}
      <div className="px-3 pb-6 mt-auto space-y-4">
        <Link
          href="/new-ad"
          className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary text-sm font-semibold py-2.5 rounded-xl hover:bg-primary-container transition-colors"
        >
          <Plus size={16} strokeWidth={2.5} />
          New Analysis
        </Link>

        <div className="flex items-center gap-3 px-2 pt-4 border-t border-outline-variant/50">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
            MB
          </div>
          <div className="overflow-hidden">
            <p className="text-[11px] font-semibold truncate text-on-surface">Media Buyer</p>
            <p className="text-[10px] text-on-surface-variant truncate">Performance Lead</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
