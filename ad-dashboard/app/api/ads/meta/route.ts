import { NextResponse } from "next/server";
import { getDistinctValues } from "@/lib/adsRepo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const meta = await getDistinctValues();
    return NextResponse.json(meta);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
