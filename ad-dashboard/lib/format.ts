export function fmtINR(value: number): string {
  if (value >= 1_000_000) return `₹${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `₹${(value / 1_000).toFixed(0)}K`;
  return `₹${value.toFixed(0)}`;
}

export function fmtRoas(value: number): string {
  return `${value.toFixed(1)}x`;
}

export function fmtPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function fmtNumber(value: number): string {
  return value.toLocaleString("en-IN");
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
