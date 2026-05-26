import { fmtINR } from "@/lib/format";

const COLORS = ["#ff5451", "#ffb3ad", "#4ae176", "#adc6ff", "#ffa502", "#00b954"];

interface Props {
  title: string;
  rows: [string, number][];
}

export default function DonutChart({ title, rows }: Props) {
  const top6  = rows.slice(0, 6);
  const total = top6.reduce((s, [, v]) => s + v, 0);

  const R            = 54;
  const cx           = 64;
  const cy           = 64;
  const circumference = 2 * Math.PI * R;

  let accumulated = 0;
  const segments = top6.map(([key, val], i) => {
    const pct  = total > 0 ? val / total : 0;
    const dash = pct * circumference;
    const seg  = {
      key,
      val,
      dash,
      offset: circumference - accumulated,
      color: COLORS[i % COLORS.length],
    };
    accumulated += dash;
    return seg;
  });

  return (
    <div className="tonal-card bg-[#1A1A1A] border border-[#262626] rounded-xl p-5 flex flex-col gap-3 hover:border-[#404040] transition-colors">
      <h3 className="text-[10px] uppercase tracking-widest text-on-surface-variant">{title}</h3>

      <div className="flex items-center justify-center py-1">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
            <circle cx={cx} cy={cy} r={R} fill="transparent" stroke="#262626" strokeWidth="12" />
            {segments.map((s) => (
              <circle
                key={s.key}
                cx={cx} cy={cy} r={R}
                fill="transparent"
                stroke={s.color}
                strokeWidth="12"
                strokeDasharray={`${s.dash} ${circumference - s.dash}`}
                strokeDashoffset={s.offset}
                strokeLinecap="round"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[15px] font-bold leading-none text-on-surface">{fmtINR(total)}</p>
            <p className="text-[10px] text-on-surface-variant mt-1">Total</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 min-w-0">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-[11px] text-on-surface-variant truncate" title={s.key}>{s.key}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
