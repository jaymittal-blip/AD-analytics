import { Ad, ApiResponse, AdsApiResponse } from "./types";

const EXTERNAL_API = "https://mosaicfellowship.in/api/data/content/ads";
const BACKEND_URL  = process.env.ADS_API_URL;
const DATABASE_URL = process.env.DATABASE_URL;
const PAGE_SIZE    = 100;

async function fetchFromNeon(): Promise<Ad[]> {
  const { sql } = await import("./db");
  const rows = await sql`SELECT * FROM ads ORDER BY created_at DESC`;
  return rows.map(r => ({
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
  })) as Ad[];
}

async function fetchFromBackend(): Promise<Ad[]> {
  const res = await fetch(BACKEND_URL!, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Backend API error: ${res.status}`);
  const payload: AdsApiResponse = await res.json();
  return payload.ads;
}

async function fetchFromExternalApi(): Promise<Ad[]> {
  const ads: Ad[] = [];
  let page    = 1;
  let hasNext = true;

  while (hasNext) {
    const res = await fetch(
      `${EXTERNAL_API}?page=${page}&limit=${PAGE_SIZE}`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) throw new Error(`External API error at page ${page}: ${res.status}`);
    const payload: ApiResponse = await res.json();
    ads.push(...payload.data);
    hasNext = payload.pagination.has_next;
    page++;
  }

  return ads;
}

export async function fetchAllAds(): Promise<Ad[]> {
  // Priority: Neon DB > custom backend > external API
  if (DATABASE_URL) return fetchFromNeon();
  if (BACKEND_URL)  return fetchFromBackend();
  return fetchFromExternalApi();
}
