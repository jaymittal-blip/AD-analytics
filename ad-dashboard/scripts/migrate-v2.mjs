import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log("Running v2 migration…");

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id              SERIAL PRIMARY KEY,
      email           TEXT UNIQUE NOT NULL,
      is_active       BOOLEAN DEFAULT TRUE,
      schedule        TEXT NOT NULL DEFAULT 'daily',
      send_hour       INTEGER DEFAULT 9,
      send_day_of_week  INTEGER DEFAULT 1,
      send_day_of_month INTEGER DEFAULT 1,
      categories      TEXT NOT NULL DEFAULT 'kill,scale,monitor,testing',
      last_sent_at    TIMESTAMPTZ DEFAULT NULL,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("✓ users table");

  await sql`
    CREATE TABLE IF NOT EXISTS alert_recipients (
      id              SERIAL PRIMARY KEY,
      email           TEXT UNIQUE NOT NULL,
      is_active       BOOLEAN DEFAULT TRUE,
      schedule        TEXT NOT NULL DEFAULT 'instant',
      send_hour       INTEGER DEFAULT 9,
      send_day_of_week  INTEGER DEFAULT 1,
      send_day_of_month INTEGER DEFAULT 1,
      last_sent_at    TIMESTAMPTZ DEFAULT NULL,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("✓ alert_recipients table");

  await sql`
    CREATE TABLE IF NOT EXISTS category_changes (
      id            SERIAL PRIMARY KEY,
      ad_id         TEXT NOT NULL,
      from_class    TEXT,
      to_class      TEXT NOT NULL,
      change_reason TEXT NOT NULL DEFAULT 'metrics',
      ad_data       JSONB,
      changed_at    TIMESTAMPTZ DEFAULT NOW(),
      sent_instant  BOOLEAN DEFAULT FALSE,
      sent_daily    BOOLEAN DEFAULT FALSE,
      sent_weekly   BOOLEAN DEFAULT FALSE,
      sent_monthly  BOOLEAN DEFAULT FALSE
    )
  `;
  console.log("✓ category_changes table");

  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key        TEXT PRIMARY KEY,
      value      JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("✓ app_settings table");

  await sql`ALTER TABLE ads ADD COLUMN IF NOT EXISTS last_class TEXT`;
  console.log("✓ ads.last_class column");

  await sql`ALTER TABLE ads ADD COLUMN IF NOT EXISTS landing_page TEXT`;
  console.log("✓ ads.landing_page column");

  await sql`ALTER TABLE ads ADD COLUMN IF NOT EXISTS product_name TEXT`;
  console.log("✓ ads.product_name column");

  console.log("\nMigration complete.");
}

run().catch(e => { console.error(e); process.exit(1); });
