import { NextResponse } from "next/server";
import { clearSheetConfig } from "@/lib/customStore";

export async function POST() {
  await clearSheetConfig();
  return NextResponse.json({ success: true });
}
