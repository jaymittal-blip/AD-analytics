/**
 * POST /api/send-alerts?schedule=instant|daily|weekly|monthly
 * Fetches unsent category_changes for the given schedule, groups by recipient, sends emails.
 */
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  getAlertRecipients, getUnsentChanges, markChangesSent,
  updateAlertRecipient, CategoryChange, AlertRecipient,
} from "@/lib/usersRepo";
import { fmtINR, fmtRoas, fmtPct } from "@/lib/format";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

const CLASS_LABEL: Record<string, string> = {
  KILL: "Kill List", SCALE: "Scale", MONITOR: "Monitor",
  TESTING: "Still Testing",
  ENDED_LOSS: "Ended (Loss)", ENDED_WIN: "Ended (Win)", ENDED_OK: "Ended",
  "": "Unknown",
};
const CLASS_COLOR: Record<string, string> = {
  KILL: "#ff5451", SCALE: "#4ae176", MONITOR: "#adc6ff",
  TESTING: "#e6c87a",
  ENDED_LOSS: "#888888", ENDED_WIN: "#888888", ENDED_OK: "#888888",
};

function buildAlertHtml(
  changes: CategoryChange[],
  hasCriteriaChange: boolean,
  schedule: string,
  dashboardUrl: string
): string {
  const periodLabel = schedule === "instant" ? "just now"
    : schedule === "daily"   ? "today"
    : schedule === "weekly"  ? "this week"
    : "this month";

  const rows = changes.map((c, i) => {
    const d  = c.ad_data as Record<string, unknown>;
    const bg = i % 2 === 0 ? "#1a1a1a" : "#1e1e1e";
    const fromColor = CLASS_COLOR[c.from_class ?? ""] ?? "#888";
    const toColor   = CLASS_COLOR[c.to_class]          ?? "#888";
    return `
      <tr style="background:${bg}">
        <td style="padding:9px 12px;font-family:monospace;font-size:12px;color:#888">${c.ad_id}</td>
        <td style="padding:9px 12px;font-size:13px;color:#e8e8e8">${d.brand ?? "—"}</td>
        <td style="padding:9px 12px;font-size:13px;color:#e8e8e8">${d.platform ?? "—"}</td>
        <td style="padding:9px 12px;font-size:12px;font-style:italic;color:#999">${d.creative_theme ?? "—"}</td>
        <td style="padding:9px 12px;text-align:center">
          <span style="background:${fromColor}22;color:${fromColor};font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;text-transform:uppercase">
            ${CLASS_LABEL[c.from_class ?? ""] ?? c.from_class ?? "New"}
          </span>
        </td>
        <td style="padding:9px 12px;text-align:center;color:#555;font-size:18px">→</td>
        <td style="padding:9px 12px;text-align:center">
          <span style="background:${toColor}22;color:${toColor};font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;text-transform:uppercase">
            ${CLASS_LABEL[c.to_class] ?? c.to_class}
          </span>
        </td>
        <td style="padding:9px 12px;text-align:right;font-family:monospace;font-size:13px;font-weight:700;color:#e8e8e8">${fmtINR(Number(d.spend ?? 0))}</td>
        <td style="padding:9px 12px;text-align:right;font-family:monospace;font-size:13px;color:#adc6ff">${fmtRoas(Number(d.roas ?? 0))}</td>
        <td style="padding:9px 12px;text-align:right;font-family:monospace;font-size:12px;color:#aaa">${fmtPct(Number(d.ctr ?? 0))}</td>
      </tr>`;
  }).join("");

  const criteriaWarning = hasCriteriaChange ? `
    <tr><td style="padding-bottom:20px">
      <div style="background:#3a2a00;border:1px solid #e6c87a44;border-radius:10px;padding:14px 18px;display:flex;align-items:flex-start;gap:12px">
        <span style="font-size:20px;flex-shrink:0">⚠️</span>
        <p style="margin:0;font-size:13px;color:#e6c87a;line-height:1.6">
          <strong>Since the category criteria has been changed, you can see extra entries — please check.</strong><br>
          Some ads may have moved categories because the classification rules were updated, not because the ad's performance changed.
        </p>
      </div>
    </td></tr>` : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Ad Intel: Category Changes</title>
</head>
<body style="margin:0;padding:0;background:#111;color:#e8e8e8;font-family:-apple-system,BlinkMacSystemFont,'Inter',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#111">
  <tr><td align="center" style="padding:32px 16px">
  <table width="700" cellpadding="0" cellspacing="0" style="max-width:700px;width:100%">

    <!-- Header -->
    <tr><td style="padding-bottom:24px">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="border-left:4px solid #e6c87a;padding:4px 0 4px 18px">
            <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#666">Ad Performance Intelligence</p>
            <h1 style="margin:0 0 6px;font-size:26px;font-weight:800;color:#fff;letter-spacing:-0.5px">Category Changes Detected</h1>
            <p style="margin:0;font-size:13px;color:#999">${changes.length} ad${changes.length !== 1 ? "s" : ""} moved categories ${periodLabel}</p>
          </td>
          <td align="right" style="vertical-align:top;padding-top:4px">
            <p style="margin:0;font-size:11px;color:#555">${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#555">${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} IST</p>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Criteria warning (if applicable) -->
    ${criteriaWarning}

    <!-- Summary pill -->
    <tr><td style="padding-bottom:20px">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;overflow:hidden">
        <tr>
          <td style="padding:16px 20px;border-right:1px solid #2a2a2a;text-align:center">
            <p style="margin:0 0 3px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666">Changes</p>
            <p style="margin:0;font-size:28px;font-weight:800;color:#e6c87a">${changes.length}</p>
          </td>
          <td style="padding:16px 20px;border-right:1px solid #2a2a2a;text-align:center">
            <p style="margin:0 0 3px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666">Period</p>
            <p style="margin:0;font-size:16px;font-weight:700;color:#fff;text-transform:capitalize">${schedule === "instant" ? "Live" : schedule.charAt(0).toUpperCase() + schedule.slice(1)}</p>
          </td>
          <td style="padding:16px 20px;text-align:center">
            <p style="margin:0 0 6px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666">Dashboard</p>
            <a href="${dashboardUrl}" style="display:inline-block;background:#ff5451;color:#fff;text-decoration:none;font-size:12px;font-weight:700;padding:6px 16px;border-radius:6px">Open Dashboard →</a>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Changes table -->
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;border-collapse:collapse">
        <thead>
          <tr style="background:#242424">
            <th style="padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:600">Ad ID</th>
            <th style="padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:600">Brand</th>
            <th style="padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:600">Platform</th>
            <th style="padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:600">Theme</th>
            <th style="padding:10px 12px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:600">From</th>
            <th style="padding:10px 12px;text-align:center;font-size:10px;color:#333;font-weight:600"></th>
            <th style="padding:10px 12px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:600">To</th>
            <th style="padding:10px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:600">Spend</th>
            <th style="padding:10px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:600">ROAS</th>
            <th style="padding:10px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:600">CTR</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding-top:28px;text-align:center">
      <p style="margin:0 0 8px;font-size:11px;color:#444">
        Sent by <strong style="color:#666">Ad Intel</strong> · Category Change Alerts
      </p>
      <a href="${dashboardUrl}" style="font-size:12px;color:#666;text-decoration:underline">${dashboardUrl}</a>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;
}

function isDue(recipient: AlertRecipient, schedule: string, now: Date): boolean {
  if (recipient.schedule !== schedule) return false;
  if (!recipient.is_active) return false;

  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  const hourIST = ist.getUTCHours();

  if (schedule === "instant") return true;

  if (schedule === "daily") {
    if (hourIST !== recipient.send_hour) return false;
    if (!recipient.last_sent_at) return true;
    const lastIST = new Date(new Date(recipient.last_sent_at).getTime() + istOffset);
    return lastIST.getUTCDate() !== ist.getUTCDate();
  }

  if (schedule === "weekly") {
    if (hourIST !== recipient.send_hour) return false;
    if (ist.getUTCDay() !== recipient.send_day_of_week) return false;
    if (!recipient.last_sent_at) return true;
    const lastIST = new Date(new Date(recipient.last_sent_at).getTime() + istOffset);
    const weekDiff = (ist.getTime() - lastIST.getTime()) / (7 * 24 * 3600 * 1000);
    return weekDiff >= 1;
  }

  if (schedule === "monthly") {
    if (hourIST !== recipient.send_hour) return false;
    if (ist.getUTCDate() !== recipient.send_day_of_month) return false;
    if (!recipient.last_sent_at) return true;
    const lastIST = new Date(new Date(recipient.last_sent_at).getTime() + istOffset);
    return lastIST.getUTCMonth() !== ist.getUTCMonth() || lastIST.getUTCFullYear() !== ist.getUTCFullYear();
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const schedule = (searchParams.get("schedule") ?? "instant") as "instant" | "daily" | "weekly" | "monthly";

    if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });

    const now        = new Date();
    const allRecipients = await getAlertRecipients();
    const recipients    = allRecipients.filter(r => r.is_active && isDue(r, schedule, now));

    if (!recipients.length) return NextResponse.json({ skipped: true, reason: "no_recipients_due" });

    const changes = await getUnsentChanges(schedule);
    if (!changes.length) return NextResponse.json({ skipped: true, reason: "no_changes" });

    const hasCriteriaChange = changes.some(c => c.change_reason === "criteria");
    const dashboardUrl      = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const html              = buildAlertHtml(changes, hasCriteriaChange, schedule, dashboardUrl);
    const subject           = `Ad Intel: ${changes.length} ad${changes.length !== 1 ? "s" : ""} changed category — ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;

    let sent = 0;
    const emails = recipients.map(r => r.email);

    const fromAddress = process.env.RESEND_FROM_EMAIL ?? "Ad Intel <onboarding@resend.dev>";
    const { data, error } = await resend.emails.send({
      from:    fromAddress,
      to:      emails,
      subject,
      html,
    });
    console.log("[send-alerts] Resend response:", JSON.stringify({ data, error, to: emails, schedule }));

    if (error) return NextResponse.json({ error }, { status: 400 });
    sent = emails.length;

    // Mark changes as sent and update last_sent_at
    await markChangesSent(changes.map(c => c.id), schedule);
    for (const r of recipients) {
      await updateAlertRecipient(r.id, { last_sent_at: now.toISOString() });
    }

    return NextResponse.json({ success: true, sent, changes: changes.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
