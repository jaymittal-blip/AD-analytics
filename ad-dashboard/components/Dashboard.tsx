"use client";

import { useState, useMemo } from "react";
import { AdGroups, TabId, Ad } from "@/lib/types";
import { THRESHOLDS, breakdownByField, groupAds } from "@/lib/analyzer";
import { fmtINR } from "@/lib/format";
import AdTable from "./AdTable";
import FilterBar, { Filters, DEFAULT_FILTERS } from "./FilterBar";
import SpendChart from "./charts/SpendChart";
import DonutChart from "./charts/DonutChart";
import OverallCard from "./charts/OverallCard";

const TABS: { id: TabId; label: string }[] = [
  { id: "kill",    label: "Kill List" },
  { id: "scale",   label: "Scale"     },
  { id: "monitor", label: "Monitor"   },
  { id: "testing", label: "Testing"   },
  { id: "ended",   label: "Ended"     },
  { id: "all",     label: "All Ads"   },
];

const CRITERIA: Record<TabId, React.ReactNode> = {
  kill: (
    <>
      <strong>Kill criteria (active ads):</strong> ROAS &lt;{" "}
      <span className="text-primary-container font-bold">{THRESHOLDS.ROAS_KILL}x</span> AND (running ≥{" "}
      <span className="text-primary-container font-bold">{THRESHOLDS.MIN_DAYS} days</span> OR spent ≥{" "}
      <span className="text-primary-container font-bold">{fmtINR(THRESHOLDS.MIN_SPEND)}</span>). These ads have
      burned through enough time or money and are still losing.
    </>
  ),
  scale: (
    <>
      <strong>Scale criteria:</strong> ROAS ≥{" "}
      <span className="text-secondary font-bold">{THRESHOLDS.ROAS_SCALE}x</span> AND spent ≥{" "}
      <span className="text-secondary font-bold">{fmtINR(THRESHOLDS.MIN_SPEND_SCALE)}</span> AND Active.
      Proven performers — increase budget to capture more revenue.
    </>
  ),
  monitor: (
    <>
      <strong>Monitor:</strong> Active, proven (≥{THRESHOLDS.MIN_DAYS} days or ≥{fmtINR(THRESHOLDS.MIN_SPEND)}{" "}
      spend), ROAS between{" "}
      <span className="text-tertiary font-bold">{THRESHOLDS.ROAS_KILL}x – {THRESHOLDS.ROAS_SCALE}x</span>.
      Not bad enough to kill, not strong enough to scale yet.
    </>
  ),
  testing: (
    <>
      <strong>Still testing — no action yet:</strong> Active ads with less than{" "}
      <span className="text-on-surface font-bold">{THRESHOLDS.MIN_DAYS} days</span> AND less than{" "}
      <span className="text-on-surface font-bold">{fmtINR(THRESHOLDS.MIN_SPEND)}</span> spent.
      Too early to judge — let these run to the decision threshold.
    </>
  ),
  ended: (
    <>
      Historical reference only — these ads are completed or paused.{" "}
      <strong>ENDED_WIN</strong> = high-ROAS winner (replicate the creative).{" "}
      <strong>ENDED_LOSS</strong> = proven loser (avoid similar creatives).{" "}
      <strong>ENDED_OK</strong> = neutral.
    </>
  ),
  all: <>All ads across all categories. Use filters and search to explore.</>
};

const TABLE_HEADING: Record<TabId, string> = {
  kill:    "Stop these {n} ads immediately",
  scale:   "Increase budget on these {n} ads",
  monitor: "{n} ads to watch",
  testing: "{n} ads in early testing",
  ended:   "{n} ended ads",
  all:     "All {n} ads",
};

interface DashboardProps {
  groups:    AdGroups;
  fetchedAt: string;
}

function applyFilters(ads: Ad[], filters: Filters): Ad[] {
  return ads.filter(ad => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const match =
        ad.ad_id.toLowerCase().includes(q) ||
        ad.platform.toLowerCase().includes(q) ||
        ad.brand.toLowerCase().includes(q) ||
        ad.creative_theme.toLowerCase().includes(q) ||
        ad.target_audience.toLowerCase().includes(q) ||
        ad.status.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filters.platform && ad.platform !== filters.platform)   return false;
    if (filters.brand    && ad.brand    !== filters.brand)       return false;
    if (filters.theme    && ad.creative_theme !== filters.theme) return false;

    // Date: include ad if its running period overlaps with the selected range.
    // Ad ran from start_date to start_date + days_running.
    if (filters.dateFrom || filters.dateTo) {
      const adStart = new Date(ad.start_date);
      const adEnd   = new Date(ad.start_date);
      adEnd.setDate(adEnd.getDate() + (ad.days_running ?? 0));

      if (filters.dateTo   && adStart > new Date(filters.dateTo))   return false;
      if (filters.dateFrom && adEnd   < new Date(filters.dateFrom)) return false;
    }

    return true;
  });
}

export default function Dashboard({ groups, fetchedAt }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>("kill");
  const [filters,   setFilters]   = useState<Filters>(DEFAULT_FILTERS);

  // Unique filter option lists (from full dataset)
  const platforms = useMemo(() => [...new Set(groups.all.map(a => a.platform))].sort(), [groups.all]);
  const brands    = useMemo(() => [...new Set(groups.all.map(a => a.brand))].sort(),    [groups.all]);
  const themes    = useMemo(() => [...new Set(groups.all.map(a => a.creative_theme))].sort(), [groups.all]);

  // Latest start_date in the dataset — date presets are relative to this, not today
  const maxDate = useMemo(() => {
    const dates = groups.all.map(a => new Date(a.start_date).getTime()).filter(t => !isNaN(t));
    return dates.length > 0 ? new Date(Math.max(...dates)) : new Date();
  }, [groups.all]);

  // Apply filters then re-group
  const filteredAll    = useMemo(() => applyFilters(groups.all, filters), [groups.all, filters]);
  const filteredGroups = useMemo(() => groupAds(filteredAll),             [filteredAll]);
  const tabAds         = filteredGroups[activeTab];

  // Chart data for active tab
  const byPlatform  = useMemo(() => breakdownByField(tabAds, "platform"),      [tabAds]);
  const byBrand     = useMemo(() => breakdownByField(tabAds, "brand"),          [tabAds]);
  const byNarrative = useMemo(() => breakdownByField(tabAds, "creative_theme"), [tabAds]);

  // PDF export via browser print
  function exportPdf() {
    const prev = document.title;
    document.title = `${activeTab}_report`;
    window.print();
    document.title = prev;
  }

  // CSV export of current tab
  function exportCsv() {
    const headers: (keyof Ad)[] = [
      "ad_id", "_class", "platform", "brand", "creative_theme",
      "target_audience", "status", "days_running", "spend", "roas", "ctr", "revenue",
    ];
    const rows = tabAds.map(a => headers.map(h => String(a[h] ?? "")).join(","));
    const csv  = [headers.join(","), ...rows].join("\n");
    const url  = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href     = url;
    link.download = `${activeTab}_list.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const currentTab  = TABS.find(t => t.id === activeTab)!;
  const tableHeader = TABLE_HEADING[activeTab].replace("{n}", String(tabAds.length));
  const fetchedDate = new Date(fetchedAt).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });

  return (
    <>
      {/* ── Top App Bar ── */}
      <header className="flex items-center gap-4 h-16 px-6 bg-surface border-b border-outline-variant/30 shrink-0 no-print">
        <div>
          <h2 className="text-base font-extrabold text-on-surface leading-tight">Ad Performance Intelligence</h2>
          <p className="text-[10px] text-on-surface-variant">{groups.all.length} ads · {fetchedDate}</p>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-md ml-auto relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
          <input
            className="w-full bg-surface-container-low border border-outline-variant hover:border-outline focus:border-primary focus:ring-1 focus:ring-primary/30 rounded-lg pl-10 pr-4 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none transition-all"
            placeholder="Search Ad ID, theme, platform…"
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          />
        </div>

        <button
          onClick={exportPdf}
          className="shrink-0 bg-secondary text-on-secondary text-[11px] font-bold px-5 py-2 rounded-lg hover:opacity-90 active:scale-95 transition-all"
        >
          Export Report
        </button>
      </header>

      {/* ── Scrollable Body ── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-hide">

        {/* Sub-tabs */}
        <nav className="flex items-center gap-0.5 border-b border-outline-variant/30 pb-px no-print">
          {TABS.map(({ id, label }) => {
            const count  = filteredGroups[id].length;
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => { setActiveTab(id); }}
                className={`relative px-5 py-2.5 text-sm transition-colors whitespace-nowrap ${
                  active
                    ? "font-bold text-primary border-b-2 border-primary -mb-px"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {label}{" "}
                <span className={`text-xs ml-0.5 ${active ? "opacity-60" : "opacity-40"}`}>{count}</span>
              </button>
            );
          })}
        </nav>

        {/* Filters */}
        <FilterBar
          filters={filters}
          platforms={platforms}
          brands={brands}
          themes={themes}
          maxDate={maxDate}
          onChange={setFilters}
        />

        {/* 4 Charts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <SpendChart title="Spend by Platform"  rows={byPlatform}  barColor="#ff5451" />
          <SpendChart title="Spend by Brand"     rows={byBrand}     barColor="#4d8eff" />
          <DonutChart title="Spend by Narrative" rows={byNarrative} />
          <OverallCard ads={tabAds} label={currentTab.label} />
        </div>

        {/* Criteria banner */}
        <div className="bg-on-primary-container/15 border border-primary-container/25 px-5 py-3 rounded-xl flex items-start gap-3">
          <span
            className="material-symbols-outlined text-primary-container text-[20px] mt-0.5 shrink-0"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            error
          </span>
          <p className="text-sm text-on-surface leading-relaxed">{CRITERIA[activeTab]}</p>
        </div>

        {/* Table card */}
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl overflow-hidden">
          <div className="flex justify-between items-center px-6 py-4 border-b border-surface-variant">
            <h3 className="text-base font-semibold text-on-surface">{tableHeader}</h3>
            <div className="flex items-center gap-3 no-print">
              <span className="text-[11px] text-on-surface-variant hidden sm:block">
                Sorted by spend · highest first
              </span>
              <button
                onClick={exportCsv}
                className="flex items-center gap-1.5 text-[11px] text-on-surface-variant border border-outline-variant px-3 py-1.5 rounded-lg hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Export {currentTab.label} List
              </button>
            </div>
          </div>
          <AdTable ads={tabAds} emptyMessage={`No ads in this category.`} />
        </div>

        <div className="h-4" />
      </div>
    </>
  );
}
