import { NextRequest, NextResponse } from "next/server";
import { setAppSetting } from "@/lib/usersRepo";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { access_token, account_id } = await req.json() as { access_token: string; account_id: string };

  if (!access_token?.trim() || !account_id?.trim()) {
    return NextResponse.json({ error: "Access Token and Ad Account ID are both required." }, { status: 400 });
  }

  const acctId = account_id.trim().startsWith("act_") ? account_id.trim() : `act_${account_id.trim()}`;

  try {
    const res  = await fetch(
      `https://graph.facebook.com/v19.0/${acctId}?fields=name,account_status&access_token=${access_token.trim()}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    if (data.error) {
      return NextResponse.json({ error: `Meta API error: ${data.error.message}` }, { status: 400 });
    }
    await setAppSetting("meta_credentials", {
      access_token: access_token.trim(),
      account_id:   account_id.trim().replace("act_", ""),
    });
    return NextResponse.json({ connected: true, account_name: data.name });
  } catch {
    return NextResponse.json({ error: "Could not reach Meta API. Check your credentials." }, { status: 500 });
  }
}

export async function DELETE() {
  await setAppSetting("meta_credentials", null);
  return NextResponse.json({ disconnected: true });
}
