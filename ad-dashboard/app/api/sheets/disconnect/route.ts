import { NextResponse } from "next/server";
import { clearTokens, clearSheetConfig } from "@/lib/customStore";

export async function POST() {
  await Promise.all([clearTokens(), clearSheetConfig()]);
  return NextResponse.json({ success: true });
}
