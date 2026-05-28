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
import {
  Search, FileDown, RefreshCw, Info, Bell, X as XIcon,
} from "lucide-react";
import {
  getDueSoonEntries, getDueAdIds, dismissRevisit,
  RevisitEntry,
} from "@/lib/revisitStore";

const TABS: { id: TabId; label: string; color: string }[] = [
  { id: "kill",    label: "Kill",    color: "text-error"           },
  { id: "scale",   label: "Scale",   color: "text-secondary"       },
  { id: "monitor", label: "Monitor", color: "text-tertiary"        },
  { id: "testing", label: "Testing", color: "text-on-surface-variant" },
  { id: "ended",   label: "Ended",   color: "text-on-surface-variant" },
  { id: "all",     label: "All Ads", color: "text-on-surface"      },
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
    <strong>Ended Win</strong> = high-ROAS winner. <strong>Ended Loss</strong> = proven loser.{" "}
    <strong>Ended OK</strong> = neutral.</>
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
          <span className={`font-bold ${NUMERIC_RULE_KEYS.has(rule.column) ? "text-primary" : "text-tertiary"}`}>
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

function applyFilters(ads: Ad[], filters: Filters, revisitDueIds?: Set<string>): Ad[] {
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

    if (filters.revisitDue && revisitDueIds) {
      if (!revisitDueIds.has(ad.ad_id)) return false;
    }
    return true;
  });
}

const POLL_INTERVAL_MS = 2 * 60 * 1000;

export default function Dashboard({ rawAds: initialAds, fetchedAt: initialFetchedAt }: DashboardProps) {
  const { settings } = useSettings();
  const [activeTab,       setActiveTab]       = useState<TabId>("kill");
  const [filters,         setFilters]         = useState<Filters>(DEFAULT_FILTERS);
  const [syncBadge,       setSyncBadge]       = useState<string | null>(null);
  const [liveAds,         setLiveAds]         = useState<Ad[]>(initialAds);
  const [fetchedAt,       setFetchedAt]       = useState(initialFetchedAt);
  const [overdueEntries,  setOverdueEntries]  = useState<RevisitEntry[]>([]);
  const [revisitDueIds,   setRevisitDueIds]   = useState<Set<string>>(new Set());
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});

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
    pollAutoSync();
    const id = setInterval(pollAutoSync, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [pollAutoSync]);

  // Overdue revisit banner — re-check every 2s so demo (30s) triggers promptly
  useEffect(() => {
    function syncOverdue() { setOverdueEntries(getDueSoonEntries(0)); }
    syncOverdue();
    window.addEventListener("revisit-updated", syncOverdue);
    const id = setInterval(syncOverdue, 2_000);
    return () => { window.removeEventListener("revisit-updated", syncOverdue); clearInterval(id); };
  }, []);

  // Revisit Due filter — recompute when window setting or entries change
  useEffect(() => {
    function compute() {
      if (!filters.revisitDue) { setRevisitDueIds(new Set()); return; }
      const windowMs = parseInt(filters.revisitDue) * 86_400_000;
      setRevisitDueIds(getDueAdIds(windowMs));
    }
    compute();
    window.addEventListener("revisit-updated", compute);
    return () => window.removeEventListener("revisit-updated", compute);
  }, [filters.revisitDue]);

  // Load DB status overrides (e.g. killed ads marked as ENDED)
  useEffect(() => {
    fetch("/api/ads/status-overrides")
      .then(r => r.json())
      .then((d: { overrides: Record<string, string> }) => setStatusOverrides(d.overrides ?? {}))
      .catch(() => {});
  }, []);

  const handleAdKilled = useCallback((adId: string) => {
    setStatusOverrides(prev => ({ ...prev, [adId]: "ENDED" }));
  }, []);

  const ads = useMemo(() =>
    liveAds.map(ad => {
      if (statusOverrides[ad.ad_id] === "ENDED") {
        return { ...ad, _class: "ended" as TabId, status: "ENDED" };
      }
      return { ...ad, _class: classifyWithCriteria(ad, settings.criteria) };
    }) as Ad[]
  , [liveAds, settings.criteria, statusOverrides]);

  const platforms = useMemo(() => [...new Set(ads.map(a => a.platform))].sort(), [ads]);
  const brands    = useMemo(() => [...new Set(ads.map(a => a.brand))].sort(),    [ads]);
  const themes    = useMemo(() => [...new Set(ads.map(a => a.creative_theme))].sort(), [ads]);

  const maxDate = useMemo(() => {
    const dates = ads.map(a => new Date(a.start_date).getTime()).filter(t => !isNaN(t));
    return dates.length > 0 ? new Date(Math.max(...dates)) : new Date();
  }, [ads]);

  const filteredAll    = useMemo(() => applyFilters(ads, filters, revisitDueIds), [ads, filters, revisitDueIds]);
  const filteredGroups = useMemo(() => groupAds(filteredAll),       [filteredAll]);
  const tabAds         = filteredGroups[activeTab];

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
      <header className="flex items-center gap-4 h-16 px-6 bg-surface-container-lowest border-b border-outline-variant shrink-0 no-print">
        <div>
          <h2 className="text-sm font-extrabold text-on-surface leading-tight tracking-tight">Ad Performance</h2>
          <p className="text-[10px] text-on-surface-variant">{ads.length} ads · {fetchedDate}</p>
        </div>

        {syncBadge && (
          <div className="flex items-center gap-1.5 text-[11px] text-secondary bg-secondary-container border border-secondary/20 rounded-lg px-3 py-1.5">
            <RefreshCw size={12} strokeWidth={2} />
            {syncBadge}
          </div>
        )}

        {/* Search */}
        <div className="flex-1 max-w-sm ml-auto relative">
          <Search size={15} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            className="w-full bg-surface-container border border-outline-variant hover:border-outline focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl pl-9 pr-4 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none transition-all"
            placeholder="Search ad, theme, platform…"
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          />
        </div>

        <button onClick={exportPdf}
          className="shrink-0 flex items-center gap-1.5 bg-primary text-on-primary text-[12px] font-semibold px-4 py-2 rounded-xl hover:bg-primary-container transition-colors">
          <FileDown size={14} strokeWidth={2} />
          Export
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">

        {/* Revisit overdue banner */}
        {overdueEntries.length > 0 && (
          <div className="bg-tertiary/10 border border-tertiary/30 rounded-xl px-4 py-3 flex items-start gap-3 no-print">
            <Bell size={16} strokeWidth={1.75} className="text-tertiary mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-on-surface">
                Revisit Reminder
                <span className="ml-2 text-[11px] font-normal text-on-surface-variant">
                  {overdueEntries.length} ad{overdueEntries.length !== 1 ? "s" : ""} past their revisit date
                </span>
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {overdueEntries.map(e => (
                  <div key={e.adId} className="flex items-center gap-1.5 bg-surface-container-lowest border border-tertiary/20 rounded-lg px-2.5 py-1">
                    <span className="text-[11px] font-mono font-semibold text-on-surface">{e.adId}</span>
                    <span className="text-[11px] text-on-surface-variant truncate max-w-[120px]" title={e.adName}>{e.adName}</span>
                    {e.isDemoMode && (
                      <span className="text-[9px] bg-tertiary/10 text-tertiary border border-tertiary/20 px-1 py-px rounded-full font-semibold">demo</span>
                    )}
                    <button
                      onClick={() => dismissRevisit(e.adId)}
                      title="Remind Off"
                      className="ml-0.5 text-on-surface-variant/50 hover:text-error transition-colors"
                    >
                      <XIcon size={12} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <nav className="flex items-center gap-0.5 border-b border-outline-variant pb-px no-print">
          {TABS.map(({ id, label, color }) => {
            const count  = filteredGroups[id].length;
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`relative px-4 py-2.5 text-sm transition-colors whitespace-nowrap ${
                  active
                    ? `font-bold ${color} border-b-2 border-current -mb-px`
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {label}
                <span className={`text-xs ml-1 font-medium ${active ? "opacity-80" : "opacity-60"}`}>{count}</span>
                {id === "scale" && overdueEntries.length > 0 && (
                  <span className="absolute top-1.5 right-1 w-1.5 h-1.5 rounded-full bg-error" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Filters */}
        <FilterBar filters={filters} platforms={platforms} brands={brands} themes={themes} maxDate={maxDate} onChange={setFilters} />

        {/* Charts row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <SpendChart title="Spend by Platform"  rows={byPlatform}  barColor="#2D4032" />
          <SpendChart title="Spend by Brand"     rows={byBrand}     barColor="#4A6B50" />
          <DonutChart title="Spend by Narrative" rows={byNarrative} />
          <OverallCard ads={tabAds} label={currentTab.label} />
        </div>

        {/* Criteria banner */}
        <div className="bg-surface-container-lowest border border-outline-variant px-5 py-3 rounded-xl flex items-start gap-3">
          <Info size={16} strokeWidth={1.75} className="text-on-surface-variant mt-0.5 shrink-0" />
          <p className="text-sm text-on-surface-variant leading-relaxed">
            <CriteriaBanner tab={activeTab} criteria={settings.criteria} />
          </p>
        </div>

        {/* Table card */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-card">
          <div className="flex justify-between items-center px-6 py-4 border-b border-outline-variant">
            <h3 className="text-sm font-bold text-on-surface tracking-tight">{tableHeader}</h3>
            <div className="flex items-center gap-3 no-print">
              <span className="text-[11px] text-on-surface-variant hidden sm:block">Sorted by spend · highest first</span>
              <button onClick={exportCsv}
                className="flex items-center gap-1.5 text-[11px] text-on-surface-variant border border-outline-variant px-3 py-1.5 rounded-lg hover:bg-surface-container transition-colors">
                <FileDown size={13} strokeWidth={1.75} />
                Export {currentTab.label}
              </button>
            </div>
          </div>
          <AdTable ads={tabAds} allAds={ads} tab={activeTab} emptyMessage="No ads in this category." onAdKilled={handleAdKilled} />
        </div>

        <div className="h-4" />
      </div>
    </>
  );
}
