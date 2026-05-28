const LS_KEY = "ad_revisit_countdowns";

export interface RevisitEntry {
  adId:       string;
  adName:     string;
  scaledAt:   number;  // Date.now() when scale was applied
  revisitMs:  number;  // total duration in ms until revisit
  isDemoMode: boolean;
  dismissed:  boolean; // "Remind Off" banner button clicked
  visited:    boolean; // "Visited" table button clicked → shows Next Action
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
  entries.push({ adId, adName, scaledAt: Date.now(), revisitMs, isDemoMode, dismissed: false, visited: false });
  save(entries);
}

export function dismissRevisit(adId: string) {
  save(load().map(e => e.adId === adId ? { ...e, dismissed: true } : e));
}

// Called when user clicks "Visited" in the Action column
export function markVisited(adId: string) {
  save(load().map(e => e.adId === adId ? { ...e, visited: true, dismissed: true } : e));
}

// Called after Kill or Scale Again — removes the entry entirely
export function clearRevisit(adId: string) {
  save(load().filter(e => e.adId !== adId));
}

export function getRevisits(): RevisitEntry[] {
  return load();
}

// Returns entries overdue OR due within `withinMs` ms (banner: skip dismissed ones)
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

export function isEntryOverdue(e: RevisitEntry, now = Date.now()): boolean {
  return now > e.scaledAt + e.revisitMs;
}
