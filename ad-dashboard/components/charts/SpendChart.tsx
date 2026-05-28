import { fmtINR } from "@/lib/format";

interface Props {
  title: string;
  rows: [string, number][];
  barColor?: string;
}

export default function SpendChart({ title, rows, barColor = "#2D4032" }: Props) {
  const filtered  = rows.filter(([key, val]) => key && key !== "Unknown" && val > 0);
  const top5      = filtered.slice(0, 5);
  const otherSum  = filtered.slice(5).reduce((s, [, v]) => s + v, 0);
  const display   = otherSum > 0 ? [...top5, ["Other", otherSum] as [string, number]] : top5;
  const max       = top5[0]?.[1] ?? 1;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex flex-col gap-4 shadow-card">
      <h3 className="text-[10px] uppercase tracking-widest font-semibold text-on-surface-variant">{title}</h3>
      <div className="space-y-3.5">
        {display.length === 0 && (
          <p className="text-sm text-on-surface-variant py-4 text-center">No data</p>
        )}
        {display.map(([key, val]) => (
          <div key={key}>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-on-surface truncate mr-2 font-medium">{key}</span>
              <span className="font-mono text-on-surface-variant shrink-0 text-[12px]">{fmtINR(val)}</span>
            </div>
            <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.round((val / max) * 100)}%`, backgroundColor: key === "Other" ? "#C8C2B4" : barColor }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
