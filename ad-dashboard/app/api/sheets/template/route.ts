import { NextResponse } from "next/server";

const HEADERS = "ad_id,recommendation,platform,brand,category,ad_type,target_audience,creative_theme,status,start_date,days_running,spend,product,landing_page";
const EXAMPLE = "AD-XXXX,KILL,YouTube,Man Matters,Hair Care,Video Reel,M 25-34,Doctor Trust,Active,2024-01-15,30,50000,Hair Growth Kit,https://example.com/product";

const CSV = [HEADERS, EXAMPLE].join("\n");

export async function GET() {
  return new NextResponse(CSV, {
    headers: {
      "Content-Type":        "text/csv",
      "Content-Disposition": 'attachment; filename="ad-intel-template.csv"',
    },
  });
}
