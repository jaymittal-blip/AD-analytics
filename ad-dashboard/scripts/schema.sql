-- Run this once in Neon SQL Editor to create the ads table
-- Go to: console.neon.tech → SQL Editor → paste this → Run

CREATE TABLE IF NOT EXISTS ads (
  ad_id               TEXT        PRIMARY KEY,
  platform            TEXT        NOT NULL DEFAULT 'Unknown',
  brand               TEXT        NOT NULL DEFAULT 'Unknown',
  category            TEXT        NOT NULL DEFAULT 'Unknown',
  ad_type             TEXT        NOT NULL DEFAULT 'Unknown',
  target_audience     TEXT        NOT NULL DEFAULT 'Unknown',
  creative_theme      TEXT        NOT NULL DEFAULT 'Unknown',
  status              TEXT        NOT NULL DEFAULT 'Active',
  start_date          TEXT        NOT NULL,
  days_running        INTEGER     NOT NULL DEFAULT 0,
  spend               NUMERIC     NOT NULL DEFAULT 0,
  impressions         NUMERIC     NOT NULL DEFAULT 0,
  clicks              NUMERIC     NOT NULL DEFAULT 0,
  ctr                 NUMERIC     NOT NULL DEFAULT 0,
  conversions         NUMERIC     NOT NULL DEFAULT 0,
  revenue             NUMERIC     NOT NULL DEFAULT 0,
  roas                NUMERIC     NOT NULL DEFAULT 0,
  cpc                 NUMERIC     NOT NULL DEFAULT 0,
  cpa                 NUMERIC     NOT NULL DEFAULT 0,
  creative_score      NUMERIC     NOT NULL DEFAULT 0,
  landing_page_score  NUMERIC     NOT NULL DEFAULT 0,
  frequency           NUMERIC     NOT NULL DEFAULT 0,
  video_completion_rate NUMERIC,
  product             TEXT,
  landing_page        TEXT,
  source              TEXT        NOT NULL DEFAULT 'api',   -- 'api' | 'manual' | 'csv' | 'sheets'
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for common filters
CREATE INDEX IF NOT EXISTS idx_ads_status   ON ads (status);
CREATE INDEX IF NOT EXISTS idx_ads_brand    ON ads (brand);
CREATE INDEX IF NOT EXISTS idx_ads_platform ON ads (platform);
