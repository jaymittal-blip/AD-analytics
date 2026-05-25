import { Ad, AdClass, AdGroups } from "./types";

export const THRESHOLDS = {
  ROAS_KILL: 2.5,
  ROAS_SCALE: 15.0,
  MIN_DAYS: 14,
  MIN_SPEND: 30_000,
  MIN_SPEND_SCALE: 20_000,
} as const;

function classify(ad: Ad): AdClass {
  const roas  = ad.roas  ?? 0;
  const spend = ad.spend ?? 0;
  const days  = ad.days_running ?? 0;
  const status = (ad.status ?? "").toLowerCase();

  const proven =
    days  >= THRESHOLDS.MIN_DAYS ||
    spend >= THRESHOLDS.MIN_SPEND;

  if (status === "completed" || status === "paused") {
    if (proven && roas < THRESHOLDS.ROAS_KILL) return "ENDED_LOSS";
    if (roas >= THRESHOLDS.ROAS_SCALE)         return "ENDED_WIN";
    return "ENDED_OK";
  }

  if (proven && roas < THRESHOLDS.ROAS_KILL)                          return "KILL";
  if (roas >= THRESHOLDS.ROAS_SCALE && spend >= THRESHOLDS.MIN_SPEND_SCALE) return "SCALE";
  if (!proven)                                                          return "TESTING";
  return "MONITOR";
}

export function analyzeAds(ads: Omit<Ad, "_class">[]): Ad[] {
  return ads.map((ad) => ({ ...ad, _class: classify(ad as Ad) } as Ad));
}

const bySpendDesc = (a: Ad, b: Ad) => (b.spend ?? 0) - (a.spend ?? 0);
const byRoasDesc  = (a: Ad, b: Ad) => (b.roas  ?? 0) - (a.roas  ?? 0);

export function groupAds(ads: Ad[]): AdGroups {
  return {
    kill:    ads.filter((a) => a._class === "KILL").sort(bySpendDesc),
    scale:   ads.filter((a) => a._class === "SCALE").sort(byRoasDesc),
    monitor: ads.filter((a) => a._class === "MONITOR").sort(bySpendDesc),
    testing: ads.filter((a) => a._class === "TESTING").sort(bySpendDesc),
    ended:   ads.filter((a) => a._class.startsWith("ENDED")).sort(bySpendDesc),
    all:     ads,
  };
}

export function computeMetrics(ads: Ad[]) {
  const kill    = ads.filter((a) => a._class === "KILL");
  const scale   = ads.filter((a) => a._class === "SCALE");
  const testing = ads.filter((a) => a._class === "TESTING");

  const totalSpend   = ads.reduce((s, a) => s + (a.spend   ?? 0), 0);
  const totalRevenue = ads.reduce((s, a) => s + (a.revenue ?? 0), 0);
  const wastedSpend  = kill.reduce((s, a) => s + (a.spend  ?? 0), 0);
  const overallRoas  = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  return {
    totalAds:     ads.length,
    killCount:    kill.length,
    scaleCount:   scale.length,
    testingCount: testing.length,
    totalSpend,
    totalRevenue,
    wastedSpend,
    overallRoas,
  };
}

export function breakdownByField(ads: Ad[], field: keyof Ad): [string, number][] {
  const map: Record<string, number> = {};
  for (const ad of ads) {
    const key = String(ad[field] ?? "Unknown");
    map[key] = (map[key] ?? 0) + (ad.spend ?? 0);
  }
  return Object.entries(map).sort(([, a], [, b]) => b - a);
}
