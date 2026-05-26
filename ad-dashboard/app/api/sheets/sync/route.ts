import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { readTokens, writeTokens, writeSheetConfig, upsertCustomAds } from "@/lib/customStore";
import { Ad } from "@/lib/types";

const REQUIRED_COLS = ["ad_id", "platform", "brand", "category", "ad_type",
  "target_audience", "creative_theme", "status", "start_date", "days_running", "spend"];

function extractSheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

function toAd(row: Record<string, string>): Ad {
  const now       = new Date();
  const startDate = row.start_date ? new Date(row.start_date) : now;
  const daysRunning = row.days_running
    ? Number(row.days_running)
    : Math.floor((now.getTime() - startDate.getTime()) / 86400000);

  return {
    ad_id:                row.ad_id?.trim()            ?? "",
    platform:             row.platform                 ?? "Unknown",
    brand:                row.brand                   ?? "Unknown",
    category:             row.category                ?? "Unknown",
    ad_type:              row.ad_type                 ?? "Unknown",
    target_audience:      row.target_audience         ?? "Unknown",
    creative_theme:       row.creative_theme          ?? "Unknown",
    status:               row.status                  ?? "Active",
    start_date:           row.start_date              ?? now.toISOString().split("T")[0],
    days_running:         daysRunning,
    spend:                Number(row.spend)            || 0,
    revenue:              Number(row.revenue)          || 0,
    roas:                 Number(row.roas)             || 0,
    impressions:          Number(row.impressions)      || 0,
    clicks:               Number(row.clicks)           || 0,
    ctr:                  Number(row.ctr)              || 0,
    conversions:          Number(row.conversions)      || 0,
    cpc:                  Number(row.cpc)              || 0,
    cpa:                  Number(row.cpa)              || 0,
    creative_score:       Number(row.creative_score)   || 0,
    landing_page_score:   Number(row.landing_page_score) || 0,
    frequency:            Number(row.frequency)        || 0,
    video_completion_rate: row.video_completion_rate != null && row.video_completion_rate !== ""
      ? Number(row.video_completion_rate) : null,
    _class: "TESTING" as const,
  } as Ad;
}

export async function POST(req: NextRequest) {
  try {
    const { sheetUrl } = await req.json() as { sheetUrl: string };
    if (!sheetUrl) return NextResponse.json({ error: "sheetUrl is required" }, { status: 400 });

    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) return NextResponse.json({
      error: "Invalid Google Sheets URL. Expected format: https://docs.google.com/spreadsheets/d/SHEET_ID/...",
    }, { status: 400 });

    const tokens = readTokens();

    // ── Strategy 1: authenticated Sheets API (private or public) ──────────────
    if (tokens && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      const APP_URL  = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const oauth2   = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${APP_URL}/api/sheets/callback`,
      );
      oauth2.setCredentials({
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date:   tokens.expiry_date,
      });

      // Refresh token silently if expired
      oauth2.on("tokens", t => {
        if (t.access_token) writeTokens({ ...tokens, access_token: t.access_token, expiry_date: t.expiry_date! });
      });

      const sheets   = google.sheets({ version: "v4", auth: oauth2 });
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range:         "A1:ZZ",
      });

      const rows = response.data.values ?? [];
      if (rows.length < 2) return NextResponse.json({ error: "Sheet is empty or has no data rows" }, { status: 400 });

      const headers = (rows[0] as string[]).map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
      const missing = REQUIRED_COLS.filter(c => !headers.includes(c));
      if (missing.length) return NextResponse.json({
        error: `Sheet is missing required columns: ${missing.join(", ")}. Download the sample template for the correct format.`,
      }, { status: 400 });

      const ads: Ad[] = [];
      const rowErrors: string[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] as string[];
        if (!row.some(Boolean)) continue;
        const record: Record<string, string> = {};
        headers.forEach((h, idx) => { record[h] = row[idx] ?? ""; });
        if (!record.ad_id) { rowErrors.push(`Row ${i + 1}: missing ad_id`); continue; }
        ads.push(toAd(record));
      }

      const result = upsertCustomAds(ads);
      writeSheetConfig({ sheetId, sheetName: sheetUrl, lastSync: new Date().toISOString() });

      return NextResponse.json({ success: true, ...result, errors: rowErrors, total: ads.length });
    }

    // ── Strategy 2: public CSV export (no auth) ────────────────────────────────
    const csvUrl  = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
    const csvResp = await fetch(csvUrl);
    if (!csvResp.ok) {
      return NextResponse.json({
        error: "Could not access the sheet. Make sure the sheet is public (Share → Anyone with the link → Viewer), or connect your Google account first.",
      }, { status: 403 });
    }

    const csvText = await csvResp.text();
    const lines   = csvText.split("\n").filter(l => l.trim());
    if (lines.length < 2) return NextResponse.json({ error: "Sheet is empty" }, { status: 400 });

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_").replace(/\s/g, ""));
    const missing = REQUIRED_COLS.filter(c => !headers.includes(c));
    if (missing.length) return NextResponse.json({
      error: `Sheet is missing required columns: ${missing.join(", ")}. Download the sample template for the correct format.`,
    }, { status: 400 });

    const ads: Ad[] = [];
    const rowErrors: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols   = lines[i].split(",").map(c => c.trim());
      const record: Record<string, string> = {};
      headers.forEach((h, idx) => { record[h] = cols[idx] ?? ""; });
      if (!record.ad_id) { rowErrors.push(`Row ${i + 1}: missing ad_id`); continue; }
      ads.push(toAd(record));
    }

    const result = upsertCustomAds(ads);
    writeSheetConfig({ sheetId, sheetName: sheetUrl, lastSync: new Date().toISOString() });
    return NextResponse.json({ success: true, ...result, errors: rowErrors, total: ads.length });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
