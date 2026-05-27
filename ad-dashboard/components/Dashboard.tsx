"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { TabId, Ad } from "@/lib/types";
import { breakdownByField, groupAds } from "@/lib/analyzer";
import { classifyWithCriteria, CriteriaMap, Rule, NUMERIC_RULE_KEYS } from "@/lib/settings";
import { fmtINR } from "@/lib/format";
import { useSettings } from "@/contexts/SettingsProvider";
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

const RULE_COL_LABEL: Record<string, string> = {
  ad_id: "Ad ID", platform: "Platform", brand: "Brand", category: "Category",
  ad_type: "Ad Type", target_audience: "Audience", creative_theme: "Creative Theme",
  status: "Status", start_date: "Start Date", days_running: "Days Running",
  spend: "Spend", revenue: "Revenue", roas: "ROAS", impressions: "Impressions",
  clicks: "Clicks", ctr: "CTR", conversions: "Conversions", cpc: "CPC", cpa: "CPA",
  creative_score: "Creative Score", landing_page_score: "Landing Page Score",
  frequency: "Frequency", video_completion_rate: "Video Completion Rate",
};

function fmtRuleVal(column: string, value: Rule["value"]): string {
  if (typeof value === "string") return `"${value}"`;
  if (column === "spend" || column === "revenue" || column === "cpc" || column === "cpa") return fmtINR(value);
  if (column === "roas") return `${value}x`;
  if (column === "ctr" || column === "video_completion_rate") return `${value}%`;
  if (column === "days_running") return `${value} days`;
  return String(value);
}

const CRITERIA_HEADER: Partial<Record<TabId, string>> = {
  kill:    "Kill criteria (active ads):",
  scale:   "Scale criteria:",
  monitor: "Monitor criteria:",
  testing: "Testing criteria:",
};

function CriteriaBanner({ tab, criteria }: { tab: TabId; criteria: CriteriaMap }) {
  if (tab === "ended") return (
    <>Historical reference only — completed or paused ads.{" "}
    <strong>ENDED_WIN</strong> = high-ROAS winner. <strong>ENDED_LOSS</strong> = proven loser.{" "}
    <strong>ENDED_OK</strong> = neutral.</>
  );
  if (tab === "all") return <>All ads across all categories. Use filters and search to explore.</>;

  const rules = criteria[tab as keyof CriteriaMap] ?? [];
  if (rules.length === 0) return <span>No criteria defined for <strong>{tab}</strong> — ads won&apos;t be classified here.</span>;

  return (
    <>
      <strong>{CRITERIA_HEADER[tab]}</strong>{" "}
      {rules.map((rule, i) => (
        <span key={rule.id}>
          {i > 0 && <span className="font-semibold text-primary"> {rule.logic} </span>}
          {RULE_COL_LABEL[rule.column] ?? rule.column}{" "}
          <span className="font-mono">{rule.operator}</span>{" "}
          <span className={`font-bold ${NUMERIC_RULE_KEYS.has(rule.column) ? "text-primary-container" : "text-tertiary"}`}>
            {fmtRuleVal(rule.column, rule.value)}
          </span>
        </span>
      ))}
    </>
  );
}

const TABLE_HEADING: Record<TabId, string> = {
  kill:    "Stop these {n} ads immediately",
  scale:   "Increase budget on these {n} ads",
  monitor: "{n} ads to watch",
  testing: "{n} ads in early testing",
  ended:   "{n} ended ads",
  all:     "All {n} ads",
};

interface DashboardProps {
  rawAds:    Ad[];
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

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

export default function Dashboard({ rawAds: initialAds, fetchedAt: initialFetchedAt }: DashboardProps) {
  const { settings } = useSettings();
  const [activeTab,  setActiveTab]  = useState<TabId>("kill");
  const [filters,    setFilters]    = useState<Filters>(DEFAULT_FILTERS);
  const [syncBadge,  setSyncBadge]  = useState<string | null>(null);
  // Local ads state so we can update in-place without a full route refresh
  const [liveAds,    setLiveAds]    = useState<Ad[]>(initialAds);
  const [fetchedAt,  setFetchedAt]  = useState(initialFetchedAt);

  const fetchFreshAds = useCallback(async () => {
    try {
      const res  = await fetch("/api/ads");
      const data = await res.json() as { ads: Ad[]; fetchedAt: string };
      if (Array.isArray(data.ads)) {
        setLiveAds(data.ads);
        setFetchedAt(data.fetchedAt);
      }
    } catch { /* silent */ }
  }, []);

  const pollAutoSync = useCallback(async () => {
    try {
      const res  = await fetch("/api/sheets/auto-sync");
      const data = await res.json() as { synced: boolean; added?: number; updated?: number; total?: number };
      if (data.synced) {
        await fetchFreshAds();
        const added   = data.added   ?? 0;
        const updated = data.updated ?? 0;
        if (added + updated > 0) {
          setSyncBadge(`Sheet synced — ${added} added, ${updated} updated`);
          setTimeout(() => setSyncBadge(null), 6000);
        }
      }
    } catch { /* silent */ }
  }, [fetchFreshAds]);

  useEffect(() => {
    // Poll immediately on mount (picks up any changes since page last loaded)
    pollAutoSync();
    const id = setInterval(pollAutoSync, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [pollAutoSync]);

  const ads = useMemo(() =>
    liveAds.map(ad => ({ ...ad, _class: classifyWithCriteria(ad, settings.criteria) })) as Ad[]
  , [liveAds, settings.criteria]);

  // Unique filter options
  const platforms = useMemo(() => [...new Set(ads.map(a => a.platform))].sort(), [ads]);
  const brands    = useMemo(() => [...new Set(ads.map(a => a.brand))].sort(),    [ads]);
  const themes    = useMemo(() => [...new Set(ads.map(a => a.creative_theme))].sort(), [ads]);

  // Latest start_date in dataset — presets anchor here
  const maxDate = useMemo(() => {
    const dates = ads.map(a => new Date(a.start_date).getTime()).filter(t => !isNaN(t));
    return dates.length > 0 ? new Date(Math.max(...dates)) : new Date();
  }, [ads]);

  // Apply filters then re-group
  const filteredAll    = useMemo(() => applyFilters(ads, filters), [ads, filters]);
  const filteredGroups = useMemo(() => groupAds(filteredAll),       [filteredAll]);
  const tabAds         = filteredGroups[activeTab];

  // Charts
  const byPlatform  = useMemo(() => breakdownByField(tabAds, "platform"),       [tabAds]);
  const byBrand     = useMemo(() => breakdownByField(tabAds, "brand"),           [tabAds]);
  const byNarrative = useMemo(() => breakdownByField(tabAds, "creative_theme"),  [tabAds]);

  function exportPdf() {
    const prev = document.title;
    document.title = `${activeTab}_report`;
    window.print();
    document.title = prev;
  }

  function exportCsv() {
    const headers: (keyof Ad)[] = [
      "ad_id", "_class", "platform", "brand", "creative_theme",
      "target_audience", "status", "days_running", "spend", "roas", "ctr", "revenue",
    ];
    const rows = tabAds.map(a => headers.map(h => String(a[h] ?? "")).join(","));
    const csv  = [headers.join(","), ...rows].join("\n");
    const url  = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url; link.download = `${activeTab}_list.csv`; link.click();
    URL.revokeObjectURL(url);
  }

  const currentTab  = TABS.find(t => t.id === activeTab)!;
  const tableHeader = TABLE_HEADING[activeTab].replace("{n}", String(tabAds.length));
  const fetchedDate = new Date(fetchedAt).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });

  return (
    <>
      {/* Top App Bar */}
      <header className="flex items-center gap-4 h-16 px-6 bg-surface border-b border-outline-variant/30 shrink-0 no-print">
        <div>
          <h2 className="text-base font-extrabold text-on-surface leading-tight">Ad Performance Intelligence</h2>
          <p className="text-[10px] text-on-surface-variant">{ads.length} ads · {fetchedDate}</p>
        </div>
        {syncBadge && (
          <div className="flex items-center gap-1.5 text-[11px] text-primary bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5 animate-fade-in">
            <span className="material-symbols-outlined text-[14px]">sync</span>
            {syncBadge}
          </div>
        )}
        <div className="flex-1 max-w-md ml-auto relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
          <input
            className="w-full bg-surface-container-low border border-outline-variant hover:border-outline focus:border-primary focus:ring-1 focus:ring-primary/30 rounded-lg pl-10 pr-4 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none transition-all"
            placeholder="Search Ad ID, theme, platform…"
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          />
        </div>
        <button onClick={exportPdf} className="shrink-0 bg-secondary text-on-secondary text-[11px] font-bold px-5 py-2 rounded-lg hover:opacity-90 active:scale-95 transition-all">
          Export Report
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-hide">
        {/* Sub-tabs */}
        <nav className="flex items-center gap-0.5 border-b border-outline-variant/30 pb-px no-print">
          {TABS.map(({ id, label }) => {
            const count  = filteredGroups[id].length;
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`relative px-5 py-2.5 text-sm transition-colors whitespace-nowrap ${
                  active ? "font-bold text-primary border-b-2 border-primary -mb-px" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {label} <span className={`text-xs ml-0.5 ${active ? "opacity-60" : "opacity-40"}`}>{count}</span>
              </button>
            );
          })}
        </nav>

        {/* Filters */}
        <FilterBar filters={filters} platforms={platforms} brands={brands} themes={themes} maxDate={maxDate} onChange={setFilters} />

        {/* 4 Charts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <SpendChart title="Spend by Platform"  rows={byPlatform}  barColor="#ff5451" />
          <SpendChart title="Spend by Brand"     rows={byBrand}     barColor="#4d8eff" />
          <DonutChart title="Spend by Narrative" rows={byNarrative} />
          <OverallCard ads={tabAds} label={currentTab.label} />
        </div>

        {/* Criteria banner */}
        <div className="bg-on-primary-container/15 border border-primary-container/25 px-5 py-3 rounded-xl flex items-start gap-3">
          <span className="material-symbols-outlined text-primary-container text-[20px] mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
          <p className="text-sm text-on-surface leading-relaxed">
            <CriteriaBanner tab={activeTab} criteria={settings.criteria} />
          </p>
        </div>

        {/* Table */}
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl overflow-hidden">
          <div className="flex justify-between items-center px-6 py-4 border-b border-surface-variant">
            <h3 className="text-base font-semibold text-on-surface">{tableHeader}</h3>
            <div className="flex items-center gap-3 no-print">
              <span className="text-[11px] text-on-surface-variant hidden sm:block">Sorted by spend · highest first</span>
              <button onClick={exportCsv} className="flex items-center gap-1.5 text-[11px] text-on-surface-variant border border-outline-variant px-3 py-1.5 rounded-lg hover:bg-surface-container-high transition-colors">
                <span className="material-symbols-outlined text-[16px]">download</span>
                Export {currentTab.label} List
              </button>
            </div>
          </div>
          <AdTable ads={tabAds} emptyMessage="No ads in this category." />
        </div>

        <div className="h-4" />
      </div>
    </>
  );
}
