import { NextRequest, NextResponse } from "next/server";
import { getAlertRecipients, addAlertRecipient } from "@/lib/usersRepo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const recipients = await getAlertRecipients();
    return NextResponse.json({ recipients });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.email?.trim()) return NextResponse.json({ error: "email is required" }, { status: 400 });
    const recipient = await addAlertRecipient(body.email.trim().toLowerCase(), {
      schedule:          body.schedule,
      send_hour:         body.send_hour,
      send_day_of_week:  body.send_day_of_week,
      send_day_of_month: body.send_day_of_month,
    });
    return NextResponse.json({ success: true, recipient });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
