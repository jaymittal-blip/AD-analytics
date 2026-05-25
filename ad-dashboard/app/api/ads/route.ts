import { NextResponse } from "next/server";
import { fetchAllAds } from "@/lib/fetchAds";
import { analyzeAds } from "@/lib/analyzer";

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/ads
//
// Returns all analyzed ads. The data source is controlled by ADS_API_URL:
//   - Not set → paginates through the external API
//   - Set     → single call to your Node.js backend
//
// This route is the abstraction layer: swap the env var, not the frontend code.
// ──────────────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const raw  = await fetchAllAds();
    const ads  = analyzeAds(raw);
    return NextResponse.json({ ads, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error("[/api/ads]", err);
    return NextResponse.json({ error: "Failed to fetch ad data" }, { status: 500 });
  }
}
