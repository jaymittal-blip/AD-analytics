import { NextRequest, NextResponse } from "next/server";
import { getAppSetting } from "@/lib/usersRepo";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const creds = await getAppSetting<{ access_token: string; account_id: string }>("meta_credentials");
  if (!creds?.access_token) {
    return NextResponse.json(
      { error: "Meta Ads is not connected. Go to New Analysis → Meta Ads Integration to connect." },
      { status: 401 }
    );
  }

  const { ad_id } = await req.json() as { ad_id: string };
  if (!ad_id) return NextResponse.json({ error: "ad_id is required." }, { status: 400 });

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${ad_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAUSED", access_token: creds.access_token }),
      cache: "no-store",
    });
    const data = await res.json();
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });
    return NextResponse.json({ success: true, ad_id });
  } catch {
    return NextResponse.json({ error: "Failed to pause ad. Check Meta API connectivity." }, { status: 500 });
  }
}
