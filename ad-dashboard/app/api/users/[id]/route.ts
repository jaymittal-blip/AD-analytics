import { NextRequest, NextResponse } from "next/server";
import { updateReportUser, softDeleteReportUser } from "@/lib/usersRepo";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id   = Number(params.id);
    const body = await req.json();
    await updateReportUser(id, body);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await softDeleteReportUser(Number(params.id));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
