/**
 * GET /api/sheets/config
 * Returns the push URL and secret for the Apps Script setup UI.
 * Only exposes what's needed to configure the script.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    pushSecretConfigured: !!process.env.PUSH_SECRET,
  });
}
