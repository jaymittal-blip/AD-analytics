import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { Ad } from "@/lib/types";
import { fmtINR, fmtRoas, fmtPct } from "@/lib/format";

const resend = new Resend(process.env.RESEND_API_KEY);

const CATEGORY_META: Record<string, { title: string; color: string; action: string }> = {
  kill:    { title: "Kill List",     color: "#ff5451", action: "Stop immediately — these ads are losing money." },
  scale:   { title: "Scale",         color: "#4ae176", action: "Increase budget — these are your winners."      },
  monitor: { title: "Monitor",       color: "#adc6ff", action: "Watch closely — not bad, not great yet."        },
  testing: { title: "Still Testing", color: "#e6c87a", action: "Too early to judge — let them run."             },
};

function buildHtml(category: string, ads: Ad[]): string {
  const meta   = CATEGORY_META[category] ?? { title: category, color: "#888", action: "" };
  const topAds = ads.slice(0, 25);

  const totalSpend   = ads.reduce((s, a) => s + (a.spend ?? 0), 0);
  const totalRevenue = ads.reduce((s, a) => s + (a.revenue ?? 0), 0);
  const avgRoas      = ads.length ? ads.reduce((s, a) => s + (a.roas ?? 0), 0) / ads.length : 0;

  const rows = topAds.map(ad => `
    <tr>
      <td style="padding:8px 12px;font-family:monospace;font-size:12px;color:#aaa;white-space:nowrap">${ad.ad_id}</td>
      <td style="padding:8px 12px;font-size:13px">${ad.platform}</td>
      <td style="padding:8px 12px;font-size:13px">${ad.brand}</td>
      <td style="padding:8px 12px;font-size:13px;font-style:italic;color:#aaa;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ad.creative_theme}</td>
      <td style="padding:8px 12px;text-align:right;font-family:monospace;font-size:13px">${ad.days_running}d</td>
      <td style="padding:8px 12px;text-align:right;font-family:monospace;font-size:13px;font-weight:bold">${fmtINR(ad.spend)}</td>
      <td style="padding:8px 12px;text-align:right;font-family:monospace;font-size:13px;font-weight:bold;color:${ad.roas < 2.5 ? "#ff5451" : ad.roas >= 15 ? "#4ae176" : "#e6c87a"}">${fmtRoas(ad.roas)}</td>
      <td style="padding:8px 12px;text-align:right;font-family:monospace;font-size:13px;color:#aaa">${fmtPct(ad.ctr)}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0e0e0e;color:#e8e8e8;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:760px;margin:0 auto;padding:32px 16px">
    <tr><td>

      <!-- Header -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px">
        <tr>
          <td style="border-left:4px solid ${meta.color};padding:0 0 0 16px">
            <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#888">Ad Performance Intelligence</p>
            <h1 style="margin:0 0 6px;font-size:26px;font-weight:800;color:#fff">${meta.title} Report</h1>
            <p style="margin:0;font-size:13px;color:#aaa">${meta.action}</p>
          </td>
        </tr>
      </table>

      <!-- Stats -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;background:#1a1a1a;border-radius:12px;overflow:hidden">
        <tr>
          <td style="padding:20px 24px;border-right:1px solid #2a2a2a;text-align:center">
            <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888">Ads</p>
            <p style="margin:0;font-size:28px;font-weight:800;color:#fff">${ads.length}</p>
          </td>
          <td style="padding:20px 24px;border-right:1px solid #2a2a2a;text-align:center">
            <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888">Total Spend</p>
            <p style="margin:0;font-size:28px;font-weight:800;color:${meta.color}">${fmtINR(totalSpend)}</p>
          </td>
          <td style="padding:20px 24px;border-right:1px solid #2a2a2a;text-align:center">
            <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888">Revenue</p>
            <p style="margin:0;font-size:28px;font-weight:800;color:#4ae176">${fmtINR(totalRevenue)}</p>
          </td>
          <td style="padding:20px 24px;text-align:center">
            <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888">Avg ROAS</p>
            <p style="margin:0;font-size:28px;font-weight:800;color:#adc6ff">${fmtRoas(avgRoas)}</p>
          </td>
        </tr>
      </table>

      <!-- Table -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;overflow:hidden;border-collapse:collapse">
        <thead>
          <tr style="background:#222;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888">
            <th style="padding:12px 12px;text-align:left;font-weight:600">Ad ID</th>
            <th style="padding:12px 12px;text-align:left;font-weight:600">Platform</th>
            <th style="padding:12px 12px;text-align:left;font-weight:600">Brand</th>
            <th style="padding:12px 12px;text-align:left;font-weight:600">Theme</th>
            <th style="padding:12px 12px;text-align:right;font-weight:600">Days</th>
            <th style="padding:12px 12px;text-align:right;font-weight:600">Spend</th>
            <th style="padding:12px 12px;text-align:right;font-weight:600">ROAS</th>
            <th style="padding:12px 12px;text-align:right;font-weight:600">CTR</th>
          </tr>
        </thead>
        <tbody style="border-top:1px solid #2a2a2a">
          ${rows}
        </tbody>
      </table>

      ${ads.length > 25 ? `<p style="margin:12px 0 0;font-size:12px;color:#666;text-align:center">Showing top 25 of ${ads.length} ads by spend</p>` : ""}

      <!-- Footer -->
      <p style="margin:32px 0 0;font-size:11px;color:#555;text-align:center">
        Sent by Ad Intel · Ad Performance Intelligence Platform
      </p>

    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { category: string; recipients: string[]; ads: Ad[] };
    const { category, recipients, ads } = body;

    if (!recipients?.length)   return NextResponse.json({ error: "No recipients" }, { status: 400 });
    if (!category)             return NextResponse.json({ error: "No category"   }, { status: 400 });
    if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });

    const meta    = CATEGORY_META[category] ?? { title: category, color: "#888", action: "" };
    const subject = `Ad Intel: ${meta.title} — ${ads.length} ads · ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;

    const { data, error } = await resend.emails.send({
      from:    "Ad Intel <onboarding@resend.dev>",
      to:      recipients,
      subject,
      html:    buildHtml(category, ads),
    });

    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ success: true, id: data?.id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
