#!/usr/bin/env python3
"""
Ad Performance Analyzer
Fetches all ad data, classifies each ad, and generates an actionable HTML dashboard.
"""

import sys
import webbrowser
from collections import defaultdict
from datetime import datetime
from pathlib import Path

try:
    import requests
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "-q"])
    import requests

# ── Configuration ──────────────────────────────────────────────────────────────
API_BASE  = "https://mosaicfellowship.in/api/data/content/ads"
PAGE_SIZE = 100

# Classification thresholds — edit these to tune the system
ROAS_KILL            = 2.5    # Below this (and proven) → KILL
ROAS_SCALE           = 15.0   # Above this (and proven spend) → SCALE
MIN_DAYS_TO_DECIDE   = 14     # Days running required to be "proven"
MIN_SPEND_TO_DECIDE  = 30_000 # OR spend above this to be "proven"
MIN_SPEND_FOR_SCALE  = 20_000 # Minimum spend to trust a SCALE signal


# ── Fetching ───────────────────────────────────────────────────────────────────
def fetch_all_ads() -> list[dict]:
    ads, page = [], 1
    while True:
        print(f"  Fetching page {page}...", end="\r", flush=True)
        r = requests.get(API_BASE, params={"page": page, "limit": PAGE_SIZE}, timeout=20)
        r.raise_for_status()
        payload = r.json()
        ads.extend(payload.get("data", []))
        if not payload.get("pagination", {}).get("has_next"):
            break
        page += 1
    print(f"  Fetched {len(ads)} ads.            ")
    return ads


# ── Classification ─────────────────────────────────────────────────────────────
def classify(ad: dict) -> str:
    roas   = ad.get("roas")   or 0.0
    spend  = ad.get("spend")  or 0.0
    days   = ad.get("days_running") or 0
    status = (ad.get("status") or "").lower()

    proven = (days >= MIN_DAYS_TO_DECIDE) or (spend >= MIN_SPEND_TO_DECIDE)

    if status in ("completed", "paused"):
        if proven and roas < ROAS_KILL:
            return "ENDED_LOSS"
        if roas >= ROAS_SCALE:
            return "ENDED_WIN"
        return "ENDED_OK"

    # Active ads
    if proven and roas < ROAS_KILL:
        return "KILL"
    if roas >= ROAS_SCALE and spend >= MIN_SPEND_FOR_SCALE:
        return "SCALE"
    if not proven:
        return "TESTING"
    return "MONITOR"


def analyze(ads: list[dict]) -> list[dict]:
    for ad in ads:
        ad["_class"] = classify(ad)
    return ads


# ── Formatting helpers ─────────────────────────────────────────────────────────
def fmt_inr(v: float) -> str:
    if v >= 1_000_000:
        return f"₹{v/1_000_000:.1f}M"
    if v >= 1_000:
        return f"₹{v/1_000:.0f}K"
    return f"₹{v:.0f}"


def badge(cls: str) -> str:
    style = {
        "KILL":       "background:#ff4757;color:#fff",
        "SCALE":      "background:#2ed573;color:#111",
        "TESTING":    "background:#ffa502;color:#111",
        "MONITOR":    "background:#1e90ff;color:#fff",
        "ENDED_LOSS": "background:#57606f;color:#fff",
        "ENDED_WIN":  "background:#7bed9f;color:#111",
        "ENDED_OK":   "background:#2f3542;color:#aaa",
    }.get(cls, "background:#2f3542;color:#ccc")
    return f'<span style="{style};padding:2px 9px;border-radius:12px;font-size:11px;font-weight:700;">{cls}</span>'


def table_rows(ads: list[dict]) -> str:
    rows = []
    for a in ads:
        ctr     = a.get("ctr") or 0
        roas    = a.get("roas") or 0
        spend   = a.get("spend") or 0
        revenue = a.get("revenue") or 0
        rows.append(
            f"<tr>"
            f"<td>{a.get('ad_id','')}</td>"
            f"<td>{badge(a['_class'])}</td>"
            f"<td>{a.get('platform','')}</td>"
            f"<td>{a.get('brand','')}</td>"
            f"<td>{a.get('creative_theme','')}</td>"
            f"<td>{a.get('target_audience','')}</td>"
            f"<td>{a.get('status','')}</td>"
            f"<td style='text-align:right'>{a.get('days_running','')}</td>"
            f"<td style='text-align:right'>{fmt_inr(spend)}</td>"
            f"<td style='text-align:right;font-weight:600'>{roas:.1f}x</td>"
            f"<td style='text-align:right'>{ctr:.2f}%</td>"
            f"<td style='text-align:right'>{fmt_inr(revenue)}</td>"
            f"</tr>"
        )
    return "\n".join(rows)


def breakdown_table(ads: list[dict], key: str, value_color: str = "#ff4757") -> str:
    totals: dict[str, float] = defaultdict(float)
    for a in ads:
        totals[a.get(key) or "Unknown"] += a.get("spend") or 0
    rows = "".join(
        f"<tr><td>{k}</td>"
        f"<td style='text-align:right;font-weight:600;color:{value_color}'>{fmt_inr(v)}</td></tr>"
        for k, v in sorted(totals.items(), key=lambda x: -x[1])
    )
    return f"<table style='width:100%;border-collapse:collapse'><tbody>{rows}</tbody></table>"


# ── HTML Report ────────────────────────────────────────────────────────────────
def generate_report(ads: list[dict]) -> str:
    kill    = sorted([a for a in ads if a["_class"] == "KILL"],   key=lambda a: -(a.get("spend") or 0))
    scale   = sorted([a for a in ads if a["_class"] == "SCALE"],  key=lambda a: -(a.get("roas")  or 0))
    monitor = sorted([a for a in ads if a["_class"] == "MONITOR"],key=lambda a: -(a.get("spend") or 0))
    testing = sorted([a for a in ads if a["_class"] == "TESTING"],key=lambda a: -(a.get("spend") or 0))
    ended   = [a for a in ads if a["_class"].startswith("ENDED")]

    wasted        = sum(a.get("spend") or 0 for a in kill)
    total_spend   = sum(a.get("spend") or 0 for a in ads)
    total_revenue = sum(a.get("revenue") or 0 for a in ads)
    overall_roas  = (total_revenue / total_spend) if total_spend else 0

    now = datetime.now().strftime("%d %b %Y, %I:%M %p")

    # Platform + brand breakdowns for kill list
    kill_by_platform = breakdown_table(kill, "platform")
    kill_by_brand    = breakdown_table(kill, "brand")

    # Scale spend breakdown (green)
    scale_by_platform = breakdown_table(scale, "platform", "#2ed573")
    scale_by_brand    = breakdown_table(scale, "brand",    "#2ed573")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ad Performance Dashboard</title>
<style>
:root {{
  --bg:     #0d0d14;
  --card:   #16161f;
  --border: #252535;
  --text:   #dde1f0;
  --muted:  #6b6f85;
  --kill:   #ff4757;
  --scale:  #2ed573;
  --watch:  #1e90ff;
  --test:   #ffa502;
}}
* {{ box-sizing:border-box; margin:0; padding:0; }}
body {{ font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        background:var(--bg); color:var(--text); font-size:14px; line-height:1.5; }}

header {{ background:#0a0a12; border-bottom:1px solid var(--border);
          padding:18px 32px; display:flex; align-items:center; justify-content:space-between; }}
header h1 {{ font-size:18px; font-weight:700; letter-spacing:-0.3px; }}
header .meta {{ color:var(--muted); font-size:12px; margin-top:3px; }}

.summary {{ display:grid; grid-template-columns:repeat(5,1fr); gap:14px; padding:24px 32px; }}
.card {{ background:var(--card); border:1px solid var(--border); border-radius:10px; padding:18px 20px; }}
.card .lbl {{ color:var(--muted); font-size:10px; text-transform:uppercase; letter-spacing:1px; }}
.card .val {{ font-size:24px; font-weight:700; margin:6px 0 4px; }}
.card .sub {{ color:var(--muted); font-size:11px; }}
.card.red  {{ border-color:var(--kill); }}   .card.red  .val {{ color:var(--kill); }}
.card.green {{ border-color:var(--scale); }} .card.green .val {{ color:var(--scale); }}
.card.amber {{ border-color:var(--test); }}

.main {{ padding:0 32px 40px; }}

.tabs {{ display:flex; gap:2px; border-bottom:1px solid var(--border); margin-bottom:20px; }}
.tab  {{ padding:9px 18px; cursor:pointer; font-size:13px; font-weight:500;
         color:var(--muted); border-radius:6px 6px 0 0; border:1px solid transparent;
         border-bottom:none; user-select:none; transition:color .15s; }}
.tab:hover {{ color:var(--text); }}
.tab.on {{ background:var(--card); color:var(--text); border-color:var(--border); border-bottom-color:var(--card); }}
.cnt {{ background:var(--border); padding:1px 7px; border-radius:10px; font-size:11px; margin-left:5px; }}
#tab-kill.on  .cnt {{ background:var(--kill); color:#fff; }}
#tab-scale.on .cnt {{ background:var(--scale); color:#111; }}

.panel {{ display:none; }} .panel.on {{ display:block; }}

.criteria {{ background:var(--card); border:1px solid var(--border); border-radius:8px;
             padding:14px 18px; margin-bottom:18px; font-size:13px; color:var(--muted); line-height:1.9; }}
.criteria strong {{ color:var(--text); }}

.grid2 {{ display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:18px; }}
.mini  {{ background:var(--card); border:1px solid var(--border); border-radius:8px; padding:16px; }}
.mini h4 {{ font-size:10px; text-transform:uppercase; letter-spacing:1px; color:var(--muted); margin-bottom:12px; }}
.mini table td {{ padding:5px 0; border-bottom:1px solid var(--border); font-size:13px; }}
.mini table tr:last-child td {{ border:none; }}

.sh {{ display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }}
.sh h3 {{ font-size:14px; font-weight:600; }}
.sh span {{ color:var(--muted); font-size:12px; }}

.filter {{ background:var(--card); border:1px solid var(--border); color:var(--text);
           padding:6px 12px; border-radius:6px; font-size:13px; width:260px; }}
.filter:focus {{ outline:none; border-color:var(--watch); }}

table.dt {{ width:100%; border-collapse:collapse; background:var(--card);
            border:1px solid var(--border); border-radius:10px; overflow:hidden; }}
table.dt th {{ background:#0a0a12; color:var(--muted); font-size:10px; text-transform:uppercase;
               letter-spacing:1px; padding:9px 12px; text-align:left; border-bottom:1px solid var(--border); }}
table.dt td {{ padding:9px 12px; border-bottom:1px solid var(--border); vertical-align:middle; }}
table.dt tr:last-child td {{ border-bottom:none; }}
table.dt tr:hover td {{ background:rgba(255,255,255,.025); }}

.empty {{ color:var(--muted); text-align:center; padding:40px; font-size:13px; }}
</style>
</head>
<body>

<header>
  <div>
    <h1>Ad Performance Dashboard</h1>
    <div class="meta">{len(ads)} ads analyzed · {now}</div>
  </div>
</header>

<div class="summary">
  <div class="card">
    <div class="lbl">Total Ads</div>
    <div class="val">{len(ads)}</div>
    <div class="sub">across all platforms</div>
  </div>
  <div class="card red">
    <div class="lbl">Wasted Spend</div>
    <div class="val">{fmt_inr(wasted)}</div>
    <div class="sub">{len(kill)} active ads to stop</div>
  </div>
  <div class="card green">
    <div class="lbl">Scale Candidates</div>
    <div class="val">{len(scale)}</div>
    <div class="sub">proven high-ROAS ads</div>
  </div>
  <div class="card amber">
    <div class="lbl">Still Testing</div>
    <div class="val">{len(testing)}</div>
    <div class="sub">too early to judge</div>
  </div>
  <div class="card">
    <div class="lbl">Overall ROAS</div>
    <div class="val">{overall_roas:.1f}x</div>
    <div class="sub">{fmt_inr(total_revenue)} on {fmt_inr(total_spend)}</div>
  </div>
</div>

<div class="main">

<div class="tabs">
  <div class="tab on"  id="tab-kill"    onclick="show('kill',this)">Kill List<span class="cnt">{len(kill)}</span></div>
  <div class="tab"     id="tab-scale"   onclick="show('scale',this)">Scale<span class="cnt">{len(scale)}</span></div>
  <div class="tab"     id="tab-monitor" onclick="show('monitor',this)">Monitor<span class="cnt">{len(monitor)}</span></div>
  <div class="tab"     id="tab-testing" onclick="show('testing',this)">Testing<span class="cnt">{len(testing)}</span></div>
  <div class="tab"     id="tab-ended"   onclick="show('ended',this)">Ended<span class="cnt">{len(ended)}</span></div>
  <div class="tab"     id="tab-all"     onclick="show('all',this)">All Ads<span class="cnt">{len(ads)}</span></div>
</div>

<!-- KILL -->
<div class="panel on" id="panel-kill">
  <div class="criteria">
    <strong>Kill criteria (active ads only):</strong>
    ROAS &lt; <strong>{ROAS_KILL}x</strong>
    AND ( running ≥ <strong>{MIN_DAYS_TO_DECIDE} days</strong>
          OR spent ≥ <strong>{fmt_inr(MIN_SPEND_TO_DECIDE)}</strong> )
    — these ads have had enough time and budget to prove themselves, and haven't.
  </div>
  <div class="grid2">
    <div class="mini"><h4>Wasted spend by platform</h4>{kill_by_platform}</div>
    <div class="mini"><h4>Wasted spend by brand</h4>{kill_by_brand}</div>
  </div>
  <div class="sh">
    <h3>Stop these {len(kill)} ads immediately</h3>
    <span>Total recoverable: {fmt_inr(wasted)}</span>
  </div>
  {'<table class="dt"><thead><tr><th>Ad ID</th><th>Action</th><th>Platform</th><th>Brand</th><th>Creative Theme</th><th>Audience</th><th>Status</th><th>Days</th><th>Spend</th><th>ROAS</th><th>CTR</th><th>Revenue</th></tr></thead><tbody>' + table_rows(kill) + '</tbody></table>' if kill else '<div class="empty">No ads to kill — great!</div>'}
</div>

<!-- SCALE -->
<div class="panel" id="panel-scale">
  <div class="criteria">
    <strong>Scale criteria:</strong>
    ROAS ≥ <strong>{ROAS_SCALE}x</strong>
    AND spent ≥ <strong>{fmt_inr(MIN_SPEND_FOR_SCALE)}</strong>
    AND status Active
    — proven performers, increase budget on these.
  </div>
  <div class="grid2">
    <div class="mini"><h4>Scale candidates by platform</h4>{scale_by_platform}</div>
    <div class="mini"><h4>Scale candidates by brand</h4>{scale_by_brand}</div>
  </div>
  <div class="sh">
    <h3>Increase budget on these {len(scale)} ads</h3>
    <span>Sorted by ROAS (highest first)</span>
  </div>
  {'<table class="dt"><thead><tr><th>Ad ID</th><th>Action</th><th>Platform</th><th>Brand</th><th>Creative Theme</th><th>Audience</th><th>Status</th><th>Days</th><th>Spend</th><th>ROAS</th><th>CTR</th><th>Revenue</th></tr></thead><tbody>' + table_rows(scale) + '</tbody></table>' if scale else '<div class="empty">No scale candidates found.</div>'}
</div>

<!-- MONITOR -->
<div class="panel" id="panel-monitor">
  <div class="criteria">
    <strong>Monitor:</strong> Active, proven (≥{MIN_DAYS_TO_DECIDE} days or ≥{fmt_inr(MIN_SPEND_TO_DECIDE)} spend),
    ROAS between <strong>{ROAS_KILL}x – {ROAS_SCALE}x</strong>.
    Not bad enough to kill, not strong enough to scale. Watch for trend direction.
  </div>
  <div class="sh">
    <h3>{len(monitor)} ads to watch</h3>
    <span>Sorted by spend (highest first)</span>
  </div>
  {'<table class="dt"><thead><tr><th>Ad ID</th><th>Action</th><th>Platform</th><th>Brand</th><th>Creative Theme</th><th>Audience</th><th>Status</th><th>Days</th><th>Spend</th><th>ROAS</th><th>CTR</th><th>Revenue</th></tr></thead><tbody>' + table_rows(monitor) + '</tbody></table>' if monitor else '<div class="empty">No monitor ads.</div>'}
</div>

<!-- TESTING -->
<div class="panel" id="panel-testing">
  <div class="criteria">
    <strong>Still testing:</strong> Active ads with &lt;{MIN_DAYS_TO_DECIDE} days running
    AND &lt;{fmt_inr(MIN_SPEND_TO_DECIDE)} spend.
    <strong>No action yet</strong> — let these run until they hit the decision threshold.
  </div>
  <div class="sh">
    <h3>{len(testing)} ads in early testing</h3>
    <span>Sorted by spend (highest first)</span>
  </div>
  {'<table class="dt"><thead><tr><th>Ad ID</th><th>Action</th><th>Platform</th><th>Brand</th><th>Creative Theme</th><th>Audience</th><th>Status</th><th>Days</th><th>Spend</th><th>ROAS</th><th>CTR</th><th>Revenue</th></tr></thead><tbody>' + table_rows(testing) + '</tbody></table>' if testing else '<div class="empty">No testing ads.</div>'}
</div>

<!-- ENDED -->
<div class="panel" id="panel-ended">
  <div class="criteria">
    Completed or paused ads — shown for historical context only.
    <strong>ENDED_WIN</strong> = high ROAS winner ·
    <strong>ENDED_LOSS</strong> = proven loser (avoid similar creatives) ·
    <strong>ENDED_OK</strong> = neutral.
  </div>
  <div class="sh">
    <h3>{len(ended)} ended ads</h3><span></span>
  </div>
  {'<table class="dt"><thead><tr><th>Ad ID</th><th>Outcome</th><th>Platform</th><th>Brand</th><th>Creative Theme</th><th>Audience</th><th>Status</th><th>Days</th><th>Spend</th><th>ROAS</th><th>CTR</th><th>Revenue</th></tr></thead><tbody>' + table_rows(ended) + '</tbody></table>' if ended else '<div class="empty">No ended ads.</div>'}
</div>

<!-- ALL -->
<div class="panel" id="panel-all">
  <div class="sh">
    <h3>All {len(ads)} ads</h3>
    <input class="filter" type="text" placeholder="Filter by ID, platform, brand, theme…" oninput="filterAll(this)">
  </div>
  <table class="dt" id="tbl-all">
    <thead>
      <tr><th>Ad ID</th><th>Action</th><th>Platform</th><th>Brand</th><th>Creative Theme</th>
          <th>Audience</th><th>Status</th><th>Days</th><th>Spend</th><th>ROAS</th><th>CTR</th><th>Revenue</th></tr>
    </thead>
    <tbody>{table_rows(ads)}</tbody>
  </table>
</div>

</div><!-- .main -->

<script>
function show(name, el) {{
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
  document.getElementById('panel-' + name).classList.add('on');
  el.classList.add('on');
}}
function filterAll(inp) {{
  const q = inp.value.toLowerCase();
  document.querySelectorAll('#tbl-all tbody tr').forEach(r => {{
    r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none';
  }});
}}
</script>
</body>
</html>"""


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print("Ad Performance Analyzer")
    print("─" * 40)

    print("Fetching ad data from API...")
    ads = fetch_all_ads()

    print("Classifying ads...")
    ads = analyze(ads)

    kill    = [a for a in ads if a["_class"] == "KILL"]
    scale   = [a for a in ads if a["_class"] == "SCALE"]
    monitor = [a for a in ads if a["_class"] == "MONITOR"]
    testing = [a for a in ads if a["_class"] == "TESTING"]
    wasted  = sum(a.get("spend") or 0 for a in kill)

    print(f"\nSummary")
    print(f"  Total ads  : {len(ads)}")
    print(f"  Kill       : {len(kill)}  ← stop these")
    print(f"  Scale      : {len(scale)}  ← increase budget")
    print(f"  Monitor    : {len(monitor)}")
    print(f"  Testing    : {len(testing)}")
    print(f"  Wasted     : {fmt_inr(wasted)}")

    print("\nGenerating report...")
    html = generate_report(ads)
    out  = Path(__file__).parent / "report.html"
    out.write_text(html, encoding="utf-8")
    print(f"Saved → {out}")

    webbrowser.open(out.as_uri())


if __name__ == "__main__":
    main()
