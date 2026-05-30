import { NextRequest, NextResponse } from "next/server";
import { getAppSetting, setAppSetting } from "@/lib/usersRepo";

export const dynamic = "force-dynamic";

export type DataSource = "api" | "sheets";

export async function GET() {
  try {
    const source = await getAppSetting<DataSource>("data_source") ?? "api";
    return NextResponse.json({ source });
  } catch (err) {
    return NextResponse.json({ source: "api", error: String(err) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { source } = await req.json() as { source: DataSource };
    if (source !== "api" && source !== "sheets") {
      return NextResponse.json({ error: "source must be 'api' or 'sheets'" }, { status: 400 });
    }
    await setAppSetting("data_source", source);
    return NextResponse.json({ success: true, source });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
