import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { readTokens, readSheetConfig, writeTokens, writeSheetConfig } from "@/lib/customStore";
import { upsertManyAds, getAllAds } from "@/lib/adsRepo";
import { Ad } from "@/lib/types";
import { classifyWithCriteria, CriteriaMap } from "@/lib/settings";
import { getAppSetting, recordCategoryChanges } from "@/lib/usersRepo";

export const dynamic = "force-dynamic";

function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      result.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function toAd(row: Record<string, string>): Ad {
  const now        = new Date();
  const startDate  = row.start_date ? new Date(row.start_date) : now;
  const daysRunning = row.days_running
    ? Number(row.days_running)
    : Math.floor((now.getTime() - startDate.getTime()) / 86400000);

  return {
    ad_id:                row.ad_id?.trim()              ?? "",
    platform:             row.platform                   ?? "Unknown",
    brand:                row.brand                      ?? "Unknown",
    category:             row.category                   ?? "Unknown",
    ad_type:              row.ad_type                    ?? "Unknown",
    target_audience:      row.target_audience            ?? "Unknown",
    creative_theme:       row.creative_theme             ?? "Unknown",
    status:               row.status                     ?? "Active",
    start_date:           row.start_date                 ?? now.toISOString().split("T")[0],
    days_running:         daysRunning,
    spend:                Number(row.spend)              || 0,
    revenue:              Number(row.revenue)            || 0,
    roas:                 Number(row.roas)               || 0,
    impressions:          Number(row.impressions)        || 0,
    clicks:               Number(row.clicks)             || 0,
    ctr:                  Number(row.ctr)                || 0,
    conversions:          Number(row.conversions)        || 0,
    cpc:                  Number(row.cpc)                || 0,
    cpa:                  Number(row.cpa)                || 0,
    creative_score:       Number(row.creative_score)     || 0,
    landing_page_score:   Number(row.landing_page_score) || 0,
    frequency:            Number(row.frequency)          || 0,
    video_completion_rate: row.video_completion_rate != null && row.video_completion_rate !== ""
      ? Number(row.video_completion_rate) : null,
    landing_page: row.landing_page?.trim() || null,
    product_name: row.product_name?.trim() || null,
    _class: "TESTING",
  } as Ad;
}

function csvToAds(csvText: string): Ad[] {
  const lines = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVRow(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const ads: Ad[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVRow(lines[i]);
    if (cols.every(c => !c.trim())) continue;
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => { if (h) record[h] = (cols[idx] ?? "").trim(); });
    if (!record.ad_id) continue;
    ads.push(toAd(record));
  }
  return ads;
}

async function detectAndQueueChanges(reason: "metrics" | "criteria" = "metrics") {
  try {
    const { sql } = await import("@/lib/db");

    const [allAds, lastClassRows, criteria] = await Promise.all([
      getAllAds(),
      sql`SELECT ad_id, last_class FROM ads`,
      getAppSetting<CriteriaMap>("criteria"),
    ]);

    const lastClassMap = new Map<string, string | null>(
      lastClassRows.map(r => [String(r.ad_id), r.last_class as string | null ?? null])
    );

    const changes: Array<{
      ad_id: string; from_class: string | null; to_class: string;
      change_reason: "metrics" | "criteria"; ad_data: Record<string, unknown>;
    }> = [];
    const toUpdate: Array<{ adId: string; newClass: string }> = [];

    for (const ad of allAds) {
      const newClass  = criteria ? classifyWithCriteria(ad, criteria) : null;
      if (newClass === null) continue;

      const lastClass = lastClassMap.get(ad.ad_id) ?? null;
      if (newClass === lastClass) continue;

      if (lastClass !== null) {
        changes.push({
          ad_id:         ad.ad_id,
          from_class:    lastClass,
          to_class:      newClass,
          change_reason: reason,
          ad_data: {
            brand: ad.brand, platform: ad.platform, creative_theme: ad.creative_theme,
            spend: ad.spend, roas: ad.roas, ctr: ad.ctr, revenue: ad.revenue,
            status: ad.status, days_running: ad.days_running,
          },
        });
      }
      toUpdate.push({ adId: ad.ad_id, newClass });
    }

    for (const { adId, newClass } of toUpdate) {
      await sql`UPDATE ads SET last_class = ${newClass} WHERE ad_id = ${adId}`;
    }

    if (changes.length > 0) {
      await recordCategoryChanges(changes);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      await fetch(`${appUrl}/api/send-alerts?schedule=instant`, { method: "POST", cache: "no-store" }).catch(() => {});
    }
  } catch (e) {
    console.error("[detectAndQueueChanges]", e);
  }
}

async function triggerScheduledAlerts(appUrl: string) {
  // instant is handled inside detectAndQueueChanges; here we only check digest schedules
  const schedules = ["daily", "weekly", "monthly"] as const;
  await Promise.allSettled(
    schedules.map(s => fetch(`${appUrl}/api/send-alerts?schedule=${s}`, { method: "POST", cache: "no-store" }))
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reason = (searchParams.get("reason") ?? "metrics") as "metrics" | "criteria";

  const [config, tokens] = await Promise.all([readSheetConfig(), readTokens()]);
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!config?.sheetId || config.sheetId === "apps-script") {
    if (reason === "criteria") {
      await detectAndQueueChanges("criteria");
    }
    triggerScheduledAlerts(APP_URL).catch(() => {});
    return NextResponse.json({ synced: false, reason: "no_sheet_configured" });
  }

  const sheetId = config.sheetId;

  // ── OAuth path ─────────────────────────────────────────────────────────────
  if (tokens && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    try {
      const oauth2  = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${APP_URL}/api/sheets/callback`,
      );
      oauth2.setCredentials({ access_token: tokens.access_token, refresh_token: tokens.refresh_token, expiry_date: tokens.expiry_date });
      oauth2.on("tokens", t => { if (t.access_token) writeTokens({ ...tokens, access_token: t.access_token, expiry_date: t.expiry_date! }).catch(() => {}); });

      const sheets   = google.sheets({ version: "v4", auth: oauth2 });
      const response = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: "A1:ZZ" });
      const rows     = response.data.values ?? [];
      if (rows.length < 2) return NextResponse.json({ synced: false, reason: "empty_sheet" });

      const headers = (rows[0] as string[]).map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
      const ads: Ad[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] as string[];
        if (!row.some(Boolean)) continue;
        const record: Record<string, string> = {};
        headers.forEach((h, idx) => { if (h) record[h] = row[idx] ?? ""; });
        if (!record.ad_id) continue;
        ads.push(toAd(record));
      }
      const result = await upsertManyAds(ads, "sheets");
      await writeSheetConfig({ ...config, lastSync: new Date().toISOString() });
      await detectAndQueueChanges(reason);
      triggerScheduledAlerts(APP_URL).catch(() => {});
      return NextResponse.json({ synced: true, ...result, total: ads.length });
    } catch {
      return NextResponse.json({ synced: false, reason: "oauth_error" });
    }
  }

  // ── gviz path (public / Workspace "Anyone with the link") ──────────────────
  try {
    const gvizResp = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`, { cache: "no-store" });
    if (gvizResp.ok && !(gvizResp.headers.get("content-type") ?? "").includes("text/html")) {
      const ads = csvToAds(await gvizResp.text());
      if (ads.length === 0) return NextResponse.json({ synced: false, reason: "empty_sheet" });
      const result = await upsertManyAds(ads, "sheets");
      await writeSheetConfig({ ...config, lastSync: new Date().toISOString() });
      await detectAndQueueChanges(reason);
      triggerScheduledAlerts(APP_URL).catch(() => {});
      return NextResponse.json({ synced: true, ...result, total: ads.length });
    }
  } catch { /* fall through */ }

  return NextResponse.json({ synced: false, reason: "sheet_not_accessible" });
}
