"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AdGroups, TabId } from "@/lib/types";
import { THRESHOLDS, breakdownByField } from "@/lib/analyzer";
import { fmtINR, fmtDate } from "@/lib/format";
import SummaryCards from "./SummaryCards";
import BreakdownGrid from "./BreakdownGrid";
import AdTable from "./AdTable";

interface Metrics {
  totalAds: number;
  killCount: number;
  scaleCount: number;
  testingCount: number;
  wastedSpend: number;
  overallRoas: number;
  totalSpend: number;
  totalRevenue: number;
}

interface DashboardProps {
  groups: AdGroups;
  metrics: Metrics;
  fetchedAt: string;
}

// ── Tab configuration ──────────────────────────────────────────────────────────
const TABS: { id: TabId; label: string; countKey: keyof AdGroups }[] = [
  { id: "kill",    label: "Kill List", countKey: "kill"    },
  { id: "scale",   label: "Scale",     countKey: "scale"   },
  { id: "monitor", label: "Monitor",   countKey: "monitor" },
  { id: "testing", label: "Testing",   countKey: "testing" },
  { id: "ended",   label: "Ended",     countKey: "ended"   },
  { id: "all",     label: "All Ads",   countKey: "all"     },
];

const TAB_ACCENT: Record<TabId, string> = {
  kill:    "text-dash-kill   border-dash-kill",
  scale:   "text-dash-scale  border-dash-scale",
  monitor: "text-dash-watch  border-dash-watch",
  testing: "text-dash-test   border-dash-test",
  ended:   "text-dash-muted  border-dash-muted",
  all:     "text-dash-text   border-dash-border",
};

const COUNT_PILL: Record<TabId, string> = {
  kill:    "bg-dash-kill   text-white",
  scale:   "bg-dash-scale  text-black",
  monitor: "bg-dash-watch  text-white",
  testing: "bg-dash-test   text-black",
  ended:   "bg-dash-ended  text-white",
  all:     "bg-dash-border text-dash-muted",
};

// ── Criteria copy ──────────────────────────────────────────────────────────────
function CriteriaBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-dash-surface border border-dash-border rounded-xl px-4 py-3 mb-4 text-sm text-dash-muted leading-relaxed">
      {children}
    </div>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="text-dash-text font-semibold">{children}</strong>;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Dashboard({ groups, metrics, fetchedAt }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>("kill");
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  async function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    // Give the spinner a moment; the router refresh will re-render automatically
    setTimeout(() => setRefreshing(false), 2000);
  }

  // Computed breakdowns — memoized so they don't recalculate on tab switch
  const killByPlatform = useMemo(() => breakdownByField(groups.kill,  "platform"), [groups.kill]);
  const killByBrand    = useMemo(() => breakdownByField(groups.kill,  "brand"),    [groups.kill]);
  const scaleByPlatform= useMemo(() => breakdownByField(groups.scale, "platform"), [groups.scale]);
  const scaleByBrand   = useMemo(() => breakdownByField(groups.scale, "brand"),    [groups.scale]);

  return (
    <div className="min-h-screen bg-dash-bg">

      {/* ── Header ── */}
      <header className="bg-[#0a0a12] border-b border-dash-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Ad Performance Dashboard</h1>
          <p className="text-xs text-dash-muted mt-0.5">
            {metrics.totalAds} ads analyzed · Refreshed {fmtDate(fetchedAt)}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dash-border
                     text-xs text-dash-muted hover:text-dash-text hover:border-dash-watch
                     transition-colors disabled:opacity-40"
        >
          <span className={refreshing ? "animate-spin inline-block" : "inline-block"}>↻</span>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {/* ── Summary cards ── */}
      <SummaryCards metrics={metrics} />

      {/* ── Tabs ── */}
      <div className="px-6">
        <div className="flex gap-1 border-b border-dash-border mb-5 overflow-x-auto">
          {TABS.map(({ id, label, countKey }) => {
            const isActive = activeTab === id;
            const count = groups[countKey].length;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`
                  flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap
                  border-b-2 transition-colors rounded-t-md -mb-px
                  ${isActive
                    ? `${TAB_ACCENT[id]} bg-dash-surface`
                    : "text-dash-muted border-transparent hover:text-dash-text"
                  }
                `}
              >
                {label}
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? COUNT_PILL[id] : "bg-dash-border text-dash-muted"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Kill panel ── */}
        {activeTab === "kill" && (
          <div>
            <CriteriaBox>
              <Strong>Kill criteria (active ads):</Strong> ROAS &lt;{" "}
              <Strong>{THRESHOLDS.ROAS_KILL}x</Strong> AND (running ≥{" "}
              <Strong>{THRESHOLDS.MIN_DAYS} days</Strong> OR spent ≥{" "}
              <Strong>{fmtINR(THRESHOLDS.MIN_SPEND)}</Strong>). These ads have
              had enough time and budget to prove themselves — and haven&apos;t.
              Stop these immediately to recover{" "}
              <Strong>{fmtINR(metrics.wastedSpend)}</Strong> in active wasted
              spend.
            </CriteriaBox>
            <BreakdownGrid
              byPlatform={killByPlatform}
              byBrand={killByBrand}
              valueColor="text-dash-kill"
            />
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">
                Stop these {groups.kill.length} ads immediately
              </h3>
              <span className="text-xs text-dash-muted">
                Sorted by spend · highest first
              </span>
            </div>
            <AdTable
              ads={groups.kill}
              emptyMessage="No ads currently meet the kill criteria — great!"
            />
          </div>
        )}

        {/* ── Scale panel ── */}
        {activeTab === "scale" && (
          <div>
            <CriteriaBox>
              <Strong>Scale criteria:</Strong> ROAS ≥{" "}
              <Strong>{THRESHOLDS.ROAS_SCALE}x</Strong> AND spent ≥{" "}
              <Strong>{fmtINR(THRESHOLDS.MIN_SPEND_SCALE)}</Strong> AND status
              Active. Proven performers — increase budget on these to capture
              more revenue.
            </CriteriaBox>
            <BreakdownGrid
              byPlatform={scaleByPlatform}
              byBrand={scaleByBrand}
              valueColor="text-dash-scale"
            />
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">
                Increase budget on these {groups.scale.length} ads
              </h3>
              <span className="text-xs text-dash-muted">
                Sorted by ROAS · highest first
              </span>
            </div>
            <AdTable
              ads={groups.scale}
              emptyMessage="No scale candidates at current thresholds."
            />
          </div>
        )}

        {/* ── Monitor panel ── */}
        {activeTab === "monitor" && (
          <div>
            <CriteriaBox>
              <Strong>Monitor:</Strong> Active, proven (≥{THRESHOLDS.MIN_DAYS}{" "}
              days or ≥{fmtINR(THRESHOLDS.MIN_SPEND)} spend), ROAS between{" "}
              <Strong>
                {THRESHOLDS.ROAS_KILL}x – {THRESHOLDS.ROAS_SCALE}x
              </Strong>
              . Not bad enough to kill, not strong enough to scale yet. Watch
              for trend direction over the next week.
            </CriteriaBox>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">
                {groups.monitor.length} ads to watch
              </h3>
              <span className="text-xs text-dash-muted">
                Sorted by spend · highest first
              </span>
            </div>
            <AdTable
              ads={groups.monitor}
              emptyMessage="No monitor ads."
            />
          </div>
        )}

        {/* ── Testing panel ── */}
        {activeTab === "testing" && (
          <div>
            <CriteriaBox>
              <Strong>Still testing — no action yet:</Strong> Active ads with
              less than <Strong>{THRESHOLDS.MIN_DAYS} days</Strong> running AND
              less than <Strong>{fmtINR(THRESHOLDS.MIN_SPEND)}</Strong> spent.
              Too early to judge. Let these run until they hit the decision
              threshold.
            </CriteriaBox>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">
                {groups.testing.length} ads in early testing
              </h3>
              <span className="text-xs text-dash-muted">
                Sorted by spend · highest first
              </span>
            </div>
            <AdTable
              ads={groups.testing}
              emptyMessage="No ads currently in early testing."
            />
          </div>
        )}

        {/* ── Ended panel ── */}
        {activeTab === "ended" && (
          <div>
            <CriteriaBox>
              Historical reference only — these ads are completed or paused.{" "}
              <Strong>ENDED_WIN</Strong> = high-ROAS winner (replicate the
              creative). <Strong>ENDED_LOSS</Strong> = proven loser (avoid
              similar creatives). <Strong>ENDED_OK</Strong> = neutral.
            </CriteriaBox>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">
                {groups.ended.length} ended ads
              </h3>
              <span className="text-xs text-dash-muted">
                Sorted by spend · highest first
              </span>
            </div>
            <AdTable
              ads={groups.ended}
              emptyMessage="No ended ads."
            />
          </div>
        )}

        {/* ── All panel ── */}
        {activeTab === "all" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">
                All {groups.all.length} ads
              </h3>
              <span className="text-xs text-dash-muted">
                Use the filter to search
              </span>
            </div>
            <AdTable
              ads={groups.all}
              searchable
              emptyMessage="No ads found."
            />
          </div>
        )}

        <div className="h-12" />
      </div>
    </div>
  );
}
