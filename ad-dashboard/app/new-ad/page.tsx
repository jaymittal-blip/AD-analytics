"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  FileEdit, FileUp, Download, RefreshCw, CloudUpload,
  CheckCircle2, AlertCircle, Loader2, Plus, Link2Off, Clock,
  Zap, Unplug,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface FormData {
  ad_id: string; platform: string; brand: string; category: string;
  ad_type: string; target_audience: string; creative_theme: string;
  status: string; start_date: string; spend: string;
  product: string; landing_page: string;
}
type StatusMsg = { ok: boolean; text: string } | null;
interface SheetsStatus { oauthReady: boolean; connected: boolean; sheetConfig: { sheetId: string; lastSync: string | null } | null }
interface AdMeta { platforms: string[]; adTypes: string[]; brands: string[]; categories: string[]; themes: string[]; audiences: string[] }
interface MetaStatus { connected: boolean; account_name?: string; account_id?: string; error?: string }

const FALLBACK_PLATFORMS = ["YouTube", "Meta", "Google", "Instagram", "TikTok", "X (Twitter)"];
const FALLBACK_AD_TYPES  = ["Video Reel", "Static Carousel", "Image Post", "Story", "Search Ad", "Display Ad"];
const STATUSES           = ["Active", "Paused", "Completed"];

const DB_COLUMNS = new Set([
  "ad_id","platform","brand","category","ad_type","target_audience","creative_theme",
  "status","start_date","days_running","spend","revenue","roas","impressions","clicks",
  "ctr","conversions","cpc","cpa","creative_score","landing_page_score","frequency",
  "video_completion_rate","product","landing_page",
]);
const NUMERIC_COLS  = new Set(["days_running","spend","revenue","roas","impressions","clicks","ctr","conversions","cpc","cpa","creative_score","landing_page_score","frequency","video_completion_rate"]);
const NULLABLE_COLS = new Set(["video_completion_rate"]);

const BLANK: FormData = {
  ad_id: "", platform: "", brand: "", category: "", ad_type: "",
  target_audience: "", creative_theme: "", status: "Active",
  start_date: new Date().toISOString().split("T")[0], spend: "",
  product: "", landing_page: "",
};

// ── Shared input primitives ───────────────────────────────────────────────────
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">{label}</label>
      {children}
      {error && <p className="text-[11px] text-error mt-0.5">{error}</p>}
    </div>
  );
}
function Input({ className = "", ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...p}
      className={`w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all ${className}`}
    />
  );
}
function Select({ className = "", ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p}
      className={`w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all ${className}`}
    />
  );
}
function StatusBanner({ msg }: { msg: StatusMsg }) {
  if (!msg) return null;
  return (
    <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border text-[12px] ${msg.ok ? "bg-secondary-container/50 border-secondary/30 text-on-secondary-container" : "bg-error-container/30 border-error/20 text-error"}`}>
      {msg.ok ? <CheckCircle2 size={13} strokeWidth={1.75} className="mt-0.5 shrink-0" /> : <AlertCircle size={13} strokeWidth={1.75} className="mt-0.5 shrink-0" />}
      <span>{msg.text}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function NewAdPage() {
  const router = useRouter();

  const [meta, setMeta] = useState<AdMeta>({
    platforms: FALLBACK_PLATFORMS, adTypes: FALLBACK_AD_TYPES,
    brands: [], categories: [], themes: [], audiences: [],
  });

  useEffect(() => {
    fetch("/api/ads/meta").then(r => r.json()).then((d: AdMeta) => {
      setMeta({
        platforms:  d.platforms?.length  ? d.platforms  : FALLBACK_PLATFORMS,
        adTypes:    d.adTypes?.length    ? d.adTypes    : FALLBACK_AD_TYPES,
        brands:     d.brands    ?? [],
        categories: d.categories ?? [],
        themes:     d.themes    ?? [],
        audiences:  d.audiences ?? [],
      });
      setForm(prev => ({
        ...prev,
        platform: prev.platform || (d.platforms?.[0] ?? FALLBACK_PLATFORMS[0]),
        ad_type:  prev.ad_type  || (d.adTypes?.[0]  ?? FALLBACK_AD_TYPES[0]),
        brand:    prev.brand    || "",
      }));
    }).catch(() => {});
  }, []);

  // Manual entry
  const [form,       setForm]       = useState<FormData>(BLANK);
  const [errors,     setErrors]     = useState<Partial<FormData>>({});
  const [formStatus, setFormStatus] = useState<StatusMsg>(null);
  const [submitting, setSubmitting] = useState(false);

  // CSV upload
  const [csvFile,   setCsvFile]   = useState<File | null>(null);
  const [csvDrag,   setCsvDrag]   = useState(false);
  const [csvStatus, setCsvStatus] = useState<StatusMsg>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Google Sheets
  const [sheetUrl,    setSheetUrl]    = useState("");
  const [sheetStatus, setSheetStatus] = useState<SheetsStatus | null>(null);
  const [hasSynced,   setHasSynced]   = useState(false);
  const [syncing,     setSyncing]     = useState(false);
  const [syncMsg,     setSyncMsg]     = useState<StatusMsg>(null);

  // Meta Ads
  const [metaStatus,    setMetaStatus]    = useState<MetaStatus | null>(null);
  const [metaToken,     setMetaToken]     = useState("");
  const [metaAccountId, setMetaAccountId] = useState("");
  const [metaConnecting, setMetaConnecting] = useState(false);
  const [metaMsg,       setMetaMsg]       = useState<StatusMsg>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("sheets_connected")) {
      setSyncMsg({ ok: true, text: "Google Account connected! Paste a sheet URL to sync." });
      window.history.replaceState({}, "", "/new-ad");
    }
    if (p.get("sheets_error")) {
      setSyncMsg({ ok: false, text: `Google auth failed: ${p.get("sheets_error")}` });
      window.history.replaceState({}, "", "/new-ad");
    }
    fetchSheetsStatus();
    fetch("/api/meta/status").then(r => r.json()).then((d: MetaStatus) => setMetaStatus(d)).catch(() => {});
  }, []);

  const fetchSheetsStatus = useCallback(async () => {
    const [sr, cr] = await Promise.all([
      fetch("/api/sheets/status", { cache: "no-store" }),
      fetch("/api/sheets/config",  { cache: "no-store" }),
    ]);
    const d = await sr.json() as SheetsStatus;
    setSheetStatus(d);
    if (d.sheetConfig?.sheetId && d.sheetConfig.sheetId !== "apps-script") {
      setSheetUrl(`https://docs.google.com/spreadsheets/d/${d.sheetConfig.sheetId}/edit`);
    } else {
      setSheetUrl("");
    }
    await cr.json();
  }, []);

  function validate(): boolean {
    const e: Partial<FormData> = {};
    if (!form.ad_id.trim())           e.ad_id           = "Required";
    if (!form.brand.trim())           e.brand           = "Required";
    if (!form.category.trim())        e.category        = "Required";
    if (!form.target_audience.trim()) e.target_audience = "Required";
    if (!form.creative_theme.trim())  e.creative_theme  = "Required";
    if (!form.spend || isNaN(Number(form.spend))) e.spend = "Valid spend required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true); setFormStatus(null);
    try {
      const r    = await fetch("/api/ads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, spend: Number(form.spend) }) });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setFormStatus({ ok: true, text: `Ad ${form.ad_id} added! Redirecting…` });
      setForm(prev => ({ ...BLANK, platform: prev.platform, ad_type: prev.ad_type }));
      setErrors({});
      setTimeout(() => { router.refresh(); router.push("/"); }, 1200);
    } catch (err) { setFormStatus({ ok: false, text: String(err) }); }
    finally      { setSubmitting(false); }
  }

  function handleFileChange(file: File | null) {
    if (!file) return;
    if (!file.name.endsWith(".csv")) { setCsvStatus({ ok: false, text: "Only .csv files are accepted." }); return; }
    setCsvFile(file); setCsvStatus(null);
  }

  async function handleCsvUpload() {
    if (!csvFile) return;
    setUploading(true); setCsvStatus(null);
    try {
      const lines = (await csvFile.text()).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
      if (lines.length < 2) throw new Error("File has no data rows.");
      const rawHeaders = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
      if (!rawHeaders.includes("ad_id")) throw new Error("Column 'ad_id' is missing.");
      if (!rawHeaders.includes("brand")) throw new Error("Column 'brand' is missing.");
      const dbHeaders = rawHeaders.map(h => DB_COLUMNS.has(h) ? h : null);
      const ads: Record<string, unknown>[] = [];
      const rowErrors: string[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c => c.trim());
        const rec: Record<string, unknown> = {};
        dbHeaders.forEach((col, idx) => {
          if (!col) return;
          const raw = (cols[idx] ?? "").trim();
          if (raw === "") return;
          rec[col] = NUMERIC_COLS.has(col) ? Number(raw) : raw;
        });
        const adId = String(rec.ad_id ?? "").trim();
        const brand = String(rec.brand ?? "").trim();
        if (!adId)  { rowErrors.push(`Row ${i + 1}: missing ad_id`);  continue; }
        if (!brand) { rowErrors.push(`Row ${i + 1}: missing brand`);   continue; }
        rec.ad_id = adId; rec.brand = brand;
        ads.push(rec);
      }
      if (ads.length === 0) throw new Error(`No valid rows.${rowErrors.length ? " " + rowErrors.slice(0,3).join("; ") : ""}`);
      let added = 0, updated = 0;
      for (const ad of ads) {
        const r = await fetch("/api/ads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ad) });
        const d = await r.json();
        if (!r.ok) { rowErrors.push(`${ad.ad_id}: ${d.error ?? "error"}`); continue; }
        added += d.added ?? 0; updated += d.updated ?? 0;
      }
      const msg = [added ? `${added} added` : "", updated ? `${updated} updated` : ""].filter(Boolean).join(", ") || "0 changes";
      setCsvStatus({ ok: true, text: `Done — ${msg}.${rowErrors.length ? ` ${rowErrors.length} rows skipped.` : ""} Redirecting…` });
      setCsvFile(null);
      router.refresh();
      setTimeout(() => router.push("/"), 800);
    } catch (err) { setCsvStatus({ ok: false, text: String(err) }); }
    finally      { setUploading(false); }
  }

  async function handleSync() {
    if (!sheetUrl.trim()) { setSyncMsg({ ok: false, text: "Paste a Google Sheets URL first." }); return; }
    setSyncing(true); setSyncMsg(null);
    try {
      const r    = await fetch("/api/sheets/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sheetUrl: sheetUrl.trim() }) });
      const data = await r.json();
      if (data.error) throw new Error(data.error);

      setHasSynced(true);
      setSyncMsg({ ok: true, text: `Synced ${data.total} rows — ${data.added} added, ${data.updated} updated.` });
      setTimeout(() => router.push("/"), 1500);
    } catch (err) { setSyncMsg({ ok: false, text: String(err) }); }
    finally      { setSyncing(false); }
  }

  async function handleDisconnect() {
    await fetch("/api/sheets/disconnect", { method: "POST" });
    setSheetUrl("");
    await fetchSheetsStatus();
    setSyncMsg({ ok: true, text: "Google account disconnected." });
  }

  async function handleUnsync() {
    await fetch("/api/sheets/unsync", { method: "POST" });
    setSheetUrl("");
    setHasSynced(false);
    setSheetStatus(prev => prev ? { ...prev, sheetConfig: null } : null);
    setSyncMsg({ ok: true, text: "Sheet unsynced. Paste a new URL to sync a different sheet." });
    fetchSheetsStatus().catch(() => {});
  }

  async function handleMetaConnect() {
    setMetaConnecting(true); setMetaMsg(null);
    try {
      const r    = await fetch("/api/meta/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: metaToken, account_id: metaAccountId }) });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setMetaMsg({ ok: true, text: `Connected to "${data.account_name}" — Meta Ads actions are now enabled.` });
      setMetaStatus({ connected: true, account_name: data.account_name, account_id: metaAccountId });
      setMetaToken(""); setMetaAccountId("");
    } catch (err) { setMetaMsg({ ok: false, text: String(err) }); }
    finally      { setMetaConnecting(false); }
  }

  async function handleMetaDisconnect() {
    await fetch("/api/meta/connect", { method: "DELETE" });
    setMetaStatus({ connected: false });
    setMetaMsg({ ok: true, text: "Meta Ads disconnected." });
  }

  const f = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="flex items-center h-16 px-6 bg-surface-container-lowest border-b border-outline-variant shrink-0">
        <div>
          <h2 className="text-sm font-extrabold text-on-surface tracking-tight">New Analysis</h2>
          <p className="text-[10px] text-on-surface-variant">Add ads via manual entry, CSV upload, or Google Sheets sync.</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        <div className="max-w-6xl mx-auto grid grid-cols-12 gap-5">

          {/* ── Left: Manual Entry ──────────────────────────────────────── */}
          <section className="col-span-12 lg:col-span-7 bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-card">
            <div className="px-5 py-3.5 border-b border-outline-variant bg-surface-container flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileEdit size={15} strokeWidth={1.75} className="text-primary" />
                <h3 className="text-sm font-semibold text-on-surface">Manual Data Entry</h3>
              </div>
              <span className="text-[10px] text-on-surface-variant/60 uppercase tracking-wide">* required</span>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ad ID *" error={errors.ad_id}>
                  <Input placeholder="e.g. AD-99201" value={form.ad_id} onChange={f("ad_id")} />
                </Field>
                <Field label="Platform *">
                  <Select value={form.platform} onChange={f("platform")}>
                    {meta.platforms.map(p => <option key={p}>{p}</option>)}
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Brand *" error={errors.brand}>
                  <Select value={form.brand} onChange={f("brand")}>
                    <option value="">Select brand…</option>
                    {meta.brands.map(b => <option key={b}>{b}</option>)}
                  </Select>
                </Field>
                <Field label="Category *" error={errors.category}>
                  <Input placeholder="e.g. Hair Care" value={form.category} onChange={f("category")} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ad Type *">
                  <Select value={form.ad_type} onChange={f("ad_type")}>
                    {meta.adTypes.map(t => <option key={t}>{t}</option>)}
                  </Select>
                </Field>
                <Field label="Creative Theme *" error={errors.creative_theme}>
                  <Input placeholder="e.g. Doctor Trust" value={form.creative_theme} onChange={f("creative_theme")} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Target Audience *" error={errors.target_audience}>
                  <Input placeholder="e.g. M 25–34" value={form.target_audience} onChange={f("target_audience")} />
                </Field>
                <Field label="Status">
                  <Select value={form.status} onChange={f("status")}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start Date *">
                  <Input type="date" value={form.start_date} onChange={f("start_date")} />
                </Field>
                <Field label="Spend (₹) *" error={errors.spend}>
                  <Input type="number" placeholder="0.00" min="0" step="0.01" value={form.spend} onChange={f("spend")} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Product Name (optional)">
                  <Input placeholder="e.g. Hair Growth Kit" value={form.product} onChange={f("product")} />
                </Field>
                <Field label="Landing Page URL (optional)">
                  <Input type="url" placeholder="https://…" value={form.landing_page} onChange={f("landing_page")} />
                </Field>
              </div>

              <StatusBanner msg={formStatus} />

              <div className="flex justify-end pt-1">
                <button onClick={handleSubmit} disabled={submitting}
                  className="flex items-center gap-2 bg-primary text-on-primary px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-container disabled:opacity-50 transition-all">
                  {submitting ? <Loader2 size={15} strokeWidth={2} className="animate-spin" /> : <Plus size={15} strokeWidth={2.5} />}
                  {submitting ? "Adding…" : "Add to Dashboard"}
                </button>
              </div>
            </div>
          </section>

          {/* ── Right column ────────────────────────────────────────────── */}
          <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">

            {/* CSV Bulk Upload */}
            <section className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-card">
              <div className="px-5 py-4 border-b border-outline-variant bg-surface-container flex items-center gap-3">
                <FileUp size={18} strokeWidth={1.75} className="text-secondary shrink-0" />
                <h3 className="text-xl font-extrabold tracking-tight text-on-surface">Bulk Upload</h3>
              </div>
              <div className="p-4 space-y-3">
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setCsvDrag(true); }}
                  onDragLeave={() => setCsvDrag(false)}
                  onDrop={e => { e.preventDefault(); setCsvDrag(false); handleFileChange(e.dataTransfer.files[0]); }}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${csvDrag ? "border-secondary bg-secondary/5" : "border-outline-variant hover:border-secondary/50"}`}
                >
                  <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => handleFileChange(e.target.files?.[0] ?? null)} />
                  <CloudUpload size={28} strokeWidth={1.25} className="mx-auto mb-1.5 text-on-surface-variant/40" />
                  {csvFile
                    ? <p className="text-sm font-semibold text-secondary">{csvFile.name}</p>
                    : <p className="text-sm text-on-surface-variant">Drag & drop or <span className="text-secondary underline cursor-pointer">browse</span></p>}
                  <p className="text-[11px] text-on-surface-variant/50 mt-0.5">CSV only · max 5MB</p>
                </div>

                <StatusBanner msg={csvStatus} />

                <div className="flex items-center gap-2">
                  <button onClick={handleCsvUpload} disabled={!csvFile || uploading}
                    className="flex-1 flex items-center justify-center gap-2 bg-secondary text-on-secondary py-2 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all">
                    {uploading ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : <FileUp size={14} strokeWidth={2} />}
                    {uploading ? "Importing…" : "Import CSV"}
                  </button>
                  <a href="/api/sheets/template"
                    className="flex items-center gap-1.5 text-[12px] text-on-surface-variant hover:text-secondary transition-colors whitespace-nowrap">
                    <Download size={13} strokeWidth={1.75} />
                    Template
                  </a>
                </div>
              </div>
            </section>

            {/* Google Sheets Sync */}
            <section className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-card">
              <div className="px-5 py-4 border-b border-outline-variant bg-surface-container flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <RefreshCw size={18} strokeWidth={1.75} className="text-tertiary shrink-0" />
                  <h3 className="text-xl font-extrabold tracking-tight text-on-surface">Google Sheets Sync</h3>
                </div>
                {sheetStatus?.connected && (
                  <span className="flex items-center gap-1 text-[11px] text-secondary font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                    Connected
                  </span>
                )}
              </div>
              <div className="p-4 space-y-3">
                {/* Compact instructions */}
                <div className="bg-surface-container rounded-xl p-3 space-y-1.5 text-[12px] text-on-surface-variant">
                  <p><span className="font-semibold text-on-surface">1.</span> Share your sheet → Anyone with link → Viewer</p>
                  <p><span className="font-semibold text-on-surface">2.</span> Paste the URL below and click <strong className="text-on-surface">Sync Now</strong></p>
                  <p className="flex items-center gap-1 text-[11px] text-on-surface-variant/60 pt-0.5 border-t border-outline-variant/40">
                    <RefreshCw size={10} strokeWidth={2} /> Re-checks every 2 minutes automatically
                  </p>
                </div>

                {/* Connected sheet URL display */}
                {(sheetStatus?.sheetConfig?.sheetId || hasSynced) && (
                  <div className="bg-secondary-container/20 border border-secondary/20 rounded-xl px-3 py-2.5 space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-secondary">Last Connected Sheet</p>
                    <a
                      href={sheetUrl || (sheetStatus?.sheetConfig?.sheetId ? `https://docs.google.com/spreadsheets/d/${sheetStatus.sheetConfig.sheetId}/edit` : "#")}
                      target="_blank" rel="noopener noreferrer"
                      className="text-[12px] text-on-surface underline underline-offset-2 break-all line-clamp-1 hover:text-secondary transition-colors"
                    >
                      {sheetUrl || (sheetStatus?.sheetConfig?.sheetId ? `https://docs.google.com/spreadsheets/d/${sheetStatus.sheetConfig.sheetId}/edit` : "")}
                    </a>
                    {sheetStatus?.sheetConfig?.lastSync && (
                      <p className="flex items-center gap-1 text-[11px] text-on-surface-variant">
                        <Clock size={11} strokeWidth={1.75} />
                        Last synced: {new Date(sheetStatus.sheetConfig.lastSync).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Google Sheet URL</label>
                  <Input placeholder="https://docs.google.com/spreadsheets/d/…" value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} />
                </div>

                <StatusBanner msg={syncMsg} />

                <button onClick={handleSync} disabled={syncing || !sheetUrl.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-tertiary/15 border border-tertiary/30 text-tertiary py-2 rounded-xl text-sm font-semibold hover:bg-tertiary/25 disabled:opacity-40 transition-all">
                  {syncing ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : <RefreshCw size={14} strokeWidth={2} />}
                  {syncing ? "Syncing…" : "Sync Now"}
                </button>

                {(sheetStatus?.sheetConfig?.sheetId || hasSynced) && (
                  <button onClick={handleUnsync}
                    className="w-full flex items-center justify-center gap-1.5 border border-outline-variant text-on-surface-variant py-1.5 rounded-xl text-[12px] hover:bg-surface-container transition-all">
                    <Link2Off size={13} strokeWidth={1.75} />
                    Unsync Sheet
                  </button>
                )}

                {sheetStatus?.connected && (
                  <button onClick={handleDisconnect}
                    className="w-full flex items-center justify-center gap-1.5 border border-outline-variant text-on-surface-variant py-1.5 rounded-xl text-[12px] hover:bg-surface-container transition-all">
                    <Link2Off size={13} strokeWidth={1.75} />
                    Disconnect Google Account
                  </button>
                )}
              </div>
            </section>

            {/* Meta Ads Integration */}
            <section className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-card">
              <div className="px-5 py-4 border-b border-outline-variant bg-surface-container flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Zap size={18} strokeWidth={1.75} className="text-[#1877F2] shrink-0" />
                  <h3 className="text-xl font-extrabold tracking-tight text-on-surface">Meta Ads</h3>
                </div>
                {metaStatus?.connected && (
                  <span className="flex items-center gap-1 text-[11px] text-secondary font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                    Connected
                  </span>
                )}
              </div>
              <div className="p-4 space-y-3">
                {metaStatus?.connected ? (
                  <>
                    <div className="bg-secondary-container/30 border border-secondary/20 rounded-xl px-3 py-2.5 text-[12px] text-on-secondary-container">
                      <p className="font-semibold">{metaStatus.account_name}</p>
                      <p className="text-on-surface-variant">act_{metaStatus.account_id} · Kill and Scale actions enabled</p>
                    </div>
                    <StatusBanner msg={metaMsg} />
                    <button onClick={handleMetaDisconnect}
                      className="w-full flex items-center justify-center gap-1.5 border border-outline-variant text-on-surface-variant py-1.5 rounded-xl text-[12px] hover:bg-surface-container transition-all">
                      <Unplug size={13} strokeWidth={1.75} />
                      Disconnect Meta Account
                    </button>
                  </>
                ) : (
                  <>
                    <div className="bg-surface-container rounded-xl p-3 text-[12px] text-on-surface-variant space-y-1">
                      <p><span className="font-semibold text-on-surface">Required credentials:</span></p>
                      <p>• <strong>Access Token</strong> — from Meta Business Manager → System Users → Generate Token (ads_management permission)</p>
                      <p>• <strong>Ad Account ID</strong> — found in Meta Ads Manager (format: act_XXXXXXXXXX or just the number)</p>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Access Token</label>
                        <Input type="password" placeholder="EAAxxxxxxxx…" value={metaToken} onChange={e => setMetaToken(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Ad Account ID</label>
                        <Input placeholder="act_XXXXXXXXXX or just the number" value={metaAccountId} onChange={e => setMetaAccountId(e.target.value)} />
                      </div>
                    </div>
                    <StatusBanner msg={metaMsg} />
                    <button onClick={handleMetaConnect} disabled={metaConnecting || !metaToken.trim() || !metaAccountId.trim()}
                      className="w-full flex items-center justify-center gap-2 bg-[#1877F2] text-white py-2 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all">
                      {metaConnecting ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : <Zap size={14} strokeWidth={2} />}
                      {metaConnecting ? "Connecting…" : "Connect Meta Ads"}
                    </button>
                  </>
                )}
              </div>
            </section>

            {/* Entry Guidelines — compact */}
            <section className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 shadow-card">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold mb-2">Entry Guidelines</p>
              <ul className="space-y-1.5">
                {[
                  "Spend values in ₹ (INR).",
                  "Ad IDs must be unique — duplicates overwrite existing records.",
                  "Only ad_id and brand are mandatory.",
                  "New ads default to TESTING until metrics are updated.",
                  "Ads appear in Analytics dashboard after import.",
                ].map(tip => (
                  <li key={tip} className="flex items-start gap-2 text-[12px] text-on-surface-variant">
                    <CheckCircle2 size={12} strokeWidth={2} className="text-secondary shrink-0 mt-0.5" />
                    {tip}
                  </li>
                ))}
              </ul>
            </section>
          </div>

        </div>
      </div>
    </div>
  );
}
