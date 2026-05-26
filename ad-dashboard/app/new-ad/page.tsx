"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface FormData {
  ad_id: string; platform: string; brand: string; category: string;
  ad_type: string; target_audience: string; creative_theme: string;
  status: string; start_date: string; spend: string;
  product: string; landing_page: string;
}
type StatusMsg = { ok: boolean; text: string } | null;
interface SheetsStatus { oauthReady: boolean; connected: boolean; sheetConfig: { sheetId: string; lastSync: string | null } | null }

const BLANK: FormData = {
  ad_id: "", platform: "YouTube", brand: "", category: "", ad_type: "Video Reel",
  target_audience: "", creative_theme: "", status: "Active",
  start_date: new Date().toISOString().split("T")[0], spend: "",
  product: "", landing_page: "",
};
const PLATFORMS   = ["YouTube", "Meta", "Google", "Instagram", "TikTok", "X (Twitter)"];
const AD_TYPES    = ["Video Reel", "Static Carousel", "Image Post", "Story", "Search Ad", "Display Ad"];
const STATUSES    = ["Active", "Paused", "Completed"];
const REQUIRED_COLS = ["ad_id","platform","brand","category","ad_type","target_audience","creative_theme","status","start_date","days_running","spend"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">{label}</label>
      {children}
      {error && <p className="text-[11px] text-primary-container mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-[13px]">error</span>{error}</p>}
    </div>
  );
}
function Input({ className = "", ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...p}
      className={`w-full bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all ${className}`}
    />
  );
}
function Select({ className = "", ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...p}
      className={`w-full bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all ${className}`}
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function NewAdPage() {
  // Manual entry
  const [form,       setForm]       = useState<FormData>(BLANK);
  const [errors,     setErrors]     = useState<Partial<FormData>>({});
  const [formStatus, setFormStatus] = useState<StatusMsg>(null);
  const [submitting, setSubmitting] = useState(false);

  // CSV upload
  const [csvFile,    setCsvFile]    = useState<File | null>(null);
  const [csvDrag,    setCsvDrag]    = useState(false);
  const [csvStatus,  setCsvStatus]  = useState<StatusMsg>(null);
  const [uploading,  setUploading]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Google Sheets
  const [sheetUrl,    setSheetUrl]    = useState("");
  const [sheetStatus, setSheetStatus] = useState<SheetsStatus | null>(null);
  const [syncing,     setSyncing]     = useState(false);
  const [syncMsg,     setSyncMsg]     = useState<StatusMsg>(null);
  const [oauthErr,    setOauthErr]    = useState<string | null>(null);
  const [showSetup,   setShowSetup]   = useState(false);

  // Read URL params (after OAuth redirect)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("sheets_connected")) {
      setSyncMsg({ ok: true, text: "Google Account connected successfully! Paste a sheet URL to sync." });
      window.history.replaceState({}, "", "/new-ad");
    }
    if (p.get("sheets_error")) {
      setSyncMsg({ ok: false, text: `Google auth failed: ${p.get("sheets_error")}` });
      window.history.replaceState({}, "", "/new-ad");
    }
    fetchSheetsStatus();
  }, []);

  const fetchSheetsStatus = useCallback(async () => {
    const r = await fetch("/api/sheets/status");
    const d = await r.json() as SheetsStatus;
    setSheetStatus(d);
    if (d.sheetConfig?.sheetId) {
      setSheetUrl(`https://docs.google.com/spreadsheets/d/${d.sheetConfig.sheetId}/edit`);
    }
  }, []);

  // ── Manual entry submit ───────────────────────────────────────────────────
  function validate(): boolean {
    const e: Partial<FormData> = {};
    if (!form.ad_id.trim())       e.ad_id       = "Ad ID is required";
    if (!form.brand.trim())       e.brand       = "Brand is required";
    if (!form.category.trim())    e.category    = "Category is required";
    if (!form.target_audience.trim()) e.target_audience = "Audience is required";
    if (!form.creative_theme.trim())  e.creative_theme  = "Creative theme is required";
    if (!form.spend || isNaN(Number(form.spend))) e.spend = "Valid spend amount is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    setFormStatus(null);
    try {
      const r    = await fetch("/api/custom-ads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, spend: Number(form.spend) }) });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setFormStatus({ ok: true, text: `Ad ${form.ad_id} added successfully. It will appear in the Analytics dashboard.` });
      setForm(BLANK);
      setErrors({});
    } catch (err) {
      setFormStatus({ ok: false, text: String(err) });
    } finally {
      setSubmitting(false);
    }
  }

  // ── CSV upload ────────────────────────────────────────────────────────────
  function handleFileChange(file: File | null) {
    if (!file) return;
    if (!file.name.endsWith(".csv")) { setCsvStatus({ ok: false, text: "Only .csv files are accepted." }); return; }
    setCsvFile(file);
    setCsvStatus(null);
  }

  async function handleCsvUpload() {
    if (!csvFile) return;
    setUploading(true);
    setCsvStatus(null);
    try {
      const text    = await csvFile.text();
      const lines   = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) throw new Error("File has no data rows.");

      const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_").replace(/\s/g, ""));
      const missing = REQUIRED_COLS.filter(c => !headers.includes(c));
      if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}. Download the sample template.`);

      const rows: Record<string, string>[] = [];
      const rowErrors: string[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols   = lines[i].split(",").map(c => c.trim());
        const record: Record<string, string> = {};
        headers.forEach((h, idx) => { record[h] = cols[idx] ?? ""; });
        if (!record.ad_id) { rowErrors.push(`Row ${i + 1}: missing ad_id`); continue; }
        rows.push(record);
      }

      // Send to sync API (reuse same import logic)
      const resp = await fetch("/api/sheets/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl: "_csv_upload_", _csvRows: rows }),
      });
      // Actually — POST directly to custom-ads endpoint in bulk
      // We'll do the import client-side since CSV is already parsed
      const ads = rows.map(r => ({
        ad_id: r.ad_id?.trim(), platform: r.platform, brand: r.brand,
        category: r.category, ad_type: r.ad_type, target_audience: r.target_audience,
        creative_theme: r.creative_theme, status: r.status, start_date: r.start_date,
        days_running: Number(r.days_running) || 0, spend: Number(r.spend) || 0,
        product: r.product, landing_page: r.landing_page,
      }));

      let added = 0, updated = 0;
      for (const ad of ads) {
        const r = await fetch("/api/custom-ads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ad) });
        const d = await r.json();
        if (d.added) added += d.added;
        if (d.updated) updated += d.updated;
      }

      const msg = [`${added} ads added`, updated ? `${updated} updated` : ""].filter(Boolean).join(", ");
      const errTxt = rowErrors.length ? ` (${rowErrors.length} rows skipped: ${rowErrors.slice(0, 3).join("; ")})` : "";
      setCsvStatus({ ok: true, text: `Import complete — ${msg}.${errTxt}` });
      setCsvFile(null);
    } catch (err) {
      setCsvStatus({ ok: false, text: String(err) });
    } finally {
      setUploading(false);
    }
  }

  // ── Google Sheets sync ────────────────────────────────────────────────────
  async function handleConnect() {
    const r    = await fetch("/api/sheets/connect");
    if (r.redirected) { window.location.href = r.url; return; }
    const data = await r.json();
    if (data.setup) {
      setOauthErr(data.instructions?.join("\n") ?? "Google OAuth not configured.");
      setShowSetup(true);
    }
  }

  async function handleDisconnect() {
    await fetch("/api/sheets/disconnect", { method: "POST" });
    await fetchSheetsStatus();
    setSyncMsg({ ok: true, text: "Google account disconnected." });
  }

  async function handleSync() {
    if (!sheetUrl.trim()) { setSyncMsg({ ok: false, text: "Paste a Google Sheets URL first." }); return; }
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r    = await fetch("/api/sheets/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sheetUrl: sheetUrl.trim() }) });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      const errNote = data.errors?.length ? ` (${data.errors.length} rows skipped)` : "";
      setSyncMsg({ ok: true, text: `Synced ${data.total} rows — ${data.added} added, ${data.updated} updated.${errNote}` });
      await fetchSheetsStatus();
    } catch (err) {
      setSyncMsg({ ok: false, text: String(err) });
    } finally {
      setSyncing(false);
    }
  }

  const f = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between h-16 px-6 bg-surface border-b border-outline-variant/30 shrink-0">
        <div>
          <h2 className="text-base font-extrabold text-on-surface">New Analysis</h2>
          <p className="text-[11px] text-on-surface-variant">Populate campaign metrics via manual entry, CSV upload, or Google Sheets sync.</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-12 gap-5">

            {/* ── Left: Manual Entry ──────────────────────────────────────── */}
            <section className="col-span-12 lg:col-span-8 bg-surface-container rounded-xl border border-outline-variant overflow-hidden">
              <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-high flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">edit_note</span>
                  <h3 className="text-sm font-bold text-on-surface">Manual Data Entry</h3>
                </div>
                <span className="text-[10px] uppercase tracking-widest text-on-surface-variant/60">Required fields marked *</span>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Ad ID *" error={errors.ad_id}>
                    <Input placeholder="e.g. AD-99201" value={form.ad_id} onChange={f("ad_id")} />
                  </Field>
                  <Field label="Platform *">
                    <Select value={form.platform} onChange={f("platform")}>
                      {PLATFORMS.map(p => <option key={p}>{p}</option>)}
                    </Select>
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Brand *" error={errors.brand}>
                    <Input placeholder="e.g. Man Matters" value={form.brand} onChange={f("brand")} />
                  </Field>
                  <Field label="Category *" error={errors.category}>
                    <Input placeholder="e.g. Hair Care" value={form.category} onChange={f("category")} />
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Ad Type *">
                    <Select value={form.ad_type} onChange={f("ad_type")}>
                      {AD_TYPES.map(t => <option key={t}>{t}</option>)}
                    </Select>
                  </Field>
                  <Field label="Creative Theme *" error={errors.creative_theme}>
                    <Input placeholder="e.g. Doctor Trust" value={form.creative_theme} onChange={f("creative_theme")} />
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Target Audience *" error={errors.target_audience}>
                    <Input placeholder="e.g. M 25-34" value={form.target_audience} onChange={f("target_audience")} />
                  </Field>
                  <Field label="Status">
                    <Select value={form.status} onChange={f("status")}>
                      {STATUSES.map(s => <option key={s}>{s}</option>)}
                    </Select>
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Start Date *">
                    <Input type="date" value={form.start_date} onChange={f("start_date")} />
                  </Field>
                  <Field label="Spend (₹) *" error={errors.spend}>
                    <Input type="number" placeholder="0.00" min="0" step="0.01" value={form.spend} onChange={f("spend")} />
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Product Name (Optional)">
                    <Input placeholder="e.g. Hair Growth Kit" value={form.product} onChange={f("product")} />
                  </Field>
                  <Field label="Landing Page URL (Optional)">
                    <Input type="url" placeholder="https://..." value={form.landing_page} onChange={f("landing_page")} />
                  </Field>
                </div>

                {formStatus && (
                  <div className={`flex items-start gap-2 px-4 py-3 rounded-lg border text-sm ${formStatus.ok ? "bg-secondary/10 border-secondary/30 text-secondary" : "bg-error-container/10 border-error-container/30 text-error"}`}>
                    <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0">{formStatus.ok ? "check_circle" : "error"}</span>
                    <span>{formStatus.text}</span>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex items-center gap-2 bg-primary-container text-on-primary-container px-6 py-2.5 rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
                  >
                    {submitting
                      ? <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                      : <span className="material-symbols-outlined text-[18px]">add</span>}
                    {submitting ? "Adding…" : "Add to Dashboard"}
                  </button>
                </div>
              </div>
            </section>

            {/* ── Right column ────────────────────────────────────────────── */}
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-5">

              {/* CSV Bulk Upload */}
              <section className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant bg-surface-container-high flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-[20px]">upload_file</span>
                  <h3 className="text-sm font-bold text-on-surface">Bulk Upload</h3>
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-[13px] text-on-surface-variant leading-relaxed">
                    Upload a <strong>.csv</strong> file in the required format. Other formats will be rejected.
                  </p>

                  {/* Drop zone */}
                  <div
                    onClick={() => fileRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setCsvDrag(true); }}
                    onDragLeave={() => setCsvDrag(false)}
                    onDrop={e => { e.preventDefault(); setCsvDrag(false); handleFileChange(e.dataTransfer.files[0]); }}
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${csvDrag ? "border-secondary bg-secondary/5" : "border-outline-variant hover:border-secondary/50"}`}
                  >
                    <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => handleFileChange(e.target.files?.[0] ?? null)} />
                    <span className="material-symbols-outlined text-[36px] text-on-surface-variant block mb-2">cloud_upload</span>
                    {csvFile
                      ? <p className="text-sm font-semibold text-secondary">{csvFile.name}</p>
                      : <p className="text-sm text-on-surface-variant">Drag & drop or <span className="text-secondary underline">browse</span></p>}
                    <p className="text-[11px] text-on-surface-variant/50 mt-1">CSV format only · max 5MB</p>
                  </div>

                  {csvStatus && (
                    <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border text-[13px] ${csvStatus.ok ? "bg-secondary/10 border-secondary/30 text-secondary" : "bg-error-container/10 border-error-container/30 text-error"}`}>
                      <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0">{csvStatus.ok ? "check_circle" : "error"}</span>
                      <span>{csvStatus.text}</span>
                    </div>
                  )}

                  <button
                    onClick={handleCsvUpload}
                    disabled={!csvFile || uploading}
                    className="w-full flex items-center justify-center gap-2 bg-secondary text-on-secondary py-2.5 rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-40 transition-all"
                  >
                    {uploading
                      ? <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                      : <span className="material-symbols-outlined text-[18px]">upload</span>}
                    {uploading ? "Importing…" : "Import CSV"}
                  </button>

                  <a
                    href="/api/sheets/template"
                    className="flex items-center gap-2 text-[13px] text-on-surface-variant hover:text-secondary transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    Download Sample Template (.csv)
                  </a>
                </div>
              </section>

              {/* Google Sheets */}
              <section className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant bg-surface-container-high flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-tertiary text-[20px]">sync_alt</span>
                    <h3 className="text-sm font-bold text-on-surface">Google Sheets</h3>
                  </div>
                  {sheetStatus?.connected && (
                    <span className="flex items-center gap-1 text-[11px] text-secondary">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary inline-block" />
                      Connected
                    </span>
                  )}
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-[13px] text-on-surface-variant leading-relaxed">
                    Connect your Google Account to sync from any private or public sheet automatically.
                  </p>

                  {/* Sheet URL input */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Google Sheet URL</label>
                    <Input
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      value={sheetUrl}
                      onChange={e => setSheetUrl(e.target.value)}
                    />
                    {sheetStatus?.sheetConfig?.lastSync && (
                      <p className="text-[11px] text-on-surface-variant">
                        Last synced: {new Date(sheetStatus.sheetConfig.lastSync).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>

                  {syncMsg && (
                    <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border text-[13px] ${syncMsg.ok ? "bg-secondary/10 border-secondary/30 text-secondary" : "bg-error-container/10 border-error-container/30 text-error"}`}>
                      <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0">{syncMsg.ok ? "check_circle" : "error"}</span>
                      <span>{syncMsg.text}</span>
                    </div>
                  )}

                  {/* Sync button */}
                  <button
                    onClick={handleSync}
                    disabled={syncing || !sheetUrl.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-tertiary/20 border border-tertiary/40 text-tertiary py-2.5 rounded-lg text-sm font-bold hover:bg-tertiary/30 disabled:opacity-40 transition-all"
                  >
                    {syncing
                      ? <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                      : <span className="material-symbols-outlined text-[18px]">sync</span>}
                    {syncing ? "Syncing…" : "Sync Now"}
                  </button>

                  {/* Connect / Disconnect */}
                  {sheetStatus?.connected ? (
                    <button
                      onClick={handleDisconnect}
                      className="w-full flex items-center justify-center gap-2 border border-outline-variant text-on-surface-variant py-2 rounded-lg text-sm hover:bg-surface-container-high transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">link_off</span>
                      Disconnect Google Account
                    </button>
                  ) : (
                    <button
                      onClick={handleConnect}
                      className="w-full flex items-center justify-center gap-2 border border-tertiary/40 text-tertiary py-2.5 rounded-lg text-sm font-bold hover:bg-tertiary/10 transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>table_chart</span>
                      Connect Google Account
                    </button>
                  )}

                  {/* OAuth setup instructions */}
                  {!sheetStatus?.oauthReady && (
                    <div className="bg-on-primary-container/10 border border-primary-container/25 rounded-lg p-3">
                      <button
                        onClick={() => setShowSetup(s => !s)}
                        className="flex items-center justify-between w-full text-[12px] font-bold text-primary-container"
                      >
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[15px]">settings</span>
                          Google OAuth setup required
                        </span>
                        <span className="material-symbols-outlined text-[16px]">{showSetup ? "expand_less" : "expand_more"}</span>
                      </button>
                      {showSetup && (
                        <ol className="mt-3 space-y-1.5 text-[12px] text-on-surface-variant list-decimal list-inside leading-relaxed">
                          <li>Go to <span className="text-tertiary">console.cloud.google.com</span></li>
                          <li>Create/select a project → Enable <strong>Google Sheets API</strong></li>
                          <li>APIs & Services → Credentials → <strong>Create OAuth 2.0 Client ID</strong></li>
                          <li>Application type: <strong>Web application</strong></li>
                          <li>Add Authorised redirect URI:<br /><code className="text-[11px] bg-surface-container-highest px-1 py-0.5 rounded text-primary">{typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/sheets/callback</code></li>
                          <li>Add to <code className="text-primary">.env.local</code>:<br /><code className="text-[11px] text-secondary">GOOGLE_CLIENT_ID=…<br />GOOGLE_CLIENT_SECRET=…<br />NEXT_PUBLIC_APP_URL={typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}</code></li>
                          <li>Restart the dev server</li>
                        </ol>
                      )}
                    </div>
                  )}

                  {oauthErr && showSetup && (
                    <pre className="text-[11px] text-on-surface-variant/70 bg-surface-container-highest rounded p-3 overflow-x-auto whitespace-pre-wrap">{oauthErr}</pre>
                  )}

                  <div className="pt-1 border-t border-outline-variant/50">
                    <p className="text-[11px] text-on-surface-variant/60 leading-relaxed">
                      <strong>Format requirement:</strong> Sheet must match the template columns exactly.
                      Public sheets sync without login via CSV export.
                      Private sheets require Google Account connection.
                    </p>
                  </div>
                </div>
              </section>

              {/* Guidelines */}
              <section className="bg-surface-container rounded-xl border border-outline-variant p-5 space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">Entry Guidelines</p>
                <ul className="space-y-2">
                  {[
                    "Spend values must be in ₹ (INR).",
                    "Ad IDs must be unique — duplicates overwrite existing records.",
                    `Required columns: ${REQUIRED_COLS.join(", ")}.`,
                    "Performance metrics (ROAS, CTR, etc.) default to 0 and will be classified as TESTING until updated.",
                    "Ads appear in the Analytics dashboard after import.",
                  ].map(tip => (
                    <li key={tip} className="flex gap-2 text-[13px] text-on-surface">
                      <span className="material-symbols-outlined text-secondary text-[16px] mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
