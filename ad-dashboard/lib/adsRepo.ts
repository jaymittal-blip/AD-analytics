import { Ad, AdClass } from "./types";

const EXTERNAL_API = "https://mosaicfellowship.in/api/data/content/ads";
const PAGE_SIZE    = 100;

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getAllAds(): Promise<Ad[]> {
  if (process.env.DATABASE_URL) {
    const { sql } = await import("./db");
    const rows = await sql`SELECT * FROM ads ORDER BY updated_at DESC`;
    return rows.map(rowToAd);
  }
  return fetchFromExternalApi();
}

export async function getAdById(ad_id: string): Promise<Ad | null> {
  if (!process.env.DATABASE_URL) return null;
  const { sql } = await import("./db");
  const rows = await sql`SELECT * FROM ads WHERE ad_id = ${ad_id}`;
  return rows.length ? rowToAd(rows[0] as Record<string, unknown>) : null;
}

/** Distinct field values — used to populate dropdowns dynamically from real data */
export async function getDistinctValues() {
  if (process.env.DATABASE_URL) {
    const { sql } = await import("./db");
    const [platforms, adTypes, brands, categories, themes, audiences] = await Promise.all([
      sql`SELECT DISTINCT platform        FROM ads WHERE platform        IS NOT NULL AND platform        <> 'Unknown' ORDER BY platform`,
      sql`SELECT DISTINCT ad_type         FROM ads WHERE ad_type         IS NOT NULL AND ad_type         <> 'Unknown' ORDER BY ad_type`,
      sql`SELECT DISTINCT brand           FROM ads WHERE brand           IS NOT NULL AND brand           <> 'Unknown' ORDER BY brand`,
      sql`SELECT DISTINCT category        FROM ads WHERE category        IS NOT NULL AND category        <> 'Unknown' ORDER BY category`,
      sql`SELECT DISTINCT creative_theme  FROM ads WHERE creative_theme  IS NOT NULL AND creative_theme  <> 'Unknown' ORDER BY creative_theme`,
      sql`SELECT DISTINCT target_audience FROM ads WHERE target_audience IS NOT NULL AND target_audience <> 'Unknown' ORDER BY target_audience`,
    ]);
    return {
      platforms:  platforms.map(r  => String(r.platform)),
      adTypes:    adTypes.map(r    => String(r.ad_type)),
      brands:     brands.map(r     => String(r.brand)),
      categories: categories.map(r => String(r.category)),
      themes:     themes.map(r     => String(r.creative_theme)),
      audiences:  audiences.map(r  => String(r.target_audience)),
    };
  }
  // Static fallback for local dev without a DB
  return {
    platforms:  ["YouTube", "Meta", "Google", "Instagram", "TikTok", "X (Twitter)"],
    adTypes:    ["Video Reel", "Static Carousel", "Image Post", "Story", "Search Ad", "Display Ad"],
    brands:     [],
    categories: [],
    themes:     [],
    audiences:  [],
  };
}

// ── Write ─────────────────────────────────────────────────────────────────────

export type AdSource = "manual" | "csv" | "sheets" | "api";

export async function upsertAd(
  ad: Ad,
  source: AdSource = "manual"
): Promise<{ added: number; updated: number }> {
  if (process.env.DATABASE_URL) {
    const { sql } = await import("./db");
    const existing = await sql`SELECT ad_id FROM ads WHERE ad_id = ${ad.ad_id}`;
    await sql`
      INSERT INTO ads (
        ad_id, platform, brand, category, ad_type, target_audience,
        creative_theme, status, start_date, days_running, spend,
        impressions, clicks, ctr, conversions, revenue, roas, cpc, cpa,
        creative_score, landing_page_score, frequency, video_completion_rate,
        landing_page, product_name, source, updated_at
      ) VALUES (
        ${ad.ad_id},          ${ad.platform},         ${ad.brand},
        ${ad.category},       ${ad.ad_type},           ${ad.target_audience},
        ${ad.creative_theme}, ${ad.status},            ${ad.start_date},
        ${ad.days_running},   ${ad.spend},             ${ad.impressions},
        ${ad.clicks},         ${ad.ctr},               ${ad.conversions},
        ${ad.revenue},        ${ad.roas},              ${ad.cpc},
        ${ad.cpa},            ${ad.creative_score},    ${ad.landing_page_score},
        ${ad.frequency},      ${ad.video_completion_rate ?? null},
        ${ad.landing_page ?? null}, ${ad.product_name ?? null},
        ${source},            ${new Date().toISOString()}
      )
      ON CONFLICT (ad_id) DO UPDATE SET
        platform              = EXCLUDED.platform,
        brand                 = EXCLUDED.brand,
        category              = EXCLUDED.category,
        ad_type               = EXCLUDED.ad_type,
        target_audience       = EXCLUDED.target_audience,
        creative_theme        = EXCLUDED.creative_theme,
        status                = EXCLUDED.status,
        start_date            = EXCLUDED.start_date,
        days_running          = EXCLUDED.days_running,
        spend                 = EXCLUDED.spend,
        impressions           = EXCLUDED.impressions,
        clicks                = EXCLUDED.clicks,
        ctr                   = EXCLUDED.ctr,
        conversions           = EXCLUDED.conversions,
        revenue               = EXCLUDED.revenue,
        roas                  = EXCLUDED.roas,
        cpc                   = EXCLUDED.cpc,
        cpa                   = EXCLUDED.cpa,
        creative_score        = EXCLUDED.creative_score,
        landing_page_score    = EXCLUDED.landing_page_score,
        frequency             = EXCLUDED.frequency,
        video_completion_rate = EXCLUDED.video_completion_rate,
        landing_page          = EXCLUDED.landing_page,
        product_name          = EXCLUDED.product_name,
        source                = EXCLUDED.source,
        updated_at            = EXCLUDED.updated_at
    `;
    return existing.length ? { added: 0, updated: 1 } : { added: 1, updated: 0 };
  }

  // JSON file fallback (local dev without DB)
  const { upsertCustomAds } = await import("./customStore");
  return upsertCustomAds([ad], source);
}

export async function upsertManyAds(
  ads: Ad[],
  source: AdSource = "manual"
): Promise<{ added: number; updated: number }> {
  let added = 0, updated = 0;
  for (const ad of ads) {
    const r = await upsertAd(ad, source);
    added   += r.added;
    updated += r.updated;
  }
  return { added, updated };
}

export async function deleteAd(ad_id: string): Promise<void> {
  if (process.env.DATABASE_URL) {
    const { sql } = await import("./db");
    await sql`DELETE FROM ads WHERE ad_id = ${ad_id}`;
    return;
  }
  const { deleteCustomAd } = await import("./customStore");
  await deleteCustomAd(ad_id);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function fetchFromExternalApi(): Promise<Ad[]> {
  // Page 1 first — needed to discover total_pages from pagination
  const first = await fetch(`${EXTERNAL_API}?page=1&limit=${PAGE_SIZE}`, { cache: "no-store" });
  if (!first.ok) throw new Error(`External API error on page 1: ${first.status}`);
  const firstBody = await first.json();
  const ads: Ad[] = [...firstBody.data];
  const totalPages: number = firstBody.pagination?.total_pages ?? 1;

  // Fetch remaining pages in parallel — all at once instead of sequentially
  if (totalPages > 1) {
    const rest = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        fetch(`${EXTERNAL_API}?page=${i + 2}&limit=${PAGE_SIZE}`, { cache: "no-store" })
          .then(r => r.json())
          .then(body => body.data as Ad[])
      )
    );
    ads.push(...rest.flat());
  }

  return ads;
}

export function rowToAd(r: Record<string, unknown>): Ad {
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
    video_completion_rate: r.video_completion_rate != null
      ? Number(r.video_completion_rate) : null,
    landing_page:  r.landing_page  != null ? String(r.landing_page)  : null,
    product_name:  r.product_name  != null ? String(r.product_name)  : null,
    _class: "TESTING",
  } as Ad;
}
