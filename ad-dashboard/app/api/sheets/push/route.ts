/**
 * POST /api/sheets/push
 * Receives data pushed from a Google Apps Script running inside the Google Sheet.
 * No OAuth needed — the script runs as the sheet owner and pushes rows to this endpoint.
 *
 * Expected body:
 *   { secret: string; rows: Record<string, string>[] }
 *
 * The secret is a shared value set as PUSH_SECRET in .env.local and in the Apps Script.
 */
import { NextRequest, NextResponse } from "next/server";
import { upsertManyAds } from "@/lib/adsRepo";
import { writeSheetConfig } from "@/lib/customStore";
import { Ad } from "@/lib/types";

export const dynamic = "force-dynamic";

function toAd(row: Record<string, string>): Ad | null {
  const adId = row.ad_id?.trim();
  if (!adId) return null;

  const now        = new Date();
  const startDate  = row.start_date ? new Date(row.start_date) : now;
  const daysRunning = row.days_running
    ? Number(row.days_running)
    : Math.floor((now.getTime() - startDate.getTime()) / 86400000);

  return {
    ad_id:                adId,
    platform:             row.platform             ?? "Unknown",
    brand:                row.brand                ?? "Unknown",
    category:             row.category             ?? "Unknown",
    ad_type:              row.ad_type              ?? "Unknown",
    target_audience:      row.target_audience      ?? "Unknown",
    creative_theme:       row.creative_theme       ?? "Unknown",
    status:               row.status               ?? "Active",
    start_date:           row.start_date           ?? now.toISOString().split("T")[0],
    days_running:         daysRunning,
    spend:                Number(row.spend)         || 0,
    revenue:              Number(row.revenue)       || 0,
    roas:                 Number(row.roas)          || 0,
    impressions:          Number(row.impressions)   || 0,
    clicks:               Number(row.clicks)        || 0,
    ctr:                  Number(row.ctr)           || 0,
    conversions:          Number(row.conversions)   || 0,
    cpc:                  Number(row.cpc)           || 0,
    cpa:                  Number(row.cpa)           || 0,
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { secret?: string; rows?: Record<string, string>[] };

    // Validate shared secret
    const expected = process.env.PUSH_SECRET;
    if (!expected) {
      return NextResponse.json({ error: "PUSH_SECRET not configured on server" }, { status: 503 });
    }
    if (body.secret !== expected) {
      return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
    }

    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json({ error: "rows array is required and must not be empty" }, { status: 400 });
    }

    const ads: Ad[] = [];
    const skipped: number[] = [];
    body.rows.forEach((row, i) => {
      const ad = toAd(row);
      if (ad) ads.push(ad);
      else skipped.push(i + 2);
    });

    const result = await upsertManyAds(ads, "sheets");
    await writeSheetConfig({ sheetId: "apps-script", sheetName: "Google Sheets (Apps Script)", lastSync: new Date().toISOString() });

    return NextResponse.json({ success: true, ...result, total: ads.length, skipped });
  } catch (err) {
    console.error("[POST /api/sheets/push]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
