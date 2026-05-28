"use client";

import { useState, useMemo, useEffect } from "react";
import { Ad } from "@/lib/types";
import { TabId } from "@/lib/types";
import { fmtINR, fmtRoas, fmtPct, fmtNumber } from "@/lib/format";
import { THRESHOLDS } from "@/lib/analyzer";
import { useSettings } from "@/contexts/SettingsProvider";
import Badge from "./Badge";
import {
  getScaleSuggestion, getOutlook,
  SCALE_SUGGESTION_INFO, OUTLOOK_INFO,
  ScaleSuggestion, OutlookResult,
} from "@/lib/suggestions";
import {
  setRevisit, getRevisits, markVisited, clearRevisit,
  DEMO_AD_ID, DEMO_REVISIT_MS, RevisitEntry, isEntryOverdue,
} from "@/lib/revisitStore";
import {
  ArrowDown, ArrowUp, ChevronsUpDown,
  Info, CheckCircle2, AlertTriangle,
  TrendingUp, TrendingDown, HelpCircle,
  Columns, ChevronLeft, ChevronRight,
  StopCircle, TrendingUp as ScaleIcon, X, Loader2, AlertCircle, ExternalLink, FlaskConical,
} from "lucide-react";

// Live countdown cell — only this component ticks every second for demo entries
function RevisitCountdown({ entry }: { entry: RevisitEntry }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!entry.isDemoMode) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [entry.isDemoMode]);

  const remaining = entry.scaledAt + entry.revisitMs - now;
  if (remaining <= 0) {
    return (
      <span className="text-[10px] text-error font-semibold animate-pulse">Revisit overdue!</span>
    );
  }
  if (entry.isDemoMode) {
    const secs = Math.ceil(remaining / 1000);
    return (
      <span className="text-[10px] text-tertiary font-mono font-semibold">
        Revisit in {secs}s · demo
      </span>
    );
  }
  const days = Math.ceil(remaining / 86_400_000);
  return <span className="text-[10px] text-on-surface-variant/70">Revisit in {days}d</span>;
}

type SortKey =
  | "spend" | "roas" | "days_running" | "revenue" | "ctr"
  | "impressions" | "clicks" | "conversions" | "cpc" | "cpa"
  | "creative_score" | "landing_page_score" | "frequency" | "video_completion_rate"
  | "suggestion";

type SortDir = "asc" | "desc";

const PAGE_SIZE = 15;

const ALL_COLUMNS = [
  { key: "ad_id",                 label: "AD ID",               align: "left",  sortKey: null                    },
  { key: "_class",                label: "Action",              align: "left",  sortKey: null                    },
  { key: "platform",              label: "Platform",            align: "left",  sortKey: null                    },
  { key: "brand",                 label: "Brand",               align: "left",  sortKey: null                    },
  { key: "category",              label: "Category",            align: "left",  sortKey: null                    },
  { key: "ad_type",               label: "Ad Type",             align: "left",  sortKey: null                    },
  { key: "target_audience",       label: "Audience",            align: "left",  sortKey: null                    },
  { key: "creative_theme",        label: "Creative Theme",      align: "left",  sortKey: null                    },
  { key: "status",                label: "Status",              align: "left",  sortKey: null                    },
  { key: "start_date",            label: "Start Date",          align: "left",  sortKey: null                    },
  { key: "days_running",          label: "Days",                align: "right", sortKey: "days_running"          },
  { key: "spend",                 label: "Spend",               align: "right", sortKey: "spend"                 },
  { key: "revenue",               label: "Revenue",             align: "right", sortKey: "revenue"               },
  { key: "roas",                  label: "ROAS",                align: "right", sortKey: "roas"                  },
  { key: "impressions",           label: "Impressions",         align: "right", sortKey: "impressions"           },
  { key: "clicks",                label: "Clicks",              align: "right", sortKey: "clicks"                },
  { key: "ctr",                   label: "CTR",                 align: "right", sortKey: "ctr"                   },
  { key: "conversions",           label: "Conversions",         align: "right", sortKey: "conversions"           },
  { key: "cpc",                   label: "CPC",                 align: "right", sortKey: "cpc"                   },
  { key: "cpa",                   label: "CPA",                 align: "right", sortKey: "cpa"                   },
  { key: "creative_score",        label: "Creative Score",      align: "right", sortKey: "creative_score"        },
  { key: "landing_page_score",    label: "LP Score",            align: "right", sortKey: "landing_page_score"    },
  { key: "frequency",             label: "Frequency",           align: "right", sortKey: "frequency"             },
  { key: "video_completion_rate", label: "Video CR",            align: "right", sortKey: "video_completion_rate" },
  { key: "product_name",          label: "Product",             align: "left",  sortKey: null                    },
  { key: "landing_page",          label: "Landing Page",        align: "left",  sortKey: null                    },
] as const;

type ColKey = (typeof ALL_COLUMNS)[number]["key"];

const ALWAYS_ON = new Set<ColKey>(["ad_id", "_class"]);

interface Props {
  ads:          Ad[];
  allAds?:      Ad[];
  tab?:         TabId;
  emptyMessage?: string;
  onAdKilled?:  (adId: string) => void;
}

const CONFIDENCE_DOT: Record<string, string> = {
  high:   "bg-secondary",
  medium: "bg-tertiary",
  low:    "bg-outline/60",
};

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group align-middle ml-1">
      <Info size={12} strokeWidth={1.75} className="text-on-surface-variant/50 cursor-help" />
      <span className="pointer-events-none absolute top-full left-0 mt-1 w-64 rounded-xl bg-surface-bright border border-outline-variant shadow-float p-3 text-[11px] text-on-surface-variant leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-normal font-normal normal-case tracking-normal">
        {text}
      </span>
    </span>
  );
}

function SuggestionTooltip({ reasons, warnings }: { reasons: string[]; warnings: string[] }) {
  if (!reasons.length && !warnings.length) return null;
  return (
    <span className="pointer-events-none absolute top-0 right-full mr-2 w-72 rounded-xl bg-surface-bright border border-outline-variant shadow-float p-3 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
      {reasons.map((r, i) => (
        <p key={i} className="flex items-start gap-1.5 text-[11px] text-secondary mb-1">
          <CheckCircle2 size={12} strokeWidth={1.75} className="shrink-0 mt-px" />{r}
        </p>
      ))}
      {warnings.map((w, i) => (
        <p key={i} className="flex items-start gap-1.5 text-[11px] text-tertiary mb-1">
          <AlertTriangle size={12} strokeWidth={1.75} className="shrink-0 mt-px" />{w}
        </p>
      ))}
    </span>
  );
}

type ActionModal =
  | { type: "kill";        ad: Ad }
  | { type: "scale";       ad: Ad; suggestion: ScaleSuggestion }
  | { type: "next-action"; ad: Ad }
  | null;

export default function AdTable({ ads, allAds = [], tab, emptyMessage = "No ads in this category.", onAdKilled }: Props) {
  const { settings } = useSettings();
  const [sortKey,  setSortKey]  = useState<SortKey>("spend");
  const [sortDir,  setSortDir]  = useState<SortDir>("desc");
  const [page,     setPage]     = useState(1);
  const [colsOpen, setColsOpen] = useState(false);
  const [visible,  setVisible]  = useState<Set<ColKey>>(
    () => new Set(settings.visibleColumns as ColKey[])
  );
  const [modal,          setModal]          = useState<ActionModal>(null);
  const [actionMsg,      setActionMsg]      = useState<{ ok: boolean; text: string } | null>(null);
  const [acting,         setActing]         = useState(false);
  const [scaleInput,     setScaleInput]     = useState("");
  const [demoCountdown,  setDemoCountdown]  = useState<number | null>(null);
  const [revisitEntries, setRevisitEntries] = useState<RevisitEntry[]>([]);

  useMemo(() => {
    setVisible(new Set(settings.visibleColumns as ColKey[]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.visibleColumns.join(",")]);

  // Keep revisit entries in sync with localStorage
  useEffect(() => {
    function sync() { setRevisitEntries(getRevisits()); }
    sync();
    window.addEventListener("revisit-updated", sync);
    return () => window.removeEventListener("revisit-updated", sync);
  }, []);

  // Demo countdown ticker
  useEffect(() => {
    if (demoCountdown === null || demoCountdown <= 0) return;
    const id = setTimeout(() => setDemoCountdown(c => c! - 1), 1000);
    return () => clearTimeout(id);
  }, [demoCountdown]);

  // Ticker so the Action column detects when a countdown goes overdue
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const hasPending = revisitEntries.some(e => !e.visited);
    if (!hasPending) return;
    const id = setInterval(() => setNow(Date.now()), 2_000);
    return () => clearInterval(id);
  }, [revisitEntries]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
    setPage(1);
  }

  function toggleCol(key: ColKey) {
    if (ALWAYS_ON.has(key)) return;
    setVisible(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const showSuggestion = tab === "scale" || tab === "monitor" || tab === "testing";
  const showActions    = tab === "kill" || tab === "scale" || tab === "monitor" || tab === "testing";

  function openKill(ad: Ad) { setModal({ type: "kill", ad }); setActionMsg(null); }
  function openScale(ad: Ad) {
    // Scale tab has ScaleSuggestion in the map; monitor/testing have OutlookResult — compute on the fly
    const mapped = suggestionMap.get(ad.ad_id);
    const sg: ScaleSuggestion =
      mapped && "increaseRange" in mapped
        ? (mapped as ScaleSuggestion)
        : getScaleSuggestion(ad, allAds, settings.criteria);
    const mid = Math.round(
      (parseInt(sg.increaseRange.match(/\+(\d+)/)?.[1] ?? "10") +
       parseInt(sg.increaseRange.match(/–(\d+)/)?.[1] ?? "20")) / 2
    );
    setScaleInput(String(mid));
    setModal({ type: "scale", ad, suggestion: sg });
    setActionMsg(null);
  }
  function closeModal() { setModal(null); setActionMsg(null); setActing(false); setDemoCountdown(null); }

  async function handlePause() {
    if (!modal || modal.type !== "kill") return;
    setActing(true); setActionMsg(null);
    try {
      const r    = await fetch("/api/meta/ad/pause", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ad_id: modal.ad.ad_id }) });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setActionMsg({ ok: true, text: `Ad ${modal.ad.ad_id} paused in Meta Ads.` });
    } catch (err) { setActionMsg({ ok: false, text: String(err) }); }
    finally { setActing(false); }
  }

  async function handleScale() {
    if (!modal || modal.type !== "scale") return;
    const pct = Number(scaleInput);
    if (!pct || pct <= 0) { setActionMsg({ ok: false, text: "Enter a valid increase percentage." }); return; }

    // Demo bypass — AD-0072 skips the real API entirely
    if (modal.ad.ad_id === DEMO_AD_ID) {
      setRevisit(modal.ad.ad_id, modal.ad.creative_theme, DEMO_REVISIT_MS, true);
      setDemoCountdown(30);
      setActionMsg({ ok: true, text: `Simulated scale +${pct}% applied.` });
      return;
    }

    setActing(true); setActionMsg(null);
    try {
      const r    = await fetch("/api/meta/ad/scale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ad_id: modal.ad.ad_id, increase_pct: pct }) });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setRevisit(modal.ad.ad_id, modal.ad.creative_theme, modal.suggestion.revisitDays * 86_400_000, false);
      setActionMsg({ ok: true, text: `Budget scaled +${pct}% on Ad Set "${data.adset_name}". Revisit in ${modal.suggestion.revisitDays} days.` });
    } catch (err) { setActionMsg({ ok: false, text: String(err) }); }
    finally { setActing(false); }
  }

  async function handleNextActionKill() {
    if (!modal || modal.type !== "next-action") return;
    const ad = modal.ad;
    setActing(true); setActionMsg(null);
    try {
      // Pause on Meta (skip API call for demo ad)
      if (ad.ad_id !== DEMO_AD_ID) {
        const r    = await fetch("/api/meta/ad/pause", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ad_id: ad.ad_id }) });
        const data = await r.json();
        if (data.error) throw new Error(data.error);
      }
      // Save ENDED override to DB
      await fetch("/api/ads/status-overrides", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ad_id: ad.ad_id, status: "ENDED" }) });
      // Clear revisit entry from localStorage
      clearRevisit(ad.ad_id);
      // Notify Dashboard to reclassify immediately
      onAdKilled?.(ad.ad_id);
      closeModal();
    } catch (err) {
      setActionMsg({ ok: false, text: String(err) });
    } finally { setActing(false); }
  }

  function handleNextActionScaleAgain() {
    if (!modal || modal.type !== "next-action") return;
    const ad = modal.ad;
    // Clear the old overdue entry so countdown resets after new scale
    clearRevisit(ad.ad_id);
    setModal(null);
    setActionMsg(null);
    // Open the scale modal
    openScale(ad);
  }

  const suggestionMap = useMemo(() => {
    if (!showSuggestion) return new Map<string, ScaleSuggestion | OutlookResult>();
    const map = new Map<string, ScaleSuggestion | OutlookResult>();
    for (const ad of ads) {
      map.set(
        ad.ad_id,
        tab === "scale"
          ? getScaleSuggestion(ad, allAds, settings.criteria)
          : getOutlook(ad, allAds, settings.criteria),
      );
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ads, allAds, tab, settings.criteria]);

  const sorted = useMemo(() => {
    return [...ads].sort((a, b) => {
      if (sortKey === "suggestion") {
        const sa = suggestionMap.get(a.ad_id);
        const sb = suggestionMap.get(b.ad_id);
        const va = sa && "increaseRange" in sa
          ? parseInt((sa.increaseRange.match(/\+(\d+)/) ?? ["0","0"])[1])
          : sa ? (sa as OutlookResult).verdict === "LIKELY_SCALE" ? 2 : (sa as OutlookResult).verdict === "UNCERTAIN" ? 1 : 0
          : 0;
        const vb = sb && "increaseRange" in sb
          ? parseInt((sb.increaseRange.match(/\+(\d+)/) ?? ["0","0"])[1])
          : sb ? (sb as OutlookResult).verdict === "LIKELY_SCALE" ? 2 : (sb as OutlookResult).verdict === "UNCERTAIN" ? 1 : 0
          : 0;
        return sortDir === "desc" ? vb - va : va - vb;
      }
      const av = ((a as unknown as Record<string, unknown>)[sortKey] as number) ?? 0;
      const bv = ((b as unknown as Record<string, unknown>)[sortKey] as number) ?? 0;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [ads, sortKey, sortDir, suggestionMap]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageAds    = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showCols   = ALL_COLUMNS.filter(c => visible.has(c.key));

  function roasColor(roas: number) {
    if (roas < THRESHOLDS.ROAS_KILL)   return "text-error font-bold";
    if (roas >= THRESHOLDS.ROAS_SCALE) return "text-secondary font-bold";
    return "text-on-surface";
  }

  function renderCell(ad: Ad, key: ColKey) {
    switch (key) {
      case "ad_id":
        return <span className="font-mono text-[11px] text-on-surface-variant whitespace-nowrap">{ad.ad_id}</span>;
      case "_class":
        return <Badge cls={ad._class} />;
      case "platform":
        return <span className="text-sm font-medium">{ad.platform}</span>;
      case "brand":
        return <span className="text-sm font-medium">{ad.brand}</span>;
      case "category":
        return <span className="text-sm text-on-surface-variant">{ad.category}</span>;
      case "ad_type":
        return <span className="text-sm text-on-surface-variant">{ad.ad_type}</span>;
      case "target_audience":
        return <span className="text-sm text-on-surface-variant whitespace-nowrap">{ad.target_audience}</span>;
      case "creative_theme":
        return <span className="text-sm italic text-on-surface-variant truncate max-w-[150px] block" title={ad.creative_theme}>{ad.creative_theme}</span>;
      case "status":
        return <span className="text-xs text-on-surface-variant whitespace-nowrap">{ad.status}</span>;
      case "start_date":
        return <span className="font-mono text-[11px] text-on-surface-variant whitespace-nowrap">{ad.start_date}</span>;
      case "days_running":
        return <span className="font-mono text-sm">{ad.days_running}</span>;
      case "spend":
        return <span className="font-mono text-sm font-semibold">{fmtINR(ad.spend)}</span>;
      case "revenue":
        return <span className="font-mono text-sm text-on-surface-variant">{fmtINR(ad.revenue)}</span>;
      case "roas":
        return <span className={`font-mono text-sm ${roasColor(ad.roas)}`}>{fmtRoas(ad.roas)}</span>;
      case "impressions":
        return <span className="font-mono text-sm text-on-surface-variant">{fmtNumber(ad.impressions)}</span>;
      case "clicks":
        return <span className="font-mono text-sm text-on-surface-variant">{fmtNumber(ad.clicks)}</span>;
      case "ctr":
        return <span className="font-mono text-sm text-on-surface-variant">{fmtPct(ad.ctr)}</span>;
      case "conversions":
        return <span className="font-mono text-sm text-on-surface-variant">{fmtNumber(ad.conversions)}</span>;
      case "cpc":
        return <span className="font-mono text-sm text-on-surface-variant">{fmtINR(ad.cpc)}</span>;
      case "cpa":
        return <span className="font-mono text-sm text-on-surface-variant">{fmtINR(ad.cpa)}</span>;
      case "creative_score":
        return <span className="font-mono text-sm text-on-surface-variant">{ad.creative_score?.toFixed(1) ?? "—"}</span>;
      case "landing_page_score":
        return <span className="font-mono text-sm text-on-surface-variant">{ad.landing_page_score?.toFixed(1) ?? "—"}</span>;
      case "frequency":
        return <span className="font-mono text-sm text-on-surface-variant">{ad.frequency?.toFixed(2) ?? "—"}</span>;
      case "video_completion_rate":
        return <span className="font-mono text-sm text-on-surface-variant">{ad.video_completion_rate != null ? fmtPct(ad.video_completion_rate) : "—"}</span>;
      case "product_name":
        return <span className="text-sm text-on-surface-variant">{ad.product_name ?? "—"}</span>;
      case "landing_page":
        return ad.landing_page
          ? <a href={ad.landing_page} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline underline-offset-2 truncate max-w-[180px] block" title={ad.landing_page}>{ad.landing_page.replace(/^https?:\/\//, "")}</a>
          : <span className="text-sm text-on-surface-variant">—</span>;
    }
  }

  function SortIcon({ colSortKey }: { colSortKey: string }) {
    if (sortKey === colSortKey) {
      return sortDir === "desc"
        ? <ArrowDown size={11} strokeWidth={2} className="inline ml-0.5 align-middle text-primary" />
        : <ArrowUp   size={11} strokeWidth={2} className="inline ml-0.5 align-middle text-primary" />;
    }
    return <ChevronsUpDown size={11} strokeWidth={1.75} className="inline ml-0.5 align-middle text-on-surface-variant/40" />;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container text-on-surface-variant text-[11px] uppercase tracking-wider">
              {showCols.map(col => (
                <th
                  key={col.key}
                  className={`px-5 py-3 font-semibold whitespace-nowrap ${col.align === "right" ? "text-right" : ""} ${col.sortKey ? "cursor-pointer hover:text-on-surface select-none" : ""}`}
                  onClick={col.sortKey ? () => toggleSort(col.sortKey as SortKey) : undefined}
                >
                  {col.label}
                  {col.sortKey && <SortIcon colSortKey={col.sortKey} />}
                </th>
              ))}
              {showSuggestion && (
                <th
                  className="px-5 py-3 font-semibold whitespace-nowrap text-left cursor-pointer hover:text-on-surface select-none"
                  onClick={() => toggleSort("suggestion")}
                >
                  <span className="inline-flex items-center gap-0.5">
                    {tab === "scale" ? "Scale Suggestion" : "Outlook"}
                    <SortIcon colSortKey="suggestion" />
                  </span>
                  <InfoTooltip text={tab === "scale" ? SCALE_SUGGESTION_INFO : OUTLOOK_INFO} />
                </th>
              )}
              {showActions && (
                <th className="px-5 py-3 font-semibold whitespace-nowrap text-left">Action</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40">
            {pageAds.length === 0 ? (
              <tr>
                <td colSpan={showCols.length + (showSuggestion ? 1 : 0)} className="text-center text-on-surface-variant py-14 text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : pageAds.map((ad, idx) => (
              <tr key={ad.ad_id} className={`transition-colors hover:bg-surface-container-low ${idx % 2 === 0 ? "" : "bg-surface-container-lowest/50"}`}>
                {showCols.map(col => (
                  <td
                    key={col.key}
                    className={`px-5 py-3 ${col.align === "right" ? "text-right" : ""}`}
                  >
                    {renderCell(ad, col.key)}
                  </td>
                ))}
                {showSuggestion && (() => {
                  const s = suggestionMap.get(ad.ad_id);
                  if (!s) return <td className="px-5 py-3" />;
                  if (tab === "scale") {
                    const sg = s as ScaleSuggestion;
                    const revisitEntry = revisitEntries.find(e => e.adId === ad.ad_id && !e.dismissed);
                    return (
                      <td className="px-5 py-3">
                        <div className="relative group inline-flex flex-col gap-0.5 cursor-default">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-secondary">{sg.increaseRange}</span>
                            <span className="text-[11px] text-on-surface-variant">{sg.metric}</span>
                            <span className={`w-2 h-2 rounded-full shrink-0 ${CONFIDENCE_DOT[sg.confidence]}`} title={`${sg.confidence} confidence`} />
                          </div>
                          {revisitEntry
                            ? <RevisitCountdown entry={revisitEntry} />
                            : <span className="text-[10px] text-on-surface-variant/70">Revisit in {sg.revisitDays} days</span>
                          }
                          <SuggestionTooltip reasons={sg.reasons} warnings={sg.warnings} />
                        </div>
                      </td>
                    );
                  }
                  const ol = s as OutlookResult;
                  const verdictCfg = ol.verdict === "LIKELY_SCALE"
                    ? { label: "Likely Scale", Icon: TrendingUp,   cls: "text-secondary" }
                    : ol.verdict === "LIKELY_KILL"
                    ? { label: "Likely Kill",  Icon: TrendingDown, cls: "text-error" }
                    : { label: "Uncertain",    Icon: HelpCircle,   cls: "text-on-surface-variant" };
                  return (
                    <td className="px-5 py-3">
                      <div className="relative group inline-flex flex-col gap-0.5 cursor-default">
                        <div className="flex items-center gap-1.5">
                          <verdictCfg.Icon size={15} strokeWidth={1.75} className={verdictCfg.cls} />
                          <span className={`text-sm font-semibold ${verdictCfg.cls}`}>{verdictCfg.label}</span>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${CONFIDENCE_DOT[ol.confidence]}`} title={`${ol.confidence} confidence`} />
                        </div>
                        <SuggestionTooltip reasons={ol.reasons} warnings={ol.warnings} />
                      </div>
                    </td>
                  );
                })()}
                {showActions && (() => {
                  const entry      = revisitEntries.find(e => e.adId === ad.ad_id);
                  const isOverdue  = entry && !entry.visited && isEntryOverdue(entry, now);
                  const isVisited  = entry?.visited;

                  return (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {(tab === "kill" || tab === "monitor" || tab === "testing") && (
                          <button onClick={() => openKill(ad)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-error/10 border border-error/20 text-error text-[11px] font-semibold rounded-lg hover:bg-error/20 transition-colors whitespace-nowrap">
                            <StopCircle size={12} strokeWidth={2} />
                            Pause
                          </button>
                        )}
                        {tab === "scale" && (
                          isVisited ? (
                            <button onClick={() => { setModal({ type: "next-action", ad }); setActionMsg(null); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary text-[11px] font-semibold rounded-lg hover:bg-primary/20 transition-colors whitespace-nowrap">
                              <ScaleIcon size={12} strokeWidth={2} />
                              Next Action
                            </button>
                          ) : isOverdue ? (
                            <button onClick={() => markVisited(ad.ad_id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-tertiary/10 border border-tertiary/30 text-tertiary text-[11px] font-semibold rounded-lg hover:bg-tertiary/20 transition-colors whitespace-nowrap animate-pulse">
                              <CheckCircle2 size={12} strokeWidth={2} />
                              Visited
                            </button>
                          ) : (
                            <button onClick={() => openScale(ad)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/10 border border-secondary/20 text-secondary text-[11px] font-semibold rounded-lg hover:bg-secondary/20 transition-colors whitespace-nowrap">
                              <ScaleIcon size={12} strokeWidth={2} />
                              Scale
                            </button>
                          )
                        )}
                        {(tab === "monitor" || tab === "testing") && (
                          <button onClick={() => openScale(ad)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/10 border border-secondary/20 text-secondary text-[11px] font-semibold rounded-lg hover:bg-secondary/20 transition-colors whitespace-nowrap">
                            <ScaleIcon size={12} strokeWidth={2} />
                            Scale
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })()}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-outline-variant bg-surface-container-low flex items-center justify-between flex-wrap gap-2">
        <span className="text-[11px] text-on-surface-variant">
          {sorted.length === 0
            ? "0 ads"
            : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, sorted.length)} of ${sorted.length} ads`}
        </span>

        <div className="flex items-center gap-2 no-print">
          {/* Column toggle */}
          <div className="relative">
            <button
              onClick={() => setColsOpen(!colsOpen)}
              className="flex items-center gap-1.5 text-[11px] text-on-surface-variant border border-outline-variant px-2.5 py-1.5 rounded-lg hover:bg-surface-container transition-colors"
            >
              <Columns size={13} strokeWidth={1.75} />
              Columns
            </button>
            {colsOpen && (
              <div className="absolute bottom-full right-0 mb-1 z-50 bg-surface-bright border border-outline-variant rounded-xl shadow-float p-3 min-w-[200px] max-h-[340px] overflow-y-auto">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-2 px-1">Toggle Columns</p>
                {ALL_COLUMNS.map(col => (
                  <label
                    key={col.key}
                    className={`flex items-center gap-2 px-1 py-1 rounded-lg ${ALWAYS_ON.has(col.key) ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-surface-container"}`}
                  >
                    <input
                      type="checkbox"
                      checked={visible.has(col.key)}
                      onChange={() => toggleCol(col.key)}
                      className="accent-primary"
                      disabled={ALWAYS_ON.has(col.key)}
                    />
                    <span className="text-sm text-on-surface">{col.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="p-1.5 border border-outline-variant rounded-lg hover:bg-surface-container disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={15} strokeWidth={1.75} />
          </button>
          <span className="text-[11px] text-on-surface-variant px-1">{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="p-1.5 border border-outline-variant rounded-lg hover:bg-surface-container disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={15} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* ── Action Modals ─────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-float w-full max-w-md mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>

            {/* Kill modal */}
            {modal.type === "kill" && (
              <>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center shrink-0">
                      <StopCircle size={16} strokeWidth={1.75} className="text-error" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-on-surface">Pause Ad in Meta</h3>
                      <p className="text-[11px] text-on-surface-variant font-mono">{modal.ad.ad_id}</p>
                    </div>
                  </div>
                  <button onClick={closeModal} className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"><X size={16} /></button>
                </div>
                <div className="bg-error/5 border border-error/20 rounded-xl px-4 py-3 text-[12px] text-on-surface-variant space-y-1">
                  <p><strong className="text-on-surface">Ad:</strong> {modal.ad.creative_theme} · {modal.ad.platform}</p>
                  <p><strong className="text-on-surface">Spend to date:</strong> ₹{(modal.ad.spend ?? 0).toLocaleString("en-IN")}</p>
                  <p><strong className="text-on-surface">ROAS:</strong> {modal.ad.roas?.toFixed(1)}x — below kill threshold</p>
                </div>
                <p className="text-[12px] text-on-surface-variant">This will set the ad status to <strong>PAUSED</strong> via Meta Ads API. The action is reversible from your Meta Ads Manager.</p>
                {actionMsg && (
                  <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border text-[12px] ${actionMsg.ok ? "bg-secondary-container/50 border-secondary/30 text-on-secondary-container" : "bg-error-container/30 border-error/20 text-error"}`}>
                    {actionMsg.ok ? <CheckCircle2 size={13} strokeWidth={1.75} className="mt-0.5 shrink-0" /> : <AlertCircle size={13} strokeWidth={1.75} className="mt-0.5 shrink-0" />}
                    <span>{actionMsg.text}
                      {!actionMsg.ok && actionMsg.text.includes("not connected") && (
                        <a href="/new-ad" className="ml-1 underline font-semibold inline-flex items-center gap-0.5">Connect now <ExternalLink size={10} /></a>
                      )}
                    </span>
                  </div>
                )}
                {!actionMsg?.ok && (
                  <div className="flex gap-2 justify-end">
                    <button onClick={closeModal} className="px-4 py-2 text-sm text-on-surface-variant border border-outline-variant rounded-xl hover:bg-surface-container transition-colors">Cancel</button>
                    <button onClick={handlePause} disabled={acting}
                      className="flex items-center gap-2 px-5 py-2 bg-error text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-all">
                      {acting ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : <StopCircle size={14} strokeWidth={2} />}
                      {acting ? "Pausing…" : "Pause Ad"}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Scale modal */}
            {modal.type === "scale" && (
              <>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                      <ScaleIcon size={16} strokeWidth={1.75} className="text-secondary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-on-surface">Scale Daily Budget</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-[11px] text-on-surface-variant font-mono">{modal.ad.ad_id}</p>
                        {modal.ad.ad_id === DEMO_AD_ID && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-tertiary/10 text-tertiary border border-tertiary/20 px-1.5 py-0.5 rounded-full font-semibold">
                            <FlaskConical size={9} strokeWidth={2} />
                            Demo · Countdown = 30 sec
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={closeModal} className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"><X size={16} /></button>
                </div>
                <div className="bg-secondary/5 border border-secondary/20 rounded-xl px-4 py-3 text-[12px] text-on-surface-variant space-y-1">
                  <p><strong className="text-on-surface">Ad:</strong> {modal.ad.creative_theme} · {modal.ad.platform}</p>
                  <p><strong className="text-on-surface">ROAS:</strong> {modal.ad.roas?.toFixed(1)}x · <strong className="text-on-surface">Days running:</strong> {modal.ad.days_running}</p>
                  <p><strong className="text-on-surface">Suggested:</strong> <span className="text-secondary font-semibold">{modal.suggestion.increaseRange} {modal.suggestion.metric}</span> · Revisit in {modal.suggestion.revisitDays} days</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Increase Daily Budget by (%)</label>
                  <div className="flex gap-2">
                    <input type="number" min="1" max="200" value={scaleInput} onChange={e => setScaleInput(e.target.value)}
                      className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-sm font-mono text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none" />
                    <span className="flex items-center text-sm text-on-surface-variant font-semibold px-2">%</span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap mt-1">
                    {[5, 10, 15, 20, 30, 50].map(v => (
                      <button key={v} onClick={() => setScaleInput(String(v))}
                        className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${scaleInput === String(v) ? "bg-secondary-container border-secondary text-on-secondary-container" : "border-outline-variant text-on-surface-variant hover:border-secondary/50"}`}>
                        +{v}%
                      </button>
                    ))}
                  </div>
                </div>
                {actionMsg && (
                  <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border text-[12px] ${actionMsg.ok ? "bg-secondary-container/50 border-secondary/30 text-on-secondary-container" : "bg-error-container/30 border-error/20 text-error"}`}>
                    {actionMsg.ok ? <CheckCircle2 size={13} strokeWidth={1.75} className="mt-0.5 shrink-0" /> : <AlertCircle size={13} strokeWidth={1.75} className="mt-0.5 shrink-0" />}
                    <div className="flex-1">
                      <span>{actionMsg.text}</span>
                      {actionMsg.ok && demoCountdown !== null && (
                        <div className="mt-1.5 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-bold text-sm ${demoCountdown > 0 ? "text-secondary" : "text-error animate-pulse"}`}>
                              {demoCountdown > 0 ? `Revisit in ${demoCountdown}s` : "Revisit overdue!"}
                            </span>
                          </div>
                          <p className="text-[10px] text-on-surface-variant/70 italic">
                            Demo mode — Meta API bypassed · for testing purposes only
                          </p>
                        </div>
                      )}
                      {!actionMsg.ok && actionMsg.text.includes("not connected") && (
                        <a href="/new-ad" className="ml-1 underline font-semibold inline-flex items-center gap-0.5">Connect now <ExternalLink size={10} /></a>
                      )}
                    </div>
                  </div>
                )}
                {!actionMsg?.ok && (
                  <div className="flex gap-2 justify-end">
                    <button onClick={closeModal} className="px-4 py-2 text-sm text-on-surface-variant border border-outline-variant rounded-xl hover:bg-surface-container transition-colors">Cancel</button>
                    <button onClick={handleScale} disabled={acting || !scaleInput}
                      className="flex items-center gap-2 px-5 py-2 bg-secondary text-on-secondary text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-all">
                      {acting ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : <ScaleIcon size={14} strokeWidth={2} />}
                      {acting ? "Applying…" : `Apply +${scaleInput}%`}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Next Action modal */}
            {modal.type === "next-action" && (
              <>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <ScaleIcon size={16} strokeWidth={1.75} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-on-surface">Next Action</h3>
                      <p className="text-[11px] text-on-surface-variant font-mono">{modal.ad.ad_id}</p>
                    </div>
                  </div>
                  <button onClick={closeModal} className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"><X size={16} /></button>
                </div>

                <div className="bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-[12px] text-on-surface-variant space-y-1">
                  <p><strong className="text-on-surface">Ad:</strong> {modal.ad.creative_theme} · {modal.ad.platform}</p>
                  <p><strong className="text-on-surface">ROAS:</strong> {modal.ad.roas?.toFixed(1)}x · <strong className="text-on-surface">Days running:</strong> {modal.ad.days_running}</p>
                </div>

                <p className="text-[12px] text-on-surface-variant">
                  You've revisited this ad. What would you like to do next?
                </p>

                {actionMsg && (
                  <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border text-[12px] ${actionMsg.ok ? "bg-secondary-container/50 border-secondary/30 text-on-secondary-container" : "bg-error-container/30 border-error/20 text-error"}`}>
                    {actionMsg.ok ? <CheckCircle2 size={13} strokeWidth={1.75} className="mt-0.5 shrink-0" /> : <AlertCircle size={13} strokeWidth={1.75} className="mt-0.5 shrink-0" />}
                    <span>{actionMsg.text}
                      {!actionMsg.ok && actionMsg.text.includes("not connected") && (
                        <a href="/new-ad" className="ml-1 underline font-semibold inline-flex items-center gap-0.5">Connect now <ExternalLink size={10} /></a>
                      )}
                    </span>
                  </div>
                )}

                {!actionMsg?.ok && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={handleNextActionKill} disabled={acting}
                        className="flex flex-col items-center gap-1.5 px-4 py-4 bg-error/5 border border-error/20 text-error rounded-xl hover:bg-error/10 disabled:opacity-50 transition-all">
                        {acting
                          ? <Loader2 size={20} strokeWidth={1.75} className="animate-spin" />
                          : <StopCircle size={20} strokeWidth={1.75} />}
                        <span className="text-sm font-bold">Kill Ad</span>
                        <span className="text-[10px] text-center text-on-surface-variant leading-tight">Pause on Meta + move to Ended</span>
                      </button>
                      <button onClick={handleNextActionScaleAgain} disabled={acting}
                        className="flex flex-col items-center gap-1.5 px-4 py-4 bg-secondary/5 border border-secondary/20 text-secondary rounded-xl hover:bg-secondary/10 disabled:opacity-50 transition-all">
                        <ScaleIcon size={20} strokeWidth={1.75} />
                        <span className="text-sm font-bold">Scale Again</span>
                        <span className="text-[10px] text-center text-on-surface-variant leading-tight">Reset timer + scale budget again</span>
                      </button>
                    </div>
                    <button
                      onClick={() => { clearRevisit(modal.ad.ad_id); closeModal(); }}
                      className="w-full text-center text-[11px] text-on-surface-variant/60 hover:text-on-surface-variant transition-colors pt-1"
                    >
                      Cancel revisit — reset to Scale
                    </button>
                  </>
                )}
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
