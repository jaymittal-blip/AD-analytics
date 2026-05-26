import { NextRequest, NextResponse } from "next/server";
import { getAllAds, getAdById, upsertAd } from "@/lib/adsRepo";
import { Ad } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ads = await getAllAds();
    return NextResponse.json({ ads, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error("[GET /api/ads]", err);
    return NextResponse.json({ error: "Failed to fetch ads" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<Ad> & { product?: string; landing_page?: string };

    if (!body.ad_id?.trim()) return NextResponse.json({ error: "ad_id is required" }, { status: 400 });
    if (!body.brand)         return NextResponse.json({ error: "brand is required"  }, { status: 400 });

    const adId = body.ad_id.trim();

    // Fetch existing record so partial updates (CSV) don't overwrite unrelated fields
    const existing = await getAdById(adId);

    const now         = new Date();
    const startDate   = body.start_date ? new Date(body.start_date) : now;
    const daysRunning = body.days_running ??
      existing?.days_running ??
      Math.floor((now.getTime() - startDate.getTime()) / 86400000);

    // Merge: existing values are the base; body overrides only what was provided
    const ad: Ad = {
      ad_id:               adId,
      platform:            body.platform            ?? existing?.platform            ?? "Unknown",
      brand:               body.brand,
      category:            body.category            ?? existing?.category            ?? "Unknown",
      ad_type:             body.ad_type             ?? existing?.ad_type             ?? "Unknown",
      target_audience:     body.target_audience     ?? existing?.target_audience     ?? "Unknown",
      creative_theme:      body.creative_theme      ?? existing?.creative_theme      ?? "Unknown",
      status:              body.status              ?? existing?.status              ?? "Active",
      start_date:          body.start_date          ?? existing?.start_date          ?? now.toISOString().split("T")[0],
      days_running:        daysRunning,
      spend:               body.spend    != null    ? Number(body.spend)             : (existing?.spend               ?? 0),
      revenue:             body.revenue  != null    ? Number(body.revenue)           : (existing?.revenue             ?? 0),
      roas:                body.roas     != null    ? Number(body.roas)              : (existing?.roas                ?? 0),
      impressions:         body.impressions != null ? Number(body.impressions)       : (existing?.impressions         ?? 0),
      clicks:              body.clicks   != null    ? Number(body.clicks)            : (existing?.clicks              ?? 0),
      ctr:                 body.ctr      != null    ? Number(body.ctr)               : (existing?.ctr                 ?? 0),
      conversions:         body.conversions != null ? Number(body.conversions)       : (existing?.conversions         ?? 0),
      cpc:                 body.cpc      != null    ? Number(body.cpc)               : (existing?.cpc                 ?? 0),
      cpa:                 body.cpa      != null    ? Number(body.cpa)               : (existing?.cpa                 ?? 0),
      creative_score:      body.creative_score      != null ? Number(body.creative_score)      : (existing?.creative_score      ?? 0),
      landing_page_score:  body.landing_page_score  != null ? Number(body.landing_page_score)  : (existing?.landing_page_score  ?? 0),
      frequency:           body.frequency           != null ? Number(body.frequency)           : (existing?.frequency           ?? 0),
      video_completion_rate: body.video_completion_rate != null
        ? Number(body.video_completion_rate)
        : (existing?.video_completion_rate ?? null),
      _class: "TESTING" as const,
    };

    const result = await upsertAd(ad, "manual");
    return NextResponse.json({ success: true, ad, ...result });
  } catch (err) {
    console.error("[POST /api/ads]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
