import { NextResponse } from "next/server";
import { clearTokens } from "@/lib/customStore";
import fs from "fs";
import path from "path";

export async function POST() {
  clearTokens();
  const sheetPath = path.join(process.cwd(), "data", "sheets-config.json");
  if (fs.existsSync(sheetPath)) fs.writeFileSync(sheetPath, "null");
  return NextResponse.json({ success: true });
}
