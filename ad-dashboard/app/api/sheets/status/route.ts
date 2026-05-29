import { NextResponse } from "next/server";
import { readTokens, readSheetConfig, SheetConfig } from "@/lib/customStore";

export async function GET() {
  const tokens     = readTokens();
  const oauthReady = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  // Prefer DB (survives Render restarts) — fall back to local file for dev
  let sheetConfig: SheetConfig | null = readSheetConfig();
  if (!sheetConfig && process.env.DATABASE_URL) {
    const { getAppSetting } = await import("@/lib/usersRepo");
    sheetConfig = await getAppSetting<SheetConfig>("sheet_config");
  }

  return NextResponse.json({
    oauthReady,
    connected:   !!tokens,
    sheetConfig: sheetConfig ?? null,
  });
}
