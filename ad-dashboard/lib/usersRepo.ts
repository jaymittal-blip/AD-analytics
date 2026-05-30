import { neon } from "@neondatabase/serverless";

function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  return neon(process.env.DATABASE_URL);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReportUser {
  id:               number;
  email:            string;
  is_active:        boolean;
  schedule:         "daily" | "weekly" | "monthly";
  send_hour:        number;
  send_day_of_week: number;
  send_day_of_month: number;
  categories:       string[];
  last_sent_at:     string | null;
  created_at:       string;
}

export interface AlertRecipient {
  id:               number;
  email:            string;
  is_active:        boolean;
  schedule:         "instant" | "daily" | "weekly" | "monthly";
  send_hour:        number;
  send_day_of_week: number;
  send_day_of_month: number;
  last_sent_at:     string | null;
  created_at:       string;
}

export interface CategoryChange {
  id:            number;
  ad_id:         string;
  from_class:    string | null;
  to_class:      string;
  change_reason: "metrics" | "criteria";
  ad_data:       Record<string, unknown>;
  changed_at:    string;
  sent_instant:  boolean;
  sent_daily:    boolean;
  sent_weekly:   boolean;
  sent_monthly:  boolean;
}

// ── Report Users ──────────────────────────────────────────────────────────────

export async function getReportUsers(): Promise<ReportUser[]> {
  const sql = db();
  const rows = await sql`SELECT * FROM users WHERE is_active = TRUE ORDER BY created_at DESC`;
  return rows.map(r => ({
    ...r,
    categories: String(r.categories).split(",").filter(Boolean),
  })) as ReportUser[];
}

export async function addReportUser(
  email: string,
  opts: Partial<Omit<ReportUser, "id" | "email" | "created_at">> = {}
): Promise<ReportUser> {
  const sql = db();
  const cats = (opts.categories ?? ["kill","scale","monitor","testing"]).join(",");
  const [row] = await sql`
    INSERT INTO users (email, schedule, send_hour, send_day_of_week, send_day_of_month, categories)
    VALUES (
      ${email},
      ${opts.schedule ?? "daily"},
      ${opts.send_hour ?? 9},
      ${opts.send_day_of_week ?? 1},
      ${opts.send_day_of_month ?? 1},
      ${cats}
    )
    ON CONFLICT (email) DO UPDATE SET
      is_active = TRUE,
      schedule  = EXCLUDED.schedule,
      send_hour = EXCLUDED.send_hour,
      send_day_of_week  = EXCLUDED.send_day_of_week,
      send_day_of_month = EXCLUDED.send_day_of_month,
      categories  = EXCLUDED.categories,
      updated_at  = NOW()
    RETURNING *
  `;
  return { ...row, categories: String(row.categories).split(",").filter(Boolean) } as ReportUser;
}

export async function updateReportUser(id: number, patch: Partial<ReportUser>): Promise<void> {
  const sql = db();
  const cats = patch.categories ? patch.categories.join(",") : undefined;
  await sql`
    UPDATE users SET
      is_active         = COALESCE(${patch.is_active  ?? null}, is_active),
      schedule          = COALESCE(${patch.schedule   ?? null}, schedule),
      send_hour         = COALESCE(${patch.send_hour  ?? null}, send_hour),
      send_day_of_week  = COALESCE(${patch.send_day_of_week  ?? null}, send_day_of_week),
      send_day_of_month = COALESCE(${patch.send_day_of_month ?? null}, send_day_of_month),
      categories        = COALESCE(${cats ?? null}, categories),
      last_sent_at      = COALESCE(${patch.last_sent_at ?? null}, last_sent_at),
      updated_at        = NOW()
    WHERE id = ${id}
  `;
}

export async function softDeleteReportUser(id: number): Promise<void> {
  const sql = db();
  await sql`UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = ${id}`;
}

// ── Alert Recipients ──────────────────────────────────────────────────────────

export async function getAlertRecipients(): Promise<AlertRecipient[]> {
  const sql = db();
  const rows = await sql`SELECT * FROM alert_recipients WHERE is_active = TRUE ORDER BY created_at DESC`;
  return rows as AlertRecipient[];
}

export async function addAlertRecipient(
  email: string,
  opts: Partial<Omit<AlertRecipient, "id" | "email" | "created_at">> = {}
): Promise<AlertRecipient> {
  const sql = db();
  const [row] = await sql`
    INSERT INTO alert_recipients (email, schedule, send_hour, send_day_of_week, send_day_of_month)
    VALUES (
      ${email},
      ${opts.schedule ?? "instant"},
      ${opts.send_hour ?? 9},
      ${opts.send_day_of_week ?? 1},
      ${opts.send_day_of_month ?? 1}
    )
    ON CONFLICT (email) DO UPDATE SET
      is_active = TRUE,
      schedule  = EXCLUDED.schedule,
      send_hour = EXCLUDED.send_hour,
      send_day_of_week  = EXCLUDED.send_day_of_week,
      send_day_of_month = EXCLUDED.send_day_of_month,
      updated_at        = NOW()
    RETURNING *
  `;
  return row as AlertRecipient;
}

export async function updateAlertRecipient(id: number, patch: Partial<AlertRecipient>): Promise<void> {
  const sql = db();
  await sql`
    UPDATE alert_recipients SET
      is_active         = COALESCE(${patch.is_active  ?? null}, is_active),
      schedule          = COALESCE(${patch.schedule   ?? null}, schedule),
      send_hour         = COALESCE(${patch.send_hour  ?? null}, send_hour),
      send_day_of_week  = COALESCE(${patch.send_day_of_week  ?? null}, send_day_of_week),
      send_day_of_month = COALESCE(${patch.send_day_of_month ?? null}, send_day_of_month),
      last_sent_at      = COALESCE(${patch.last_sent_at ?? null}, last_sent_at),
      updated_at        = NOW()
    WHERE id = ${id}
  `;
}

export async function softDeleteAlertRecipient(id: number): Promise<void> {
  const sql = db();
  await sql`UPDATE alert_recipients SET is_active = FALSE, updated_at = NOW() WHERE id = ${id}`;
}

// ── Category Changes ──────────────────────────────────────────────────────────

export async function recordCategoryChanges(
  changes: Array<{ ad_id: string; from_class: string | null; to_class: string; change_reason: "metrics" | "criteria"; ad_data: Record<string, unknown> }>
): Promise<void> {
  if (!changes.length) return;
  const sql = db();
  for (const c of changes) {
    await sql`
      INSERT INTO category_changes (ad_id, from_class, to_class, change_reason, ad_data)
      VALUES (${c.ad_id}, ${c.from_class}, ${c.to_class}, ${c.change_reason}, ${JSON.stringify(c.ad_data)})
    `;
  }
}

export async function getUnsentChanges(schedule: "instant" | "daily" | "weekly" | "monthly"): Promise<CategoryChange[]> {
  const sql = db();
  const col = `sent_${schedule}` as const;
  const rows = schedule === "instant"
    ? await sql`SELECT * FROM category_changes WHERE sent_instant  = FALSE ORDER BY changed_at`
    : schedule === "daily"
    ? await sql`SELECT * FROM category_changes WHERE sent_daily    = FALSE ORDER BY changed_at`
    : schedule === "weekly"
    ? await sql`SELECT * FROM category_changes WHERE sent_weekly   = FALSE ORDER BY changed_at`
    : await sql`SELECT * FROM category_changes WHERE sent_monthly  = FALSE ORDER BY changed_at`;
  void col;
  return rows as CategoryChange[];
}

export async function markChangesSent(ids: number[], schedule: "instant" | "daily" | "weekly" | "monthly"): Promise<void> {
  if (!ids.length) return;
  const sql = db();
  if (schedule === "instant") {
    await sql`UPDATE category_changes SET sent_instant = TRUE WHERE id = ANY(${ids})`;
  } else if (schedule === "daily") {
    await sql`UPDATE category_changes SET sent_daily   = TRUE WHERE id = ANY(${ids})`;
  } else if (schedule === "weekly") {
    await sql`UPDATE category_changes SET sent_weekly  = TRUE WHERE id = ANY(${ids})`;
  } else {
    await sql`UPDATE category_changes SET sent_monthly = TRUE WHERE id = ANY(${ids})`;
  }
}

// ── App Settings (criteria storage) ──────────────────────────────────────────

export async function getAppSetting<T>(key: string): Promise<T | null> {
  const sql = db();
  const rows = await sql`SELECT value FROM app_settings WHERE key = ${key}`;
  if (!rows.length) return null;
  const raw = rows[0].value;
  if (raw === null || raw === undefined) return null;
  // Handle TEXT columns (returns string) and JSONB columns (returns parsed object)
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
  }
  return raw as T;
}

export async function setAppSetting(key: string, value: unknown): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO app_settings (key, value) VALUES (${key}, ${JSON.stringify(value)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
}
