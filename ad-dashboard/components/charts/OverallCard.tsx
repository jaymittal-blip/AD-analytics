import { Ad } from "@/lib/types";
import { fmtINR, fmtRoas } from "@/lib/format";

interface Props {
  ads: Ad[];
  label: string;
}

export default function OverallCard({ ads, label }: Props) {
  const totalSpend   = ads.reduce((s, a) => s + (a.spend   ?? 0), 0);
  const totalRevenue = ads.reduce((s, a) => s + (a.revenue ?? 0), 0);
  const roas         = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const avgCtr       = ads.length > 0
    ? ads.reduce((s, a) => s + (a.ctr ?? 0), 0) / ads.length
    : 0;

  const metrics = [
    { label: "Total Spend",   value: fmtINR(totalSpend),   color: "text-primary-container" },
    { label: "Total Revenue", value: fmtINR(totalRevenue), color: "text-secondary"         },
    { label: "ROAS",          value: fmtRoas(roas),        color: "text-on-surface"        },
    { label: "Avg CTR",       value: `${avgCtr.toFixed(2)}%`, color: "text-tertiary"       },
  ];

  return (
    <div
      className="tonal-card bg-[#1A1A1A] border border-[#262626] rounded-xl p-5 flex flex-col gap-4 hover:border-[#404040] transition-colors"
      style={{ background: "radial-gradient(circle at top right, rgba(255,84,81,0.07), transparent 70%), #1A1A1A" }}
    >
      <h3 className="text-[10px] uppercase tracking-widest text-on-surface-variant">
        {label} Overview
      </h3>

      <div className="grid grid-cols-2 gap-4 flex-1">
        {metrics.map(({ label: l, value, color }) => (
          <div key={l}>
            <p className="text-[10px] text-on-surface-variant mb-0.5">{l}</p>
            <p className={`text-lg font-bold leading-tight ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-surface-variant pt-3">
        <p className="text-[10px] text-on-surface-variant mb-0.5">Ads in Category</p>
        <p className="text-2xl font-bold text-on-surface">{ads.length}</p>
      </div>
    </div>
  );
}
