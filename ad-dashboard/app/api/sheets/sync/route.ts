import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { readTokens, writeTokens, writeSheetConfig } from "@/lib/customStore";
import { upsertManyAds } from "@/lib/adsRepo";
import { Ad } from "@/lib/types";

export const dynamic = "force-dynamic";

function extractSheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

function extractGid(url: string): string {
  const m = url.match(/[?&#]gid=(\d+)/);
  return m ? m[1] : "0";
}

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
    ad_id:                row.ad_id?.trim()               ?? "",
    platform:             row.platform                    ?? "Unknown",
    brand:                row.brand                       ?? "Unknown",
    category:             row.category                    ?? "Unknown",
    ad_type:              row.ad_type                     ?? "Unknown",
    target_audience:      row.target_audience             ?? "Unknown",
    creative_theme:       row.creative_theme              ?? "Unknown",
    status:               row.status                      ?? "Active",
    start_date:           row.start_date                  ?? now.toISOString().split("T")[0],
    days_running:         daysRunning,
    spend:                Number(row.spend)               || 0,
    revenue:              Number(row.revenue)             || 0,
    roas:                 Number(row.roas)                || 0,
    impressions:          Number(row.impressions)         || 0,
    clicks:               Number(row.clicks)              || 0,
    ctr:                  Number(row.ctr)                 || 0,
    conversions:          Number(row.conversions)         || 0,
    cpc:                  Number(row.cpc)                 || 0,
    cpa:                  Number(row.cpa)                 || 0,
    creative_score:       Number(row.creative_score)      || 0,
    landing_page_score:   Number(row.landing_page_score)  || 0,
    frequency:            Number(row.frequency)           || 0,
    video_completion_rate: row.video_completion_rate != null && row.video_completion_rate !== ""
      ? Number(row.video_completion_rate) : null,
    landing_page: row.landing_page?.trim() || null,
    product_name: row.product_name?.trim() || null,
    _class: "TESTING",
  } as Ad;
}

function parseCSVToAds(csvText: string): { ads: Ad[]; rowErrors: string[] } {
  const lines = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
  if (lines.length < 2) return { ads: [], rowErrors: ["Sheet is empty"] };

  const headers = parseCSVRow(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));

  const ads: Ad[] = [];
  const rowErrors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVRow(lines[i]);
    if (cols.every(c => !c.trim())) continue;
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) record[h] = (cols[idx] ?? "").trim();
    });
    if (!record.ad_id) { rowErrors.push(`Row ${i + 1}: missing ad_id`); continue; }
    ads.push(toAd(record));
  }

  return { ads, rowErrors };
}

export async function POST(req: NextRequest) {
  try {
    const { sheetUrl } = await req.json() as { sheetUrl: string };
    if (!sheetUrl) return NextResponse.json({ error: "sheetUrl is required" }, { status: 400 });

    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) return NextResponse.json({
      error: "Invalid Google Sheets URL. Expected: https://docs.google.com/spreadsheets/d/SHEET_ID/...",
    }, { status: 400 });
    const gid = extractGid(sheetUrl);

    const tokens = await readTokens();
    if (tokens && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
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
      if (rows.length < 2) return NextResponse.json({ error: "Sheet is empty or has no data rows" }, { status: 400 });

      const headers = (rows[0] as string[]).map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
      const ads: Ad[] = [];
      const rowErrors: string[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] as string[];
        if (!row.some(Boolean)) continue;
        const record: Record<string, string> = {};
        headers.forEach((h, idx) => { if (h) record[h] = row[idx] ?? ""; });
        if (!record.ad_id) { rowErrors.push(`Row ${i + 1}: missing ad_id`); continue; }
        ads.push(toAd(record));
      }
      const result = await upsertManyAds(ads, "sheets");
      const cfg = { sheetId, sheetName: sheetUrl, lastSync: new Date().toISOString() };
      await writeSheetConfig(cfg);
      return NextResponse.json({ success: true, ...result, errors: rowErrors, total: ads.length });
    }

    // gviz works for Workspace "Anyone with the link" sheets where /export is blocked
    const gvizUrl  = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
    const gvizResp = await fetch(gvizUrl, { cache: "no-store" });

    if (gvizResp.ok) {
      const contentType = gvizResp.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html")) {
        const csvText = await gvizResp.text();
        const { ads, rowErrors } = parseCSVToAds(csvText);
        if (ads.length === 0) return NextResponse.json({ error: "No valid rows found. Make sure the sheet has an ad_id column." }, { status: 400 });
        const result = await upsertManyAds(ads, "sheets");
        await writeSheetConfig({ sheetId, sheetName: sheetUrl, lastSync: new Date().toISOString() });
        return NextResponse.json({ success: true, ...result, errors: rowErrors, total: ads.length });
      }
    }

    const csvUrl  = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    const csvResp = await fetch(csvUrl, { cache: "no-store" });
    if (!csvResp.ok || (csvResp.headers.get("content-type") ?? "").includes("text/html")) {
      return NextResponse.json({
        error: "Could not access the sheet. Open the sheet, click Share, set access to Anyone with the link (Viewer), then try again.",
      }, { status: 403 });
    }

    const csvText = await csvResp.text();
    const { ads, rowErrors } = parseCSVToAds(csvText);
    if (ads.length === 0) return NextResponse.json({ error: "No valid rows found. Make sure the sheet has an ad_id column." }, { status: 400 });
    const result = await upsertManyAds(ads, "sheets");
    await writeSheetConfig({ sheetId, sheetName: sheetUrl, lastSync: new Date().toISOString() });
    return NextResponse.json({ success: true, ...result, errors: rowErrors, total: ads.length });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
