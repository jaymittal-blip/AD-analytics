export interface Ad {
  ad_id: string;
  platform: string;
  ad_type: string;
  brand: string;
  category: string;
  target_audience: string;
  creative_theme: string;
  status: string;
  start_date: string;
  days_running: number;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  revenue: number;
  roas: number;
  cpc: number;
  cpa: number;
  creative_score: number;
  landing_page_score: number;
  frequency: number;
  video_completion_rate: number | null;
  _class: AdClass;
}

export type AdClass =
  | "KILL"
  | "SCALE"
  | "MONITOR"
  | "TESTING"
  | "ENDED_LOSS"
  | "ENDED_WIN"
  | "ENDED_OK";

export type TabId = "kill" | "scale" | "monitor" | "testing" | "ended" | "all";

export interface ApiResponse {
  data: Ad[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface AdsApiResponse {
  ads: Ad[];
  fetchedAt: string;
}

export interface AdGroups {
  kill: Ad[];
  scale: Ad[];
  monitor: Ad[];
  testing: Ad[];
  ended: Ad[];
  all: Ad[];
}
