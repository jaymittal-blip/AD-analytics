import { NextResponse } from "next/server";
import { clearSheetConfig } from "@/lib/customStore";

export async function POST() {
  clearSheetConfig();
  if (process.env.DATABASE_URL) {
    const { setAppSetting } = await import("@/lib/usersRepo");
    await setAppSetting("sheet_config", null);
  }
  return NextResponse.json({ success: true });
}
