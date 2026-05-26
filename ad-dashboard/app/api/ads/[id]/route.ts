import { NextRequest, NextResponse } from "next/server";
import { getAdById, upsertAd, deleteAd } from "@/lib/adsRepo";
import { Ad } from "@/lib/types";

type Ctx = { params: { id: string } };

export async function GET(_: NextRequest, { params }: Ctx) {
  const ad = await getAdById(params.id);
  if (!ad) return NextResponse.json({ error: "Ad not found" }, { status: 404 });
  return NextResponse.json({ ad });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const existing = await getAdById(params.id);
    if (!existing) return NextResponse.json({ error: "Ad not found" }, { status: 404 });

    const patch = await req.json() as Partial<Ad>;
    const updated: Ad = { ...existing, ...patch, ad_id: params.id };
    await upsertAd(updated, "manual");
    return NextResponse.json({ success: true, ad: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  try {
    await deleteAd(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
