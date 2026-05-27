"use client";

import { useState } from "react";
import { fmtINR } from "@/lib/format";

// Earthy, organic palette matching Little Joys brand
const COLORS = ["#2D4032", "#4A6B50", "#B87830", "#C0503A", "#5B7A8C", "#8C6B3A"];

interface Props {
  title: string;
  rows: [string, number][];
}

export default function DonutChart({ title, rows }: Props) {
  const [hovered, setHovered] = useState<{ key: string; val: number } | null>(null);

  const top6  = rows.slice(0, 6);
  const total = top6.reduce((s, [, v]) => s + v, 0);

  const R             = 54;
  const cx            = 64;
  const cy            = 64;
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
      color:  COLORS[i % COLORS.length],
    };
    accumulated += dash;
    return seg;
  });

  const display = hovered ?? null;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 flex flex-col gap-3 shadow-card">
      <h3 className="text-[10px] uppercase tracking-widest font-semibold text-on-surface-variant">{title}</h3>

      <div className="flex items-center justify-center py-1">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
            <circle cx={cx} cy={cy} r={R} fill="transparent" stroke="#E4DFCF" strokeWidth="12" />
            {segments.map((s) => (
              <circle
                key={s.key}
                cx={cx} cy={cy} r={R}
                fill="transparent"
                stroke={s.color}
                strokeWidth={hovered?.key === s.key ? 16 : 12}
                strokeDasharray={`${s.dash} ${circumference - s.dash}`}
                strokeDashoffset={s.offset}
                strokeLinecap="round"
                style={{ pointerEvents: "visibleStroke", cursor: "pointer", transition: "stroke-width 0.15s ease" }}
                onMouseEnter={() => setHovered({ key: s.key, val: s.val })}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-[15px] font-bold leading-none text-on-surface transition-all"
              style={{ color: display ? segments.find(s => s.key === display.key)?.color : undefined }}>
              {display ? fmtINR(display.val) : fmtINR(total)}
            </p>
            <p className="text-[10px] text-on-surface-variant mt-1 text-center px-3 max-w-[110px] truncate">
              {display ? display.key : "Total"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {segments.map((s) => (
          <div
            key={s.key}
            className={`flex items-center gap-1.5 min-w-0 rounded-lg px-1.5 py-0.5 cursor-default transition-colors ${hovered?.key === s.key ? "bg-surface-container" : ""}`}
            onMouseEnter={() => setHovered({ key: s.key, val: s.val })}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-[11px] text-on-surface-variant truncate" title={s.key}>{s.key}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
