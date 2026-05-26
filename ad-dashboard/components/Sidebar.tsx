"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/",         icon: "query_stats", label: "Analytics"  },
  { href: "/settings", icon: "settings",    label: "Settings"   },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <aside className="w-64 shrink-0 flex flex-col h-full bg-surface-container-lowest border-r border-outline-variant/30 no-print">
      {/* Brand */}
      <div className="px-6 py-7">
        <h1 className="text-2xl font-bold text-primary tracking-tight">Ad Intel</h1>
        <p className="text-[11px] text-on-surface-variant opacity-70 mt-0.5 uppercase tracking-wider">
          Media Buyer
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {NAV.map(({ href, icon, label }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded transition-colors ${
                active
                  ? "text-secondary font-bold bg-surface-bright/30"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-bright/20"
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">{icon}</span>
              <span className="text-sm">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* New Analysis + user */}
      <div className="px-3 pb-6 mt-auto">
        <Link
          href="/new-ad"
          className="w-full flex items-center justify-center gap-2 bg-primary-container text-on-primary-container text-sm font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          New Analysis
        </Link>

        <div className="mt-5 flex items-center gap-3 px-2 pt-5 border-t border-outline-variant/30">
          <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-xs font-bold text-on-surface-variant shrink-0">
            MB
          </div>
          <div className="overflow-hidden">
            <p className="text-[11px] font-bold truncate text-on-surface">Media Buyer</p>
            <p className="text-[10px] text-on-surface-variant truncate">Performance Lead</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
