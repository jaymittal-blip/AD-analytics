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
    { label: "Total Spend",   value: fmtINR(totalSpend),      color: "text-error"     },
    { label: "Total Revenue", value: fmtINR(totalRevenue),    color: "text-secondary" },
    { label: "ROAS",          value: fmtRoas(roas),           color: "text-on-surface" },
    { label: "Avg CTR",       value: `${avgCtr.toFixed(2)}%`, color: "text-tertiary"  },
  ];

  return (
    <div className="bg-primary text-on-primary rounded-2xl p-5 flex flex-col gap-4 shadow-card">
      <h3 className="text-[10px] uppercase tracking-widest font-semibold opacity-70">
        {label} Overview
      </h3>

      <div className="grid grid-cols-2 gap-4 flex-1">
        {metrics.map(({ label: l, value }) => (
          <div key={l}>
            <p className="text-[10px] opacity-60 mb-0.5">{l}</p>
            <p className="text-base font-bold leading-tight">{value}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-white/20 pt-3">
        <p className="text-[10px] opacity-60 mb-0.5">Ads in Category</p>
        <p className="text-2xl font-bold">{ads.length}</p>
      </div>
    </div>
  );
}
