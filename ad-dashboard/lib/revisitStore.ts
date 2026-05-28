const LS_KEY = "ad_revisit_countdowns";

export interface RevisitEntry {
  adId:       string;
  adName:     string;
  scaledAt:   number;  // Date.now() when scale was applied
  revisitMs:  number;  // total duration in ms until revisit
  isDemoMode: boolean;
  dismissed:  boolean; // "Remind Off" was clicked
}

export const DEMO_AD_ID      = "AD-0072";
export const DEMO_REVISIT_MS = 30_000; // 30 seconds

function load(): RevisitEntry[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]"); } catch { return []; }
}

function save(entries: RevisitEntry[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(entries));
  window.dispatchEvent(new CustomEvent("revisit-updated"));
}

export function setRevisit(adId: string, adName: string, revisitMs: number, isDemoMode: boolean) {
  const entries = load().filter(e => e.adId !== adId);
  entries.push({ adId, adName, scaledAt: Date.now(), revisitMs, isDemoMode, dismissed: false });
  save(entries);
}

export function dismissRevisit(adId: string) {
  save(load().map(e => e.adId === adId ? { ...e, dismissed: true } : e));
}

export function getRevisits(): RevisitEntry[] {
  return load();
}

// Returns entries that are overdue OR due within `withinMs` milliseconds (and not dismissed)
export function getDueSoonEntries(withinMs: number): RevisitEntry[] {
  const now = Date.now();
  return load().filter(e => {
    if (e.dismissed) return false;
    const dueAt = e.scaledAt + e.revisitMs;
    return now >= dueAt - withinMs;
  });
}

export function getDueAdIds(withinMs: number): Set<string> {
  return new Set(getDueSoonEntries(withinMs).map(e => e.adId));
}
