import fs from "fs";
import path from "path";
import { Ad } from "./types";

const STORE_PATH  = path.join(process.cwd(), "data", "custom-ads.json");
const TOKENS_PATH = path.join(process.cwd(), "data", "google-tokens.json");
const SHEET_PATH  = path.join(process.cwd(), "data", "sheets-config.json");

function ensureFile(p: string, def: string) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(p))   fs.writeFileSync(p, def);
}

// ── Custom ads ────────────────────────────────────────────────────────────────
export function readCustomAds(): Ad[] {
  ensureFile(STORE_PATH, "[]");
  try { return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")); } catch { return []; }
}

function writeCustomAds(ads: Ad[]) {
  ensureFile(STORE_PATH, "[]");
  fs.writeFileSync(STORE_PATH, JSON.stringify(ads, null, 2));
}

export function upsertCustomAds(incoming: Ad[]): { added: number; updated: number } {
  const existing = readCustomAds();
  const map = new Map(existing.map(a => [a.ad_id, a]));
  let added = 0, updated = 0;
  for (const ad of incoming) {
    if (map.has(ad.ad_id)) updated++; else added++;
    map.set(ad.ad_id, ad);
  }
  writeCustomAds([...map.values()]);
  return { added, updated };
}

export function deleteCustomAd(ad_id: string) {
  writeCustomAds(readCustomAds().filter(a => a.ad_id !== ad_id));
}

// ── Google OAuth tokens ───────────────────────────────────────────────────────
export interface GoogleTokens {
  access_token:  string;
  refresh_token: string;
  expiry_date:   number;
  scope:         string;
}

export function readTokens(): GoogleTokens | null {
  ensureFile(TOKENS_PATH, "null");
  try {
    const raw = fs.readFileSync(TOKENS_PATH, "utf-8");
    return JSON.parse(raw);
  } catch { return null; }
}

export function writeTokens(t: GoogleTokens) {
  ensureFile(TOKENS_PATH, "null");
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(t, null, 2));
}

export function clearTokens() {
  ensureFile(TOKENS_PATH, "null");
  fs.writeFileSync(TOKENS_PATH, "null");
}

// ── Sheet config ─────────────────────────────────────────────────────────────
export interface SheetConfig { sheetId: string; sheetName: string; lastSync: string | null }

export function readSheetConfig(): SheetConfig | null {
  ensureFile(SHEET_PATH, "null");
  try { return JSON.parse(fs.readFileSync(SHEET_PATH, "utf-8")); } catch { return null; }
}

export function writeSheetConfig(cfg: SheetConfig) {
  ensureFile(SHEET_PATH, "null");
  fs.writeFileSync(SHEET_PATH, JSON.stringify(cfg, null, 2));
}
