import { NextRequest, NextResponse } from "next/server";
import { getAppSetting, setAppSetting } from "@/lib/usersRepo";

export const dynamic = "force-dynamic";

export async function GET() {
  const overrides = await getAppSetting<Record<string, string>>("ad_status_overrides");
  return NextResponse.json({ overrides: overrides ?? {} });
}

export async function POST(req: NextRequest) {
  const { ad_id, status } = await req.json() as { ad_id: string; status: string };
  if (!ad_id || !status) {
    return NextResponse.json({ error: "ad_id and status are required." }, { status: 400 });
  }
  const current = await getAppSetting<Record<string, string>>("ad_status_overrides") ?? {};
  await setAppSetting("ad_status_overrides", { ...current, [ad_id]: status });
  return NextResponse.json({ ok: true });
}
