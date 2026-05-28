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

  const { ad_id, increase_pct } = await req.json() as { ad_id: string; increase_pct: number };
  if (!ad_id)           return NextResponse.json({ error: "ad_id is required." }, { status: 400 });
  if (!increase_pct || increase_pct <= 0)
    return NextResponse.json({ error: "increase_pct must be a positive number." }, { status: 400 });

  const token = creds.access_token;

  try {
    // Step 1: get adset_id from the ad
    const adRes  = await fetch(
      `https://graph.facebook.com/v19.0/${ad_id}?fields=adset_id&access_token=${token}`,
      { cache: "no-store" }
    );
    const adData = await adRes.json();
    if (adData.error) return NextResponse.json({ error: adData.error.message }, { status: 400 });

    const adset_id = adData.adset_id as string;
    if (!adset_id)
      return NextResponse.json({ error: "Could not find Ad Set for this ad. Verify the Meta Ad ID." }, { status: 400 });

    // Step 2: get current budget from adset
    const adsetRes  = await fetch(
      `https://graph.facebook.com/v19.0/${adset_id}?fields=name,daily_budget,lifetime_budget&access_token=${token}`,
      { cache: "no-store" }
    );
    const adsetData = await adsetRes.json();
    if (adsetData.error) return NextResponse.json({ error: adsetData.error.message }, { status: 400 });

    const isDaily       = !!adsetData.daily_budget && Number(adsetData.daily_budget) > 0;
    const currentBudget = isDaily ? Number(adsetData.daily_budget) : Number(adsetData.lifetime_budget);
    if (!currentBudget)
      return NextResponse.json({ error: "Could not read current budget from Ad Set." }, { status: 400 });

    // Meta budgets are in cents (USD) or paise (INR) — multiply by (1 + pct/100)
    const newBudget     = Math.round(currentBudget * (1 + increase_pct / 100));
    const budgetField   = isDaily ? "daily_budget" : "lifetime_budget";

    // Step 3: update budget
    const updateRes  = await fetch(`https://graph.facebook.com/v19.0/${adset_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [budgetField]: String(newBudget), access_token: token }),
      cache: "no-store",
    });
    const updateData = await updateRes.json();
    if (updateData.error) return NextResponse.json({ error: updateData.error.message }, { status: 400 });

    return NextResponse.json({
      success:         true,
      adset_id,
      adset_name:      adsetData.name,
      budget_type:     isDaily ? "daily" : "lifetime",
      old_budget_raw:  currentBudget,
      new_budget_raw:  newBudget,
      increase_pct,
    });
  } catch {
    return NextResponse.json({ error: "Failed to scale ad budget. Check Meta API connectivity." }, { status: 500 });
  }
}
