"use client";

import { useState, useMemo } from "react";
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

type SortKey =
  | "spend" | "roas" | "days_running" | "revenue" | "ctr"
  | "impressions" | "clicks" | "conversions" | "cpc" | "cpa"
  | "creative_score" | "landing_page_score" | "frequency" | "video_completion_rate";

type SortDir = "asc" | "desc";

const PAGE_SIZE = 15;

const ALL_COLUMNS = [
  { key: "ad_id",                 label: "AD ID",                  align: "left",  sortKey: null                    },
  { key: "_class",                label: "Action",                 align: "left",  sortKey: null                    },
  { key: "platform",              label: "Platform",               align: "left",  sortKey: null                    },
  { key: "brand",                 label: "Brand",                  align: "left",  sortKey: null                    },
  { key: "category",              label: "Category",               align: "left",  sortKey: null                    },
  { key: "ad_type",               label: "Ad Type",                align: "left",  sortKey: null                    },
  { key: "target_audience",       label: "Audience",               align: "left",  sortKey: null                    },
  { key: "creative_theme",        label: "Creative Theme",         align: "left",  sortKey: null                    },
  { key: "status",                label: "Status",                 align: "left",  sortKey: null                    },
  { key: "start_date",            label: "Start Date",             align: "left",  sortKey: null                    },
  { key: "days_running",          label: "Days",                   align: "right", sortKey: "days_running"          },
  { key: "spend",                 label: "Spend",                  align: "right", sortKey: "spend"                 },
  { key: "revenue",               label: "Revenue",                align: "right", sortKey: "revenue"               },
  { key: "roas",                  label: "ROAS",                   align: "right", sortKey: "roas"                  },
  { key: "impressions",           label: "Impressions",            align: "right", sortKey: "impressions"           },
  { key: "clicks",                label: "Clicks",                 align: "right", sortKey: "clicks"                },
  { key: "ctr",                   label: "CTR",                    align: "right", sortKey: "ctr"                   },
  { key: "conversions",           label: "Conversions",            align: "right", sortKey: "conversions"           },
  { key: "cpc",                   label: "CPC",                    align: "right", sortKey: "cpc"                   },
  { key: "cpa",                   label: "CPA",                    align: "right", sortKey: "cpa"                   },
  { key: "creative_score",        label: "Creative Score",         align: "right", sortKey: "creative_score"        },
  { key: "landing_page_score",    label: "Landing Page Score",     align: "right", sortKey: "landing_page_score"    },
  { key: "frequency",             label: "Frequency",              align: "right", sortKey: "frequency"             },
  { key: "video_completion_rate", label: "Video Completion Rate",  align: "right", sortKey: "video_completion_rate" },
  { key: "product_name",          label: "Product Name",           align: "left",  sortKey: null                    },
  { key: "landing_page",          label: "Landing Page",           align: "left",  sortKey: null                    },
] as const;

type ColKey = (typeof ALL_COLUMNS)[number]["key"];

const ALWAYS_ON = new Set<ColKey>(["ad_id", "_class"]);

interface Props {
  ads: Ad[];
  allAds?: Ad[];
  tab?: TabId;
  emptyMessage?: string;
}

const CONFIDENCE_DOT: Record<string, string> = {
  high:   "bg-secondary",
  medium: "bg-primary-container",
  low:    "bg-on-surface-variant/40",
};

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group align-middle ml-1">
      <span className="material-symbols-outlined text-[13px] text-on-surface-variant/50 cursor-help leading-none">info</span>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-xl bg-surface-container-highest border border-outline-variant shadow-xl p-3 text-[11px] text-on-surface-variant leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-normal font-normal normal-case tracking-normal">
        {text}
      </span>
    </span>
  );
}

function SuggestionTooltip({ reasons, warnings }: { reasons: string[]; warnings: string[] }) {
  if (!reasons.length && !warnings.length) return null;
  return (
    <span className="pointer-events-none absolute bottom-full right-0 mb-2 w-72 rounded-xl bg-surface-container-highest border border-outline-variant shadow-xl p-3 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
      {reasons.map((r, i) => (
        <p key={i} className="flex items-start gap-1.5 text-[11px] text-secondary mb-1">
          <span className="material-symbols-outlined text-[12px] shrink-0 mt-px">check_circle</span>{r}
        </p>
      ))}
      {warnings.map((w, i) => (
        <p key={i} className="flex items-start gap-1.5 text-[11px] text-primary-container mb-1">
          <span className="material-symbols-outlined text-[12px] shrink-0 mt-px">warning</span>{w}
        </p>
      ))}
    </span>
  );
}

export default function AdTable({ ads, allAds = [], tab, emptyMessage = "No ads in this category." }: Props) {
  const { settings } = useSettings();
  const [sortKey,  setSortKey]  = useState<SortKey>("spend");
  const [sortDir,  setSortDir]  = useState<SortDir>("desc");
  const [page,     setPage]     = useState(1);
  const [colsOpen, setColsOpen] = useState(false);
  const [visible,  setVisible]  = useState<Set<ColKey>>(
    () => new Set(settings.visibleColumns as ColKey[])
  );

  // Keep visible in sync when settings change (e.g. after visiting Settings page)
  useMemo(() => {
    setVisible(new Set(settings.visibleColumns as ColKey[]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.visibleColumns.join(",")]);

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

  const sorted = useMemo(() => {
    return [...ads].sort((a, b) => {
      const av = ((a as unknown as Record<string, unknown>)[sortKey] as number) ?? 0;
      const bv = ((b as unknown as Record<string, unknown>)[sortKey] as number) ?? 0;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [ads, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageAds    = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showCols   = ALL_COLUMNS.filter(c => visible.has(c.key));

  const showSuggestion = tab === "scale" || tab === "monitor" || tab === "testing";

  // Pre-compute suggestions for all visible ads on relevant tabs
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

  function roasColor(roas: number) {
    if (roas < THRESHOLDS.ROAS_KILL)   return "text-primary-container";
    if (roas >= THRESHOLDS.ROAS_SCALE) return "text-secondary";
    return "text-on-surface";
  }

  function renderCell(ad: Ad, key: ColKey) {
    switch (key) {
      case "ad_id":
        return <span className="font-mono text-[12px] text-on-surface-variant whitespace-nowrap">{ad.ad_id}</span>;
      case "_class":
        return <Badge cls={ad._class} />;
      case "platform":
        return <span className="text-sm">{ad.platform}</span>;
      case "brand":
        return <span className="text-sm">{ad.brand}</span>;
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
        return <span className="font-mono text-[12px] text-on-surface-variant whitespace-nowrap">{ad.start_date}</span>;
      case "days_running":
        return <span className="font-mono text-sm">{ad.days_running}</span>;
      case "spend":
        return <span className="font-mono text-sm font-bold">{fmtINR(ad.spend)}</span>;
      case "revenue":
        return <span className="font-mono text-sm text-on-surface-variant">{fmtINR(ad.revenue)}</span>;
      case "roas":
        return <span className={`font-mono text-sm font-bold ${roasColor(ad.roas)}`}>{fmtRoas(ad.roas)}</span>;
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

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface-variant text-[11px] uppercase tracking-wider">
              {showCols.map(col => (
                <th
                  key={col.key}
                  className={`px-5 py-3.5 font-semibold whitespace-nowrap ${col.align === "right" ? "text-right" : ""} ${col.sortKey ? "cursor-pointer hover:text-on-surface select-none" : ""}`}
                  onClick={col.sortKey ? () => toggleSort(col.sortKey as SortKey) : undefined}
                >
                  {col.label}
                  {col.sortKey && (
                    sortKey === col.sortKey
                      ? <span className="material-symbols-outlined text-[12px] align-middle ml-0.5 text-primary">{sortDir === "desc" ? "arrow_downward" : "arrow_upward"}</span>
                      : <span className="material-symbols-outlined text-[12px] align-middle ml-0.5 text-on-surface-variant/50">unfold_more</span>
                  )}
                </th>
              ))}
              {showSuggestion && (
                <th className="px-5 py-3.5 font-semibold whitespace-nowrap text-left">
                  {tab === "scale" ? "Scale Suggestion" : "Outlook"}
                  <InfoTooltip text={tab === "scale" ? SCALE_SUGGESTION_INFO : OUTLOOK_INFO} />
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-variant">
            {pageAds.length === 0 ? (
              <tr>
                <td colSpan={showCols.length + (showSuggestion ? 1 : 0)} className="text-center text-on-surface-variant py-14 text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : pageAds.map(ad => (
              <tr key={ad.ad_id} className="hover:bg-surface-container transition-colors">
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
                    return (
                      <td className="px-5 py-3">
                        <div className="relative group inline-flex flex-col gap-0.5 cursor-default">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-secondary">{sg.increaseRange}</span>
                            <span className={`w-2 h-2 rounded-full shrink-0 ${CONFIDENCE_DOT[sg.confidence]}`} title={`${sg.confidence} confidence`} />
                          </div>
                          <SuggestionTooltip reasons={sg.reasons} warnings={sg.warnings} />
                        </div>
                      </td>
                    );
                  }
                  const ol = s as OutlookResult;
                  const verdictCfg = ol.verdict === "LIKELY_SCALE"
                    ? { label: "Likely Scale", icon: "trending_up",   cls: "text-secondary" }
                    : ol.verdict === "LIKELY_KILL"
                    ? { label: "Likely Kill",  icon: "trending_down", cls: "text-primary-container" }
                    : { label: "Uncertain",    icon: "help",          cls: "text-on-surface-variant" };
                  return (
                    <td className="px-5 py-3">
                      <div className="relative group inline-flex flex-col gap-0.5 cursor-default">
                        <div className="flex items-center gap-1.5">
                          <span className={`material-symbols-outlined text-[16px] ${verdictCfg.cls}`} style={{ fontVariationSettings: "'FILL' 1" }}>{verdictCfg.icon}</span>
                          <span className={`text-sm font-semibold ${verdictCfg.cls}`}>{verdictCfg.label}</span>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${CONFIDENCE_DOT[ol.confidence]}`} title={`${ol.confidence} confidence`} />
                        </div>
                        <SuggestionTooltip reasons={ol.reasons} warnings={ol.warnings} />
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
      <div className="px-5 py-3 border-t border-surface-variant bg-surface-container-low flex items-center justify-between flex-wrap gap-2">
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
              className="flex items-center gap-1 text-[11px] text-on-surface-variant border border-outline-variant px-2.5 py-1.5 rounded-lg hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">view_column</span>
              Columns
            </button>
            {colsOpen && (
              <div className="absolute bottom-full right-0 mb-1 z-50 bg-surface-container-high border border-outline-variant rounded-xl shadow-xl p-3 min-w-[200px] max-h-[340px] overflow-y-auto">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-2 px-1">Toggle Columns</p>
                {ALL_COLUMNS.map(col => (
                  <label
                    key={col.key}
                    className={`flex items-center gap-2 px-1 py-1 rounded ${ALWAYS_ON.has(col.key) ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-surface-container-highest"}`}
                  >
                    <input
                      type="checkbox"
                      checked={visible.has(col.key)}
                      onChange={() => toggleCol(col.key)}
                      className="accent-primary-container"
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
            className="p-1 border border-outline-variant rounded hover:bg-surface-container disabled:opacity-30 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <span className="text-[11px] text-on-surface-variant px-1">{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="p-1 border border-outline-variant rounded hover:bg-surface-container disabled:opacity-30 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  );
}
