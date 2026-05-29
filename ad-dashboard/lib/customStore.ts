import fs from "fs";
import path from "path";
import { Ad } from "./types";

// ── File-based fallback paths (used when DATABASE_URL is not set) ─────────────
const STORE_PATH  = path.join(process.cwd(), "data", "custom-ads.json");
const TOKENS_PATH = path.join(process.cwd(), "data", "google-tokens.json");
const SHEET_PATH  = path.join(process.cwd(), "data", "sheets-config.json");

function ensureFile(p: string, def: string) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(p))   fs.writeFileSync(p, def);
}

const USE_DB = Boolean(process.env.DATABASE_URL);

// ── Custom ads: Neon when DATABASE_URL is set, JSON file otherwise ────────────
export async function readCustomAds(): Promise<Ad[]> {
  if (USE_DB) {
    const { sql } = await import("./db");
    const rows = await sql`SELECT * FROM ads WHERE source != 'api' ORDER BY created_at DESC`;
    return rows.map(r => rowToAd(r));
  }
  ensureFile(STORE_PATH, "[]");
  try { return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")); } catch { return []; }
}

export async function upsertCustomAds(
  incoming: Ad[],
  source: "manual" | "csv" | "sheets" | "api" = "manual"
): Promise<{ added: number; updated: number }> {
  if (USE_DB) {
    const { sql } = await import("./db");
    let added = 0, updated = 0;
    for (const ad of incoming) {
      const existing = await sql`SELECT ad_id FROM ads WHERE ad_id = ${ad.ad_id}`;
      if (existing.length) updated++; else added++;
      await sql`
        INSERT INTO ads (
          ad_id, platform, brand, category, ad_type, target_audience,
          creative_theme, status, start_date, days_running, spend,
          impressions, clicks, ctr, conversions, revenue, roas, cpc, cpa,
          creative_score, landing_page_score, frequency, video_completion_rate,
          source, updated_at
        ) VALUES (
          ${ad.ad_id}, ${ad.platform}, ${ad.brand}, ${ad.category},
          ${ad.ad_type}, ${ad.target_audience}, ${ad.creative_theme},
          ${ad.status}, ${ad.start_date}, ${ad.days_running}, ${ad.spend},
          ${ad.impressions}, ${ad.clicks}, ${ad.ctr}, ${ad.conversions},
          ${ad.revenue}, ${ad.roas}, ${ad.cpc}, ${ad.cpa},
          ${ad.creative_score}, ${ad.landing_page_score}, ${ad.frequency},
          ${ad.video_completion_rate ?? null},
          ${source}, ${new Date().toISOString()}
        )
        ON CONFLICT (ad_id) DO UPDATE SET
          platform            = EXCLUDED.platform,
          brand               = EXCLUDED.brand,
          category            = EXCLUDED.category,
          ad_type             = EXCLUDED.ad_type,
          target_audience     = EXCLUDED.target_audience,
          creative_theme      = EXCLUDED.creative_theme,
          status              = EXCLUDED.status,
          start_date          = EXCLUDED.start_date,
          days_running        = EXCLUDED.days_running,
          spend               = EXCLUDED.spend,
          impressions         = EXCLUDED.impressions,
          clicks              = EXCLUDED.clicks,
          ctr                 = EXCLUDED.ctr,
          conversions         = EXCLUDED.conversions,
          revenue             = EXCLUDED.revenue,
          roas                = EXCLUDED.roas,
          cpc                 = EXCLUDED.cpc,
          cpa                 = EXCLUDED.cpa,
          creative_score      = EXCLUDED.creative_score,
          landing_page_score  = EXCLUDED.landing_page_score,
          frequency           = EXCLUDED.frequency,
          video_completion_rate = EXCLUDED.video_completion_rate,
          source              = EXCLUDED.source,
          updated_at          = EXCLUDED.updated_at
      `;
    }
    return { added, updated };
  }

  // JSON file fallback
  ensureFile(STORE_PATH, "[]");
  const existing: Ad[] = (() => { try { return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")); } catch { return []; } })();
  const map = new Map(existing.map(a => [a.ad_id, a]));
  let added = 0, updated = 0;
  for (const ad of incoming) {
    if (map.has(ad.ad_id)) updated++; else added++;
    map.set(ad.ad_id, ad);
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify([...map.values()], null, 2));
  return { added, updated };
}

export async function deleteCustomAd(ad_id: string): Promise<void> {
  if (USE_DB) {
    const { sql } = await import("./db");
    await sql`DELETE FROM ads WHERE ad_id = ${ad_id}`;
    return;
  }
  ensureFile(STORE_PATH, "[]");
  const existing: Ad[] = (() => { try { return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")); } catch { return []; } })();
  fs.writeFileSync(STORE_PATH, JSON.stringify(existing.filter(a => a.ad_id !== ad_id), null, 2));
}

// ── Row mapper ────────────────────────────────────────────────────────────────
function rowToAd(r: Record<string, unknown>): Ad {
  return {
    ad_id:                String(r.ad_id),
    platform:             String(r.platform),
    brand:                String(r.brand),
    category:             String(r.category),
    ad_type:              String(r.ad_type),
    target_audience:      String(r.target_audience),
    creative_theme:       String(r.creative_theme),
    status:               String(r.status),
    start_date:           String(r.start_date),
    days_running:         Number(r.days_running),
    spend:                Number(r.spend),
    impressions:          Number(r.impressions),
    clicks:               Number(r.clicks),
    ctr:                  Number(r.ctr),
    conversions:          Number(r.conversions),
    revenue:              Number(r.revenue),
    roas:                 Number(r.roas),
    cpc:                  Number(r.cpc),
    cpa:                  Number(r.cpa),
    creative_score:       Number(r.creative_score),
    landing_page_score:   Number(r.landing_page_score),
    frequency:            Number(r.frequency),
    video_completion_rate: r.video_completion_rate != null ? Number(r.video_completion_rate) : null,
    _class:               "TESTING" as const,
  } as Ad;
}

// ── Google OAuth tokens ───────────────────────────────────────────────────────
// DB-first (survives Vercel cold starts / read-only file system).
// File is used as local-dev fallback only and wrapped in try/catch.
export interface GoogleTokens {
  access_token:  string;
  refresh_token: string;
  expiry_date:   number;
  scope:         string;
}

export async function readTokens(): Promise<GoogleTokens | null> {
  if (process.env.DATABASE_URL) {
    try {
      const { getAppSetting } = await import("./usersRepo");
      return await getAppSetting<GoogleTokens>("google_tokens"); // trust DB result, including null
    } catch { return null; }
  }
  try {
    ensureFile(TOKENS_PATH, "null");
    return JSON.parse(fs.readFileSync(TOKENS_PATH, "utf-8"));
  } catch { return null; }
}

export async function writeTokens(t: GoogleTokens): Promise<void> {
  if (process.env.DATABASE_URL) {
    const { setAppSetting } = await import("./usersRepo");
    await setAppSetting("google_tokens", t);
    return;
  }
  try { ensureFile(TOKENS_PATH, "null"); fs.writeFileSync(TOKENS_PATH, JSON.stringify(t, null, 2)); } catch { /* read-only fs */ }
}

export async function clearTokens(): Promise<void> {
  if (process.env.DATABASE_URL) {
    const { setAppSetting } = await import("./usersRepo");
    await setAppSetting("google_tokens", null);
    return;
  }
  try { ensureFile(TOKENS_PATH, "null"); fs.writeFileSync(TOKENS_PATH, "null"); } catch { /* read-only fs */ }
}

// ── Sheet config ──────────────────────────────────────────────────────────────
export interface SheetConfig { sheetId: string; sheetName: string; lastSync: string | null }

export async function readSheetConfig(): Promise<SheetConfig | null> {
  if (process.env.DATABASE_URL) {
    try {
      const { getAppSetting } = await import("./usersRepo");
      return await getAppSetting<SheetConfig>("sheet_config"); // trust DB result, including null
    } catch { return null; }
  }
  try {
    ensureFile(SHEET_PATH, "null");
    return JSON.parse(fs.readFileSync(SHEET_PATH, "utf-8"));
  } catch { return null; }
}

export async function writeSheetConfig(cfg: SheetConfig): Promise<void> {
  if (process.env.DATABASE_URL) {
    const { setAppSetting } = await import("./usersRepo");
    await setAppSetting("sheet_config", cfg);
    return;
  }
  try { ensureFile(SHEET_PATH, "null"); fs.writeFileSync(SHEET_PATH, JSON.stringify(cfg, null, 2)); } catch { /* read-only fs */ }
}

export async function clearSheetConfig(): Promise<void> {
  if (process.env.DATABASE_URL) {
    const { setAppSetting } = await import("./usersRepo");
    await setAppSetting("sheet_config", null);
    return;
  }
  try { ensureFile(SHEET_PATH, "null"); fs.writeFileSync(SHEET_PATH, "null"); } catch { /* read-only fs */ }
}
