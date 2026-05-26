"use client";

import { useState, useMemo } from "react";
import { Ad } from "@/lib/types";
import { fmtINR, fmtRoas, fmtPct } from "@/lib/format";
import { THRESHOLDS } from "@/lib/analyzer";
import { useSettings } from "@/contexts/SettingsProvider";
import Badge from "./Badge";

type SortKey = "spend" | "roas" | "days_running" | "revenue" | "ctr";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 15;

const ALL_COLUMNS = [
  { key: "ad_id",           label: "AD ID",         align: "left",  sortKey: null          },
  { key: "_class",          label: "Action",        align: "left",  sortKey: null          },
  { key: "platform",        label: "Platform",      align: "left",  sortKey: null          },
  { key: "brand",           label: "Brand",         align: "left",  sortKey: null          },
  { key: "creative_theme",  label: "Creative Theme",align: "left",  sortKey: null          },
  { key: "target_audience", label: "Audience",      align: "left",  sortKey: null          },
  { key: "status",          label: "Status",        align: "left",  sortKey: null          },
  { key: "days_running",    label: "Days",          align: "right", sortKey: "days_running" },
  { key: "spend",           label: "Spend",         align: "right", sortKey: "spend"        },
  { key: "roas",            label: "ROAS",          align: "right", sortKey: "roas"         },
  { key: "ctr",             label: "CTR",           align: "right", sortKey: "ctr"          },
  { key: "revenue",         label: "Revenue",       align: "right", sortKey: "revenue"      },
] as const;

type ColKey = (typeof ALL_COLUMNS)[number]["key"];

const ALWAYS_ON = new Set<ColKey>(["ad_id", "_class"]);
const DEFAULT_VISIBLE = new Set<ColKey>([
  "ad_id", "_class", "platform", "brand", "creative_theme",
  "target_audience", "days_running", "spend", "roas", "ctr", "revenue",
]);

interface Props {
  ads: Ad[];
  emptyMessage?: string;
}

export default function AdTable({ ads, emptyMessage = "No ads in this category." }: Props) {
  const { settings } = useSettings();
  const [sortKey,  setSortKey]  = useState<SortKey>("spend");
  const [sortDir,  setSortDir]  = useState<SortDir>("desc");
  const [page,     setPage]     = useState(1);
  const [colsOpen, setColsOpen] = useState(false);
  // Init from global settings; local toggles override for the session
  const [visible,  setVisible]  = useState<Set<ColKey>>(
    () => new Set(settings.visibleColumns as ColKey[])
  );

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
      const av = (a[sortKey as keyof Ad] as number) ?? 0;
      const bv = (b[sortKey as keyof Ad] as number) ?? 0;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [ads, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageAds    = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showCols   = ALL_COLUMNS.filter(c => visible.has(c.key));

  function roasColor(roas: number) {
    if (roas < THRESHOLDS.ROAS_KILL)   return "text-primary-container";
    if (roas >= THRESHOLDS.ROAS_SCALE) return "text-secondary";
    return "text-on-surface";
  }

  function renderCell(ad: Ad, key: ColKey) {
    switch (key) {
      case "ad_id":           return <span className="font-mono text-[12px] text-on-surface-variant whitespace-nowrap">{ad.ad_id}</span>;
      case "_class":          return <Badge cls={ad._class} />;
      case "platform":        return <span className="text-sm">{ad.platform}</span>;
      case "brand":           return <span className="text-sm">{ad.brand}</span>;
      case "creative_theme":  return <span className="text-sm italic text-on-surface-variant truncate max-w-[150px] block" title={ad.creative_theme}>{ad.creative_theme}</span>;
      case "target_audience": return <span className="text-sm text-on-surface-variant whitespace-nowrap">{ad.target_audience}</span>;
      case "status":          return <span className="text-xs text-on-surface-variant whitespace-nowrap">{ad.status}</span>;
      case "days_running":    return <span className="font-mono text-sm">{ad.days_running}</span>;
      case "spend":           return <span className="font-mono text-sm font-bold">{fmtINR(ad.spend)}</span>;
      case "roas":            return <span className={`font-mono text-sm font-bold ${roasColor(ad.roas)}`}>{fmtRoas(ad.roas)}</span>;
      case "ctr":             return <span className="font-mono text-sm text-on-surface-variant">{fmtPct(ad.ctr)}</span>;
      case "revenue":         return <span className="font-mono text-sm text-on-surface-variant">{fmtINR(ad.revenue)}</span>;
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
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-variant">
            {pageAds.length === 0 ? (
              <tr>
                <td colSpan={showCols.length} className="text-center text-on-surface-variant py-14 text-sm">
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
              <div className="absolute bottom-full right-0 mb-1 z-50 bg-surface-container-high border border-outline-variant rounded-xl shadow-xl p-3 min-w-[180px]">
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
