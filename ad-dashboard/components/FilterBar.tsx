"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown, X } from "lucide-react";

export interface Filters {
  search:     string;
  dateFrom:   string;
  dateTo:     string;
  datePreset: string;
  platform:   string;
  brand:      string;
  theme:      string;
}

export const DEFAULT_FILTERS: Filters = {
  search: "", dateFrom: "", dateTo: "", datePreset: "All Time",
  platform: "", brand: "", theme: "",
};

const PRESETS = [
  { label: "All Time",     days: 0  },
  { label: "Last 7 Days",  days: 7  },
  { label: "Last 14 Days", days: 14 },
  { label: "Last 30 Days", days: 30 },
  { label: "Last 90 Days", days: 90 },
  { label: "Custom Range", days: -1 },
];

function isoDate(d: Date) { return d.toISOString().split("T")[0]; }

interface DropdownProps {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  containerRef: React.RefObject<HTMLDivElement>;
  showCalendar?: boolean;
}

function Dropdown({ label, open, onToggle, children, containerRef, showCalendar }: DropdownProps) {
  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 bg-surface-container-lowest border border-outline-variant px-3 py-1.5 rounded-lg text-sm text-on-surface cursor-pointer hover:border-outline transition-colors select-none"
      >
        {showCalendar && <Calendar size={14} strokeWidth={1.75} className="text-on-surface-variant" />}
        <span className="max-w-[140px] truncate">{label}</span>
        <ChevronDown size={14} strokeWidth={1.75} className="text-on-surface-variant" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-surface-bright border border-outline-variant rounded-xl shadow-float min-w-[180px]">
          {children}
        </div>
      )}
    </div>
  );
}

interface Props {
  filters:   Filters;
  platforms: string[];
  brands:    string[];
  themes:    string[];
  maxDate:   Date;
  onChange:  (f: Filters) => void;
}

export default function FilterBar({ filters, platforms, brands, themes, maxDate, onChange }: Props) {
  const [dateOpen,     setDateOpen]     = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);
  const [brandOpen,    setBrandOpen]    = useState(false);
  const [themeOpen,    setThemeOpen]    = useState(false);

  const dateRef     = useRef<HTMLDivElement>(null!);
  const platformRef = useRef<HTMLDivElement>(null!);
  const brandRef    = useRef<HTMLDivElement>(null!);
  const themeRef    = useRef<HTMLDivElement>(null!);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dateRef.current     && !dateRef.current.contains(e.target as Node))     setDateOpen(false);
      if (platformRef.current && !platformRef.current.contains(e.target as Node)) setPlatformOpen(false);
      if (brandRef.current    && !brandRef.current.contains(e.target as Node))    setBrandOpen(false);
      if (themeRef.current    && !themeRef.current.contains(e.target as Node))    setThemeOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function applyPreset(days: number, label: string) {
    if (days === 0) {
      onChange({ ...filters, dateFrom: "", dateTo: "", datePreset: "All Time" });
      setDateOpen(false);
    } else if (days > 0) {
      const to   = new Date(maxDate);
      const from = new Date(maxDate);
      from.setDate(from.getDate() - days);
      onChange({ ...filters, dateFrom: isoDate(from), dateTo: isoDate(to), datePreset: label });
      setDateOpen(false);
    } else {
      onChange({ ...filters, datePreset: "Custom Range" });
    }
  }

  const hasFilter = !!(filters.platform || filters.brand || filters.theme || filters.dateFrom);

  function clear() {
    onChange({ ...DEFAULT_FILTERS, search: filters.search });
  }

  const optionCls = (active: boolean) =>
    `w-full text-left px-4 py-2 text-sm transition-colors ${
      active ? "text-primary font-semibold bg-primary/5" : "text-on-surface hover:bg-surface-container"
    }`;

  return (
    <div className="flex flex-wrap gap-2 items-center px-3 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl">

      {/* Date */}
      <Dropdown
        label={filters.datePreset || "All Time"}
        open={dateOpen}
        onToggle={() => setDateOpen(!dateOpen)}
        containerRef={dateRef}
        showCalendar
      >
        <div className="py-1">
          {PRESETS.map(({ label, days }) => (
            <button key={label} onClick={() => applyPreset(days, label)} className={optionCls(filters.datePreset === label)}>
              {label}
            </button>
          ))}
        </div>
        {filters.datePreset === "Custom Range" && (
          <div className="border-t border-outline-variant px-3 py-3 space-y-2">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-on-surface-variant block mb-1">From</label>
              <input type="date" value={filters.dateFrom} onChange={e => onChange({ ...filters, dateFrom: e.target.value })}
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-2 py-1 text-sm text-on-surface focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-on-surface-variant block mb-1">To</label>
              <input type="date" value={filters.dateTo} onChange={e => onChange({ ...filters, dateTo: e.target.value })}
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-2 py-1 text-sm text-on-surface focus:outline-none focus:border-primary" />
            </div>
            <button onClick={() => setDateOpen(false)}
              className="w-full py-1.5 bg-primary text-on-primary text-xs font-bold rounded-lg">
              Apply
            </button>
          </div>
        )}
      </Dropdown>

      {/* Platform */}
      <Dropdown label={filters.platform || "All Platforms"} open={platformOpen} onToggle={() => setPlatformOpen(!platformOpen)} containerRef={platformRef}>
        <div className="py-1">
          {["", ...platforms].map((p) => (
            <button key={p || "__all__"} onClick={() => { onChange({ ...filters, platform: p }); setPlatformOpen(false); }} className={optionCls(filters.platform === p)}>
              {p || "All Platforms"}
            </button>
          ))}
        </div>
      </Dropdown>

      {/* Brand */}
      <Dropdown label={filters.brand || "All Brands"} open={brandOpen} onToggle={() => setBrandOpen(!brandOpen)} containerRef={brandRef}>
        <div className="py-1 max-h-56 overflow-y-auto">
          {["", ...brands].map((b) => (
            <button key={b || "__all__"} onClick={() => { onChange({ ...filters, brand: b }); setBrandOpen(false); }} className={optionCls(filters.brand === b)}>
              {b || "All Brands"}
            </button>
          ))}
        </div>
      </Dropdown>

      {/* Theme */}
      <Dropdown label={filters.theme || "All Themes"} open={themeOpen} onToggle={() => setThemeOpen(!themeOpen)} containerRef={themeRef}>
        <div className="py-1 max-h-56 overflow-y-auto">
          {["", ...themes].map((t) => (
            <button key={t || "__all__"} onClick={() => { onChange({ ...filters, theme: t }); setThemeOpen(false); }} className={optionCls(filters.theme === t)}>
              {t || "All Themes"}
            </button>
          ))}
        </div>
      </Dropdown>

      {hasFilter && (
        <button onClick={clear} className="flex items-center gap-1 text-on-surface-variant text-[11px] font-semibold px-2 hover:text-error transition-colors">
          <X size={12} strokeWidth={2} />
          Clear
        </button>
      )}
    </div>
  );
}
