import { Ad, ApiResponse, AdsApiResponse } from "./types";

// ──────────────────────────────────────────────────────────────────────────────
// Data source configuration
//
// Default (no env var): paginates through the external API directly.
//
// To integrate a Node.js backend, set ADS_API_URL to your backend endpoint:
//   ADS_API_URL=http://localhost:4000/api/ads
//
// The backend should return: { ads: Ad[], fetchedAt: string }
// ──────────────────────────────────────────────────────────────────────────────
const EXTERNAL_API = "https://mosaicfellowship.in/api/data/content/ads";
const BACKEND_URL  = process.env.ADS_API_URL;
const PAGE_SIZE    = 100;

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
  const external = await (BACKEND_URL ? fetchFromBackend() : fetchFromExternalApi());

  // Merge custom-added ads — custom overrides external by ad_id
  let custom: Ad[] = [];
  try {
    const { readCustomAds } = await import("./customStore");
    custom = readCustomAds();
  } catch { /* file may not exist in some environments */ }

  if (!custom.length) return external;
  const map = new Map(external.map(a => [a.ad_id, a]));
  custom.forEach(a => map.set(a.ad_id, a));
  return [...map.values()];
}
