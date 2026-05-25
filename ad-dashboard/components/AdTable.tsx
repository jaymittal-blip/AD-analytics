"use client";

import { useState, useMemo } from "react";
import { Ad } from "@/lib/types";
import { fmtINR, fmtRoas, fmtPct } from "@/lib/format";
import Badge from "./Badge";

type SortKey = "spend" | "roas" | "days_running" | "revenue" | "ctr";
type SortDir = "asc" | "desc";

interface AdTableProps {
  ads: Ad[];
  searchable?: boolean;
  emptyMessage?: string;
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active)
    return <span className="text-dash-border ml-1 select-none">↕</span>;
  return (
    <span className="text-dash-watch ml-1 select-none">
      {dir === "desc" ? "↓" : "↑"}
    </span>
  );
}

export default function AdTable({
  ads,
  searchable = false,
  emptyMessage = "No ads in this category.",
}: AdTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [query, setQuery] = useState("");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return ads;
    const q = query.toLowerCase();
    return ads.filter(
      (a) =>
        a.ad_id.toLowerCase().includes(q) ||
        a.platform.toLowerCase().includes(q) ||
        a.brand.toLowerCase().includes(q) ||
        a.creative_theme.toLowerCase().includes(q) ||
        a.target_audience.toLowerCase().includes(q) ||
        a.status.toLowerCase().includes(q)
    );
  }, [ads, query]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return sortDir === "desc" ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });
  }, [filtered, sortKey, sortDir]);

  function Th({
    label,
    sk,
    align = "left",
  }: {
    label: string;
    sk?: SortKey;
    align?: "left" | "right";
  }) {
    const alignCls = align === "right" ? "text-right" : "text-left";
    const clickable = sk
      ? "cursor-pointer hover:text-dash-text select-none"
      : "";
    return (
      <th
        className={`px-3 py-2.5 text-[10px] uppercase tracking-wider text-dash-muted font-medium ${alignCls} ${clickable} whitespace-nowrap`}
        onClick={sk ? () => toggleSort(sk) : undefined}
      >
        {label}
        {sk && <SortIcon active={sortKey === sk} dir={sortDir} />}
      </th>
    );
  }

  return (
    <div className="space-y-3">
      {searchable && (
        <div className="flex justify-end">
          <input
            type="text"
            placeholder="Filter by ID, platform, brand, theme…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-dash-surface border border-dash-border rounded-lg px-3 py-1.5 text-sm text-dash-text placeholder:text-dash-muted focus:outline-none focus:border-dash-watch w-72"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-dash-border">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-[#0a0a12]">
            <tr>
              <Th label="Ad ID" />
              <Th label="Action" />
              <Th label="Platform" />
              <Th label="Brand" />
              <Th label="Creative Theme" />
              <Th label="Audience" />
              <Th label="Status" />
              <Th label="Days" sk="days_running" align="right" />
              <Th label="Spend"   sk="spend"   align="right" />
              <Th label="ROAS"    sk="roas"    align="right" />
              <Th label="CTR"     sk="ctr"     align="right" />
              <Th label="Revenue" sk="revenue" align="right" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={12}
                  className="text-center text-dash-muted py-10 text-sm"
                >
                  {query ? "No ads match your filter." : emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((ad) => (
                <tr
                  key={ad.ad_id}
                  className="border-t border-dash-border hover:bg-dash-raised transition-colors"
                >
                  <td className="px-3 py-2.5 font-mono text-xs text-dash-muted whitespace-nowrap">
                    {ad.ad_id}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <Badge cls={ad._class} />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{ad.platform}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{ad.brand}</td>
                  <td className="px-3 py-2.5 max-w-[180px] truncate" title={ad.creative_theme}>
                    {ad.creative_theme}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-dash-muted text-xs">
                    {ad.target_audience}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs text-dash-muted">
                    {ad.status}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{ad.days_running}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                    {fmtINR(ad.spend)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-dash-text">
                    {fmtRoas(ad.roas)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-dash-muted">
                    {fmtPct(ad.ctr)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-dash-muted">
                    {fmtINR(ad.revenue)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {sorted.length > 0 && (
        <p className="text-xs text-dash-muted text-right">
          {sorted.length} ad{sorted.length !== 1 ? "s" : ""}
          {query && ` matching "${query}"`}
        </p>
      )}
    </div>
  );
}
