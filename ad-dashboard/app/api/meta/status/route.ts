import { NextResponse } from "next/server";
import { getAppSetting } from "@/lib/usersRepo";

export const dynamic = "force-dynamic";

export interface MetaStatus {
  connected: boolean;
  account_name?: string;
  account_id?: string;
  error?: string;
}

export async function GET() {
  const creds = await getAppSetting<{ access_token: string; account_id: string }>("meta_credentials");
  if (!creds?.access_token || !creds?.account_id) {
    return NextResponse.json<MetaStatus>({ connected: false });
  }
  try {
    const acctId = creds.account_id.startsWith("act_") ? creds.account_id : `act_${creds.account_id}`;
    const res  = await fetch(
      `https://graph.facebook.com/v19.0/${acctId}?fields=name,account_status&access_token=${creds.access_token}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    if (data.error) return NextResponse.json<MetaStatus>({ connected: false, error: data.error.message });
    return NextResponse.json<MetaStatus>({
      connected: true,
      account_name: data.name,
      account_id: creds.account_id,
    });
  } catch {
    return NextResponse.json<MetaStatus>({ connected: false, error: "Network error reaching Meta API" });
  }
}
