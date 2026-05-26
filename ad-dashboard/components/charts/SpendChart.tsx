import { fmtINR } from "@/lib/format";

interface Props {
  title: string;
  rows: [string, number][];
  barColor?: string;
}

export default function SpendChart({ title, rows, barColor = "#ff5451" }: Props) {
  const top5 = rows
    .filter(([key, val]) => key && key !== "Unknown" && val > 0)
    .slice(0, 5);
  const max  = top5[0]?.[1] ?? 1;

  return (
    <div className="tonal-card bg-[#1A1A1A] border border-[#262626] rounded-xl p-5 flex flex-col gap-4 hover:border-[#404040] transition-colors">
      <h3 className="text-[10px] uppercase tracking-widest text-on-surface-variant">{title}</h3>
      <div className="space-y-3">
        {top5.length === 0 && (
          <p className="text-sm text-on-surface-variant py-4 text-center">No data</p>
        )}
        {top5.map(([key, val]) => (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-on-surface truncate mr-2">{key}</span>
              <span className="font-mono text-on-surface shrink-0">{fmtINR(val)}</span>
            </div>
            <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.round((val / max) * 100)}%`, backgroundColor: barColor }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
