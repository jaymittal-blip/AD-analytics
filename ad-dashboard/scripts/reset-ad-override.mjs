import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf8");
const dbUrl = envContent.match(/DATABASE_URL=(.+)/)?.[1]?.trim();
if (!dbUrl) { console.error("DATABASE_URL not found"); process.exit(1); }

const sql = neon(dbUrl);
const AD_ID = "AD-0072";

const rows = await sql`SELECT value FROM app_settings WHERE key = 'ad_status_overrides' LIMIT 1`;
if (!rows.length || !rows[0].value) {
  console.log("No overrides found — AD-0072 is already in Scale category.");
  process.exit(0);
}

const overrides = rows[0].value;
console.log("Current overrides:", JSON.stringify(overrides));

if (!overrides[AD_ID]) {
  console.log(`${AD_ID} has no override — already in Scale category.`);
  process.exit(0);
}

delete overrides[AD_ID];
await sql`UPDATE app_settings SET value = ${JSON.stringify(overrides)}::jsonb WHERE key = 'ad_status_overrides'`;
console.log(`✓ Removed override for ${AD_ID}. Remaining:`, JSON.stringify(overrides));
