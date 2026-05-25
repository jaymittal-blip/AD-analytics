import { fmtINR, fmtRoas } from "@/lib/format";

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

interface CardProps {
  label: string;
  value: string;
  sub: string;
  accent?: "red" | "green" | "amber" | "blue" | "none";
}

function Card({ label, value, sub, accent = "none" }: CardProps) {
  const accentBorder = {
    red:   "border-dash-kill",
    green: "border-dash-scale",
    amber: "border-dash-test",
    blue:  "border-dash-watch",
    none:  "border-dash-border",
  }[accent];

  const accentValue = {
    red:   "text-dash-kill",
    green: "text-dash-scale",
    amber: "text-dash-test",
    blue:  "text-dash-watch",
    none:  "text-dash-text",
  }[accent];

  return (
    <div
      className={`bg-dash-surface border ${accentBorder} rounded-xl p-5 flex flex-col gap-1`}
    >
      <p className="text-[10px] uppercase tracking-widest text-dash-muted">{label}</p>
      <p className={`text-2xl font-bold ${accentValue}`}>{value}</p>
      <p className="text-xs text-dash-muted">{sub}</p>
    </div>
  );
}

export default function SummaryCards({ metrics }: { metrics: Metrics }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 px-6 py-5">
      <Card
        label="Total Ads"
        value={String(metrics.totalAds)}
        sub="across all platforms"
      />
      <Card
        label="Wasted Spend"
        value={fmtINR(metrics.wastedSpend)}
        sub={`${metrics.killCount} active ads to stop`}
        accent="red"
      />
      <Card
        label="Scale Candidates"
        value={String(metrics.scaleCount)}
        sub="proven high-ROAS ads"
        accent="green"
      />
      <Card
        label="Still Testing"
        value={String(metrics.testingCount)}
        sub="too early to judge"
        accent="amber"
      />
      <Card
        label="Overall ROAS"
        value={fmtRoas(metrics.overallRoas)}
        sub={`${fmtINR(metrics.totalRevenue)} on ${fmtINR(metrics.totalSpend)}`}
      />
    </div>
  );
}
