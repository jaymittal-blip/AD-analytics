import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { Ad } from "@/lib/types";
import { fmtINR, fmtRoas, fmtPct } from "@/lib/format";
import { Rule, NUMERIC_RULE_KEYS } from "@/lib/settings";

const resend = new Resend(process.env.RESEND_API_KEY);

// ── Category metadata ─────────────────────────────────────────────────────────
const CATEGORY_META: Record<string, { title: string; color: string; action: string }> = {
  kill:    { title: "Kill List",     color: "#ff5451", action: "Stop immediately — these ads are burning budget with no return."  },
  scale:   { title: "Scale",         color: "#4ae176", action: "Increase budget now — these are your proven top performers."       },
  monitor: { title: "Monitor",       color: "#adc6ff", action: "Watch closely — mid-tier ads that could go either way."            },
  testing: { title: "Still Testing", color: "#e6c87a", action: "Too early to judge — give these ads more time and data."           },
};

// ── Rule label helpers ────────────────────────────────────────────────────────
const COL_LABEL: Record<string, string> = {
  roas: "ROAS", spend: "Spend", revenue: "Revenue", days_running: "Days Running",
  ctr: "CTR", impressions: "Impressions", clicks: "Clicks", conversions: "Conversions",
  cpc: "CPC", cpa: "CPA", creative_score: "Creative Score",
  landing_page_score: "Landing Page Score", frequency: "Frequency",
  video_completion_rate: "Video Completion Rate", platform: "Platform",
  brand: "Brand", status: "Status", ad_type: "Ad Type",
};

function fmtRuleVal(column: string, value: Rule["value"]): string {
  if (typeof value === "string") return `"${value}"`;
  if (column === "spend" || column === "revenue" || column === "cpc" || column === "cpa") return fmtINR(value);
  if (column === "roas") return `${value}x`;
  if (column === "ctr" || column === "video_completion_rate") return `${value}%`;
  if (column === "days_running") return `${value} days`;
  return String(value);
}

function renderRules(rules: Rule[]): string {
  if (!rules?.length) return "No criteria defined.";
  return rules.map((r, i) => {
    const prefix = i === 0 ? "IF" : `<span style="color:#ff5451;font-weight:700">${r.logic}</span>`;
    const col    = COL_LABEL[r.column] ?? r.column;
    const op     = NUMERIC_RULE_KEYS.has(r.column) ? r.operator : "=";
    const val    = fmtRuleVal(r.column, r.value);
    return `${prefix} <strong>${col}</strong> ${op} <span style="color:#ffb3ad;font-weight:700">${val}</span>`;
  }).join(" &nbsp;");
}

// ── Smart data-driven summary ─────────────────────────────────────────────────
function generateSummary(category: string, ads: Ad[]): string {
  if (!ads.length) return "No ads matched this category with the current criteria.";

  const totalSpend   = ads.reduce((s, a) => s + (a.spend   ?? 0), 0);
  const totalRevenue = ads.reduce((s, a) => s + (a.revenue ?? 0), 0);
  const avgRoas      = ads.reduce((s, a) => s + (a.roas    ?? 0), 0) / ads.length;
  const avgDays      = Math.round(ads.reduce((s, a) => s + (a.days_running ?? 0), 0) / ads.length);

  // Top platform
  const platformMap: Record<string, { spend: number; count: number }> = {};
  for (const ad of ads) {
    const p = ad.platform ?? "Unknown";
    if (!platformMap[p]) platformMap[p] = { spend: 0, count: 0 };
    platformMap[p].spend += ad.spend ?? 0;
    platformMap[p].count++;
  }
  const topPlatform = Object.entries(platformMap).sort((a, b) => b[1].spend - a[1].spend)[0];

  // Top brand
  const brandMap: Record<string, { spend: number; count: number }> = {};
  for (const ad of ads) {
    const b = ad.brand ?? "Unknown";
    if (!brandMap[b]) brandMap[b] = { spend: 0, count: 0 };
    brandMap[b].spend += ad.spend ?? 0;
    brandMap[b].count++;
  }
  const topBrand = Object.entries(brandMap).sort((a, b) => b[1].spend - a[1].spend)[0];

  // Top creative theme
  const themeMap: Record<string, number> = {};
  for (const ad of ads) {
    const t = ad.creative_theme ?? "Unknown";
    themeMap[t] = (themeMap[t] ?? 0) + 1;
  }
  const topTheme = Object.entries(themeMap).sort((a, b) => b[1] - a[1])[0];

  if (category === "kill") {
    const wastedStr  = fmtINR(totalSpend);
    const roasStr    = fmtRoas(avgRoas);
    const platformPct = Math.round((topPlatform[1].count / ads.length) * 100);
    const brandPct    = Math.round((topBrand[1].count   / ads.length) * 100);
    return `
      <strong>${ads.length} ads</strong> are collectively burning <strong style="color:#ff5451">${wastedStr}</strong> with
      an average ROAS of <strong style="color:#ff5451">${roasStr}</strong> — far below the kill threshold.
      <strong>${topPlatform[0]}</strong> is the biggest offender, accounting for <strong>${topPlatform[1].count} ads (${platformPct}%)</strong>
      and <strong>${fmtINR(topPlatform[1].spend)}</strong> in wasted spend.
      <strong>${topBrand[0]}</strong> brand appears in <strong>${topBrand[1].count} of these ${ads.length} ads (${brandPct}%)</strong>,
      costing <strong>${fmtINR(topBrand[1].spend)}</strong> with no meaningful return.
      The <em>"${topTheme[0]}"</em> creative theme is most common across kill ads (${topTheme[1]} ads) —
      this messaging angle is not resonating with audiences.
      These ads have been running an average of <strong>${avgDays} days</strong>.
      <strong>Recommended action: stop all ${ads.length} ads immediately</strong> to recover <strong style="color:#ff5451">${wastedStr}</strong> in future spend.
    `;
  }

  if (category === "scale") {
    const roasStr = fmtRoas(avgRoas);
    return `
      <strong>${ads.length} ads</strong> are performing exceptionally well with an average ROAS of
      <strong style="color:#4ae176">${roasStr}</strong>, generating <strong style="color:#4ae176">${fmtINR(totalRevenue)}</strong> in revenue
      from <strong>${fmtINR(totalSpend)}</strong> spend.
      <strong>${topPlatform[0]}</strong> leads with <strong>${topPlatform[1].count} scale ads</strong> delivering
      <strong>${fmtINR(topPlatform[1].spend)}</strong> in spend.
      <strong>${topBrand[0]}</strong> has the most ads in this list (<strong>${topBrand[1].count} ads</strong>).
      The <em>"${topTheme[0]}"</em> creative theme is your top-performing concept (${topTheme[1]} ads) —
      consider creating more variants of this theme.
      These ads have been running an average of <strong>${avgDays} days</strong> — proven performance over time.
      <strong>Recommended action: increase daily budgets by 30–50%</strong> on these ${ads.length} ads to maximise revenue.
    `;
  }

  if (category === "monitor") {
    return `
      <strong>${ads.length} ads</strong> are in the watch zone — generating <strong style="color:#adc6ff">${fmtINR(totalRevenue)}</strong>
      in revenue from <strong>${fmtINR(totalSpend)}</strong> spend (avg ROAS <strong>${fmtRoas(avgRoas)}</strong>).
      <strong>${topPlatform[0]}</strong> has the most monitor ads (<strong>${topPlatform[1].count}</strong>) with
      <strong>${fmtINR(topPlatform[1].spend)}</strong> in spend.
      <strong>${topBrand[0]}</strong> dominates this list with <strong>${topBrand[1].count} ads</strong>.
      These ads have been running an average of <strong>${avgDays} days</strong>.
      <strong>Recommended action: hold current budgets</strong>, review weekly, and move to Scale or Kill as ROAS trends become clearer.
    `;
  }

  if (category === "testing") {
    return `
      <strong>${ads.length} ads</strong> are still in the early testing phase with <strong>${fmtINR(totalSpend)}</strong> invested so far
      (avg ROAS <strong>${fmtRoas(avgRoas)}</strong> — too early to judge meaningfully).
      <strong>${topPlatform[0]}</strong> has the most new ads (<strong>${topPlatform[1].count}</strong>).
      <strong>${topBrand[0]}</strong> is testing the most creatives (<strong>${topBrand[1].count} ads</strong>).
      Average run time is only <strong>${avgDays} days</strong> — most haven't reached spend or time thresholds yet.
      <strong>Recommended action: let these run</strong> until they hit the spend/time thresholds before making kill or scale decisions.
    `;
  }

  return `${ads.length} ads · ${fmtINR(totalSpend)} spend · ${fmtINR(totalRevenue)} revenue · avg ROAS ${fmtRoas(avgRoas)}.`;
}

// ── HTML email builder ────────────────────────────────────────────────────────
function buildHtml(category: string, ads: Ad[], rules: Rule[]): string {
  const meta    = CATEGORY_META[category] ?? { title: category, color: "#888", action: "" };
  const topAds  = [...ads].sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
  const summary = generateSummary(category, ads);

  const totalSpend   = ads.reduce((s, a) => s + (a.spend   ?? 0), 0);
  const totalRevenue = ads.reduce((s, a) => s + (a.revenue ?? 0), 0);
  const avgRoas      = ads.length ? ads.reduce((s, a) => s + (a.roas ?? 0), 0) / ads.length : 0;
  const avgCtr       = ads.length ? ads.reduce((s, a) => s + (a.ctr  ?? 0), 0) / ads.length : 0;

  const rows = topAds.map((ad, i) => `
    <tr style="background:${i % 2 === 0 ? "#1a1a1a" : "#1e1e1e"}">
      <td style="padding:9px 12px;font-family:monospace;font-size:12px;color:#888;white-space:nowrap">${ad.ad_id}</td>
      <td style="padding:9px 12px;font-size:13px;color:#e8e8e8">${ad.platform}</td>
      <td style="padding:9px 12px;font-size:13px;color:#e8e8e8">${ad.brand}</td>
      <td style="padding:9px 12px;font-size:13px;font-style:italic;color:#999;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ad.creative_theme}</td>
      <td style="padding:9px 12px;text-align:right;font-family:monospace;font-size:13px;color:#aaa">${ad.days_running}d</td>
      <td style="padding:9px 12px;text-align:right;font-family:monospace;font-size:13px;font-weight:700;color:#e8e8e8">${fmtINR(ad.spend)}</td>
      <td style="padding:9px 12px;text-align:right;font-family:monospace;font-size:13px;font-weight:700;color:${ad.roas < 2.5 ? "#ff5451" : ad.roas >= 15 ? "#4ae176" : "#e6c87a"}">${fmtRoas(ad.roas)}</td>
      <td style="padding:9px 12px;text-align:right;font-family:monospace;font-size:13px;color:#aaa">${fmtPct(ad.ctr)}</td>
      <td style="padding:9px 12px;text-align:right;font-family:monospace;font-size:13px;color:#aaa">${fmtINR(ad.revenue)}</td>
    </tr>
  `).join("");

  const criteriaHtml = rules?.length
    ? `<div style="background:#1e1a1a;border:1px solid #3a2a2a;border-radius:10px;padding:16px 20px;margin-bottom:28px">
        <p style="margin:0 0 8px;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#888">Classification Criteria</p>
        <p style="margin:0;font-size:13px;color:#ccc;line-height:1.8">${renderRules(rules)}</p>
       </div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${meta.title} Report — Ad Intel</title>
</head>
<body style="margin:0;padding:0;background:#111;color:#e8e8e8;font-family:-apple-system,BlinkMacSystemFont,'Inter',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#111">
  <tr><td align="center" style="padding:32px 16px">
  <table width="700" cellpadding="0" cellspacing="0" style="max-width:700px;width:100%">

    <!-- Header -->
    <tr><td style="padding-bottom:28px">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="border-left:4px solid ${meta.color};padding:4px 0 4px 18px">
            <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#666">Ad Performance Intelligence</p>
            <h1 style="margin:0 0 6px;font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px">${meta.title} Report</h1>
            <p style="margin:0;font-size:13px;color:#999">${meta.action}</p>
          </td>
          <td align="right" style="vertical-align:top;padding-top:4px">
            <p style="margin:0;font-size:11px;color:#555">${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</p>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Stats row -->
    <tr><td style="padding-bottom:24px">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;overflow:hidden;border-collapse:collapse">
        <tr>
          <td style="padding:18px 20px;border-right:1px solid #2a2a2a;text-align:center">
            <p style="margin:0 0 3px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666">Ads</p>
            <p style="margin:0;font-size:30px;font-weight:800;color:#fff">${ads.length}</p>
          </td>
          <td style="padding:18px 20px;border-right:1px solid #2a2a2a;text-align:center">
            <p style="margin:0 0 3px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666">Total Spend</p>
            <p style="margin:0;font-size:30px;font-weight:800;color:${meta.color}">${fmtINR(totalSpend)}</p>
          </td>
          <td style="padding:18px 20px;border-right:1px solid #2a2a2a;text-align:center">
            <p style="margin:0 0 3px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666">Revenue</p>
            <p style="margin:0;font-size:30px;font-weight:800;color:#4ae176">${fmtINR(totalRevenue)}</p>
          </td>
          <td style="padding:18px 20px;border-right:1px solid #2a2a2a;text-align:center">
            <p style="margin:0 0 3px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666">Avg ROAS</p>
            <p style="margin:0;font-size:30px;font-weight:800;color:#adc6ff">${fmtRoas(avgRoas)}</p>
          </td>
          <td style="padding:18px 20px;text-align:center">
            <p style="margin:0 0 3px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666">Avg CTR</p>
            <p style="margin:0;font-size:30px;font-weight:800;color:#e6c87a">${fmtPct(avgCtr)}</p>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Criteria -->
    <tr><td style="padding-bottom:4px">${criteriaHtml}</td></tr>

    <!-- AI Summary -->
    <tr><td style="padding-bottom:24px">
      <div style="background:#181c18;border:1px solid #2a3a2a;border-radius:10px;padding:18px 20px">
        <p style="margin:0 0 8px;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#4ae176">Analysis &amp; Recommendation</p>
        <p style="margin:0;font-size:14px;color:#ccc;line-height:1.75">${summary}</p>
      </div>
    </td></tr>

    <!-- Table -->
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;border-collapse:collapse">
        <thead>
          <tr style="background:#242424">
            <th style="padding:11px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:600;white-space:nowrap">Ad ID</th>
            <th style="padding:11px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:600">Platform</th>
            <th style="padding:11px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:600">Brand</th>
            <th style="padding:11px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:600">Theme</th>
            <th style="padding:11px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:600">Days</th>
            <th style="padding:11px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:600">Spend</th>
            <th style="padding:11px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:600">ROAS</th>
            <th style="padding:11px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:600">CTR</th>
            <th style="padding:11px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:600">Revenue</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding-top:28px;text-align:center">
      <p style="margin:0 0 6px;font-size:11px;color:#444">Sent by <strong style="color:#666">Ad Intel</strong> · Ad Performance Intelligence · ${new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}" style="font-size:12px;color:#666;text-decoration:underline">${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}</a>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── API handler ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      category:   string;
      recipients: string[];
      ads:        Ad[];
      rules?:     Rule[];
    };
    const { category, recipients, ads, rules = [] } = body;

    if (!recipients?.length)        return NextResponse.json({ error: "No recipients"         }, { status: 400 });
    if (!category)                  return NextResponse.json({ error: "No category"            }, { status: 400 });
    if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });

    const meta    = CATEGORY_META[category] ?? { title: category, color: "#888", action: "" };
    const subject = `Ad Intel: ${meta.title} — ${ads.length} ads · ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;

    const fromAddress = process.env.RESEND_FROM_EMAIL ?? "Ad Intel <onboarding@resend.dev>";
    const { data, error } = await resend.emails.send({
      from:    fromAddress,
      to:      recipients,
      subject,
      html:    buildHtml(category, ads, rules),
    });

    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ success: true, id: data?.id, count: ads.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
