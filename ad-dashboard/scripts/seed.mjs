/**
 * One-time seed script — fetches all ads from the external API and inserts
 * them into your Neon database.
 *
 * HOW TO RUN:
 *   1. Add your Neon connection string to .env.local:
 *        DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require
 *   2. From the ad-dashboard directory, run:
 *        node --env-file=.env.local scripts/seed.mjs
 */

import { neon } from "@neondatabase/serverless";

const EXTERNAL_API = "https://mosaicfellowship.in/api/data/content/ads";
const PAGE_SIZE    = 100;

if (!process.env.DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set. Add it to .env.local first.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

// ── Fetch all pages from external API ────────────────────────────────────────
async function fetchAllAds() {
  const ads   = [];
  let page    = 1;
  let hasNext = true;

  while (hasNext) {
    const res  = await fetch(`${EXTERNAL_API}?page=${page}&limit=${PAGE_SIZE}`);
    if (!res.ok) throw new Error(`API error at page ${page}: ${res.status}`);
    const body = await res.json();
    ads.push(...body.data);
    hasNext = body.pagination.has_next;
    console.log(`  Fetched page ${page}/${body.pagination.total_pages} — ${ads.length}/${body.pagination.total} ads`);
    page++;
  }

  return ads;
}

// ── Upsert a batch of ads ─────────────────────────────────────────────────────
async function upsertBatch(batch) {
  for (const ad of batch) {
    await sql`
      INSERT INTO ads (
        ad_id, platform, brand, category, ad_type, target_audience,
        creative_theme, status, start_date, days_running, spend,
        impressions, clicks, ctr, conversions, revenue, roas, cpc, cpa,
        creative_score, landing_page_score, frequency, video_completion_rate,
        source, updated_at
      ) VALUES (
        ${ad.ad_id},
        ${ad.platform        ?? "Unknown"},
        ${ad.brand           ?? "Unknown"},
        ${ad.category        ?? "Unknown"},
        ${ad.ad_type         ?? "Unknown"},
        ${ad.target_audience ?? "Unknown"},
        ${ad.creative_theme  ?? "Unknown"},
        ${ad.status          ?? "Active"},
        ${ad.start_date      ?? new Date().toISOString().split("T")[0]},
        ${ad.days_running    ?? 0},
        ${ad.spend           ?? 0},
        ${ad.impressions     ?? 0},
        ${ad.clicks          ?? 0},
        ${ad.ctr             ?? 0},
        ${ad.conversions     ?? 0},
        ${ad.revenue         ?? 0},
        ${ad.roas            ?? 0},
        ${ad.cpc             ?? 0},
        ${ad.cpa             ?? 0},
        ${ad.creative_score        ?? 0},
        ${ad.landing_page_score    ?? 0},
        ${ad.frequency             ?? 0},
        ${ad.video_completion_rate ?? null},
        ${"api"},
        ${new Date().toISOString()}
      )
      ON CONFLICT (ad_id) DO UPDATE SET
        platform            = EXCLUDED.platform,
        brand               = EXCLUDED.brand,
        category            = EXCLUDED.category,
        ad_type             = EXCLUDED.ad_type,
        target_audience     = EXCLUDED.target_audience,
        creative_theme      = EXCLUDED.creative_theme,
        status              = EXCLUDED.status,
        start_date          = EXCLUDED.start_date,
        days_running        = EXCLUDED.days_running,
        spend               = EXCLUDED.spend,
        impressions         = EXCLUDED.impressions,
        clicks              = EXCLUDED.clicks,
        ctr                 = EXCLUDED.ctr,
        conversions         = EXCLUDED.conversions,
        revenue             = EXCLUDED.revenue,
        roas                = EXCLUDED.roas,
        cpc                 = EXCLUDED.cpc,
        cpa                 = EXCLUDED.cpa,
        creative_score      = EXCLUDED.creative_score,
        landing_page_score  = EXCLUDED.landing_page_score,
        frequency           = EXCLUDED.frequency,
        video_completion_rate = EXCLUDED.video_completion_rate,
        updated_at          = EXCLUDED.updated_at
    `;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🔄  Fetching ads from external API...\n");
  const ads = await fetchAllAds();
  console.log(`\n✅  Fetched ${ads.length} ads total.\n`);

  console.log("📥  Inserting into Neon (batches of 50)...\n");
  const BATCH = 50;
  for (let i = 0; i < ads.length; i += BATCH) {
    const batch = ads.slice(i, i + BATCH);
    await upsertBatch(batch);
    console.log(`  Inserted ${Math.min(i + BATCH, ads.length)} / ${ads.length}`);
  }

  const [{ count }] = await sql`SELECT COUNT(*) AS count FROM ads`;
  console.log(`\n🎉  Done! Neon now has ${count} ads in the table.`);
}

main().catch(err => {
  console.error("❌  Seed failed:", err.message);
  process.exit(1);
});
