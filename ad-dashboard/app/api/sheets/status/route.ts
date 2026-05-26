import { NextResponse } from "next/server";
import { readTokens, readSheetConfig } from "@/lib/customStore";

export async function GET() {
  const tokens      = readTokens();
  const sheetConfig = readSheetConfig();
  const oauthReady  = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return NextResponse.json({
    oauthReady,
    connected:  !!tokens,
    sheetConfig: sheetConfig ?? null,
  });
}
