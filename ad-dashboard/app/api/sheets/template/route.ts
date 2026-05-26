import { NextResponse } from "next/server";

// Matches the exact column order from the reference Google Sheet
const HEADERS = "ad_id,recommendation,platform,brand,category,ad_type,target_audience,creative_theme,status,start_date,days_running,spend,revenue,roas,impressions,clicks,ctr,conversions,cpc,cpa,creative_score,landing_page_score,frequency,video_completion_rate";
const EXAMPLE = "AD-XXXX,KILL,YouTube,Man Matters,Hair Care,Video Reel,M 25-34,Doctor Trust,Active,2024-01-15,30,50000,125000,2.5,100000,3500,3.5,420,14.28,119,72,68,2.1,45.5";

const CSV = [HEADERS, EXAMPLE].join("\n");

export async function GET() {
  return new NextResponse(CSV, {
    headers: {
      "Content-Type":        "text/csv",
      "Content-Disposition": 'attachment; filename="ad-intel-template.csv"',
    },
  });
}
