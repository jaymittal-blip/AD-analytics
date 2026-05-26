import { NextRequest, NextResponse } from "next/server";
import { getAllAds, upsertAd } from "@/lib/adsRepo";
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

    if (!body.ad_id?.trim()) return NextResponse.json({ error: "ad_id is required"   }, { status: 400 });
    if (!body.platform)      return NextResponse.json({ error: "platform is required" }, { status: 400 });
    if (!body.brand)         return NextResponse.json({ error: "brand is required"    }, { status: 400 });
    if (body.spend == null)  return NextResponse.json({ error: "spend is required"    }, { status: 400 });

    const now         = new Date();
    const startDate   = body.start_date ? new Date(body.start_date) : now;
    const daysRunning = body.days_running ??
      Math.floor((now.getTime() - startDate.getTime()) / 86400000);

    const ad: Ad = {
      ad_id:               body.ad_id.trim(),
      platform:            body.platform,
      brand:               body.brand,
      category:            body.category           ?? "Unknown",
      ad_type:             body.ad_type            ?? "Unknown",
      target_audience:     body.target_audience    ?? "Unknown",
      creative_theme:      body.creative_theme     ?? "Unknown",
      status:              body.status             ?? "Active",
      start_date:          body.start_date         ?? now.toISOString().split("T")[0],
      days_running:        daysRunning,
      spend:               Number(body.spend)      || 0,
      revenue:             Number(body.revenue     ?? 0),
      roas:                Number(body.roas        ?? 0),
      impressions:         Number(body.impressions ?? 0),
      clicks:              Number(body.clicks      ?? 0),
      ctr:                 Number(body.ctr         ?? 0),
      conversions:         Number(body.conversions ?? 0),
      cpc:                 Number(body.cpc         ?? 0),
      cpa:                 Number(body.cpa         ?? 0),
      creative_score:      Number(body.creative_score     ?? 0),
      landing_page_score:  Number(body.landing_page_score ?? 0),
      frequency:           Number(body.frequency          ?? 0),
      video_completion_rate: body.video_completion_rate != null
        ? Number(body.video_completion_rate) : null,
      _class: "TESTING" as const,
    };

    const result = await upsertAd(ad, "manual");
    return NextResponse.json({ success: true, ad, ...result });
  } catch (err) {
    console.error("[POST /api/ads]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
