import { NextRequest, NextResponse } from "next/server";
import { getAppSetting, setAppSetting } from "@/lib/usersRepo";
import { CriteriaMap } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const criteria = await getAppSetting<CriteriaMap>("criteria");
    return NextResponse.json({ criteria });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { criteria } = await req.json() as { criteria: CriteriaMap };
    if (!criteria) return NextResponse.json({ error: "criteria required" }, { status: 400 });
    await setAppSetting("criteria", criteria);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
