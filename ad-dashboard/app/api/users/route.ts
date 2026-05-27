import { NextRequest, NextResponse } from "next/server";
import { getReportUsers, addReportUser } from "@/lib/usersRepo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const users = await getReportUsers();
    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.email?.trim()) return NextResponse.json({ error: "email is required" }, { status: 400 });
    const user = await addReportUser(body.email.trim().toLowerCase(), {
      schedule:          body.schedule,
      send_hour:         body.send_hour,
      send_day_of_week:  body.send_day_of_week,
      send_day_of_month: body.send_day_of_month,
      categories:        body.categories,
    });
    return NextResponse.json({ success: true, user });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
