"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

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

// Static fallbacks used before /api/ads/meta loads
const FALLBACK_PLATFORMS = ["YouTube", "Meta", "Google", "Instagram", "TikTok", "X (Twitter)"];
const FALLBACK_AD_TYPES  = ["Video Reel", "Static Carousel", "Image Post", "Story", "Search Ad", "Display Ad"];
const STATUSES           = ["Active", "Paused", "Completed"];

// Columns that map to DB fields (recommendation is computed — excluded)
const DB_COLUMNS = new Set([
  "ad_id","platform","brand","category","ad_type","target_audience","creative_theme",
  "status","start_date","days_running","spend","revenue","roas","impressions","clicks",
  "ctr","conversions","cpc","cpa","creative_score","landing_page_score","frequency",
  "video_completion_rate","product","landing_page",
]);
const NUMERIC_COLS = new Set([
  "days_running","spend","revenue","roas","impressions","clicks","ctr","conversions",
  "cpc","cpa","creative_score","landing_page_score","frequency","video_completion_rate",
]);
// These can be null when empty; all other numerics default to 0
const NULLABLE_COLS = new Set(["video_completion_rate"]);

const BLANK: FormData = {
  ad_id: "", platform: "", brand: "", category: "", ad_type: "",
  target_audience: "", creative_theme: "", status: "Active",
  start_date: new Date().toISOString().split("T")[0], spend: "",
  product: "", landing_page: "",
};

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
  const router = useRouter();

  // Dynamic meta from DB
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
    }).catch(() => {/* keep fallbacks */});
  }, []);

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
  const [sheetsHowTab, setSheetsHowTab] = useState<"public" | "private">("public");

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
      const r    = await fetch("/api/ads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, spend: Number(form.spend) }) });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setFormStatus({ ok: true, text: `Ad ${form.ad_id} added! Redirecting to dashboard…` });
      setForm(prev => ({ ...BLANK, platform: prev.platform, ad_type: prev.ad_type }));
      setErrors({});
      setTimeout(() => { router.refresh(); router.push("/"); }, 1200);
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
      const text  = await csvFile.text();
      // Handle both \r\n (Windows) and \n (Unix) line endings
      const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
      if (lines.length < 2) throw new Error("File has no data rows.");

      // Normalise headers: lowercase + underscores
      const rawHeaders = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));

      // Mandatory columns check
      if (!rawHeaders.includes("ad_id")) throw new Error("Column 'ad_id' is required but missing from your CSV.");
      if (!rawHeaders.includes("brand")) throw new Error("Column 'brand' is required but missing from your CSV.");

      // Only keep headers that map to DB columns (skip 'recommendation' and unknowns)
      const dbHeaders = rawHeaders.map(h => DB_COLUMNS.has(h) ? h : null);

      const ads: Record<string, unknown>[] = [];
      const rowErrors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols   = lines[i].split(",").map(c => c.trim());
        const record: Record<string, unknown> = {};

        dbHeaders.forEach((col, idx) => {
          if (!col) return; // skip non-DB columns (recommendation etc.)
          const raw = (cols[idx] ?? "").trim();
          if (raw === "") return; // skip empty cells — don't overwrite existing DB values
          record[col] = NUMERIC_COLS.has(col) ? Number(raw) : raw;
        });

        const adId  = String(record.ad_id  ?? "").trim();
        const brand = String(record.brand  ?? "").trim();

        if (!adId)  { rowErrors.push(`Row ${i + 1}: missing ad_id — skipped`);  continue; }
        if (!brand) { rowErrors.push(`Row ${i + 1}: missing brand — skipped`);   continue; }

        record.ad_id = adId;
        record.brand = brand;
        ads.push(record);
      }

      if (ads.length === 0) {
        throw new Error(`No valid rows found.${rowErrors.length ? " Errors: " + rowErrors.slice(0, 3).join("; ") : ""}`);
      }

      // Upsert all valid rows via /api/ads
      let added = 0, updated = 0;
      for (const ad of ads) {
        const r = await fetch("/api/ads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ad),
        });
        const d = await r.json();
        if (!r.ok) { rowErrors.push(`${ad.ad_id}: ${d.error ?? "server error"}`); continue; }
        added   += d.added   ?? 0;
        updated += d.updated ?? 0;
      }

      const msg    = [added ? `${added} added` : "", updated ? `${updated} updated` : ""].filter(Boolean).join(", ") || "0 changes";
      const errTxt = rowErrors.length ? ` · ${rowErrors.length} row(s) skipped` : "";
      setCsvStatus({ ok: true, text: `Import complete — ${msg}.${errTxt} Redirecting to dashboard…` });
      setCsvFile(null);
      if (rowErrors.length) console.warn("CSV row errors:", rowErrors);
      // refresh() clears Next.js router cache; push navigates after cache is cleared
      router.refresh();
      setTimeout(() => router.push("/"), 800);
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
                      {meta.platforms.map(p => <option key={p}>{p}</option>)}
                    </Select>
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Ad Type *">
                    <Select value={form.ad_type} onChange={f("ad_type")}>
                      {meta.adTypes.map(t => <option key={t}>{t}</option>)}
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
                    <h3 className="text-sm font-bold text-on-surface">Google Sheets Sync</h3>
                  </div>
                  {sheetStatus?.connected && (
                    <span className="flex items-center gap-1 text-[11px] text-secondary">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary inline-block" />
                      Google Connected
                    </span>
                  )}
                </div>
                <div className="p-5 space-y-4">

                  {/* How-to tabs: Public / Private */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant mb-2">How to sync</p>
                    <div className="flex rounded-lg overflow-hidden border border-outline-variant text-[12px] font-semibold">
                      <button
                        onClick={() => setSheetsHowTab("public")}
                        className={`flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors ${sheetsHowTab === "public" ? "bg-tertiary/20 text-tertiary" : "text-on-surface-variant hover:bg-surface-container-high"}`}
                      >
                        <span className="material-symbols-outlined text-[15px]">public</span>
                        Public Sheet
                      </button>
                      <button
                        onClick={() => setSheetsHowTab("private")}
                        className={`flex-1 py-2 flex items-center justify-center gap-1.5 border-l border-outline-variant transition-colors ${sheetsHowTab === "private" ? "bg-tertiary/20 text-tertiary" : "text-on-surface-variant hover:bg-surface-container-high"}`}
                      >
                        <span className="material-symbols-outlined text-[15px]">lock</span>
                        Private Sheet
                      </button>
                    </div>

                    {/* Public steps */}
                    {sheetsHowTab === "public" && (
                      <div className="mt-3 bg-surface-container-highest rounded-lg p-3 space-y-2">
                        <p className="text-[11px] text-tertiary font-bold uppercase tracking-wider">No login required</p>
                        <ol className="space-y-2 text-[12px] text-on-surface-variant list-none">
                          {[
                            { n: "1", icon: "share", text: <>Open your Google Sheet → click <strong>Share</strong> (top-right)</> },
                            { n: "2", icon: "lock_open", text: <>Change access to <strong>Anyone with the link → Viewer</strong> → click Done</> },
                            { n: "3", icon: "content_copy", text: <>Copy the sheet URL from your browser address bar</> },
                            { n: "4", icon: "link", text: <>Paste it in the <strong>Sheet URL</strong> field below</> },
                            { n: "5", icon: "sync", text: <>Click <strong>Sync Now</strong> — data imports instantly</> },
                          ].map(s => (
                            <li key={s.n} className="flex items-start gap-2.5">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-tertiary/20 text-tertiary text-[10px] font-bold flex items-center justify-center mt-0.5">{s.n}</span>
                              <span className="leading-relaxed">{s.text}</span>
                            </li>
                          ))}
                        </ol>
                        <div className="pt-2 border-t border-outline-variant/40 flex items-start gap-1.5">
                          <span className="material-symbols-outlined text-[13px] text-on-surface-variant/60 mt-0.5">info</span>
                          <p className="text-[11px] text-on-surface-variant/60 leading-relaxed">
                            Sheet must use the required column format.{" "}
                            <a href="/api/sheets/template" className="text-tertiary underline">Download template</a> to see exact headers.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Private steps */}
                    {sheetsHowTab === "private" && (
                      <div className="mt-3 bg-surface-container-highest rounded-lg p-3 space-y-2">
                        <p className="text-[11px] text-tertiary font-bold uppercase tracking-wider">One-time OAuth setup + connect</p>

                        {/* Phase A: Admin setup (only if OAuth not ready) */}
                        {!sheetStatus?.oauthReady && (
                          <>
                            <p className="text-[11px] font-semibold text-on-surface mt-1">Part A — Admin: Configure Google OAuth</p>
                            <ol className="space-y-2 text-[12px] text-on-surface-variant list-none">
                              {[
                                { n: "1", text: <>Go to <strong>console.cloud.google.com</strong> → create or select a project</> },
                                { n: "2", text: <><strong>APIs & Services → Library</strong> → search <strong>Google Sheets API</strong> → Enable</> },
                                { n: "3", text: <><strong>APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID</strong></> },
                                { n: "4", text: <>Application type: <strong>Web application</strong> → add Authorised redirect URI:<br />
                                  <code className="text-[10px] bg-surface-container px-1.5 py-0.5 rounded text-primary break-all">
                                    {typeof window !== "undefined" ? window.location.origin : "https://your-app.com"}/api/sheets/callback
                                  </code>
                                </> },
                                { n: "5", text: <>Copy <strong>Client ID</strong> and <strong>Client Secret</strong> from the credentials page</> },
                                { n: "6", text: <>Add to your <code className="text-primary">.env.local</code> (and Render env vars):<br />
                                  <code className="text-[10px] text-secondary leading-loose">
                                    GOOGLE_CLIENT_ID=your-client-id<br />
                                    GOOGLE_CLIENT_SECRET=your-client-secret<br />
                                    NEXT_PUBLIC_APP_URL={typeof window !== "undefined" ? window.location.origin : "https://your-app.com"}
                                  </code>
                                </> },
                                { n: "7", text: <>Restart the dev server (or redeploy on Render)</> },
                              ].map(s => (
                                <li key={s.n} className="flex items-start gap-2.5">
                                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-container/30 text-primary-container text-[10px] font-bold flex items-center justify-center mt-0.5">{s.n}</span>
                                  <span className="leading-relaxed">{s.text}</span>
                                </li>
                              ))}
                            </ol>
                            <div className="mt-2 py-2 px-3 bg-primary-container/10 border border-primary-container/20 rounded text-[11px] text-primary-container flex items-start gap-1.5">
                              <span className="material-symbols-outlined text-[13px] mt-0.5 shrink-0">warning</span>
                              Admin setup not complete — env vars missing. Complete steps above, then come back.
                            </div>
                          </>
                        )}

                        {/* Phase B: User connect (always shown for private tab) */}
                        <p className={`text-[11px] font-semibold text-on-surface ${!sheetStatus?.oauthReady ? "mt-3 pt-3 border-t border-outline-variant/40" : "mt-1"}`}>
                          {!sheetStatus?.oauthReady ? "Part B — " : ""}Connect &amp; Sync
                        </p>
                        <ol className="space-y-2 text-[12px] text-on-surface-variant list-none">
                          {[
                            { n: "1", text: <>Click <strong>Connect Google Account</strong> below → sign in &amp; grant Sheets read access</> },
                            { n: "2", text: <>You&apos;ll be redirected back here automatically once connected</> },
                            { n: "3", text: <>Paste your private Google Sheet URL in the field below</> },
                            { n: "4", text: <>Click <strong>Sync Now</strong> — works with any sheet your Google account can view</> },
                          ].map(s => (
                            <li key={s.n} className="flex items-start gap-2.5">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-tertiary/20 text-tertiary text-[10px] font-bold flex items-center justify-center mt-0.5">{s.n}</span>
                              <span className="leading-relaxed">{s.text}</span>
                            </li>
                          ))}
                        </ol>
                        {sheetStatus?.oauthReady && (
                          <div className="pt-2 border-t border-outline-variant/40 flex items-start gap-1.5">
                            <span className="material-symbols-outlined text-[13px] text-secondary mt-0.5">check_circle</span>
                            <p className="text-[11px] text-secondary">OAuth is configured. Use the button below to connect your account.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Sheet URL input */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Google Sheet URL</label>
                    <Input
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      value={sheetUrl}
                      onChange={e => setSheetUrl(e.target.value)}
                    />
                    {sheetStatus?.sheetConfig?.lastSync && (
                      <p className="text-[11px] text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">schedule</span>
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
                      disabled={sheetsHowTab === "private" && !sheetStatus?.oauthReady}
                      className="w-full flex items-center justify-center gap-2 border border-tertiary/40 text-tertiary py-2.5 rounded-lg text-sm font-bold hover:bg-tertiary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>table_chart</span>
                      Connect Google Account
                    </button>
                  )}

                  {oauthErr && showSetup && (
                    <pre className="text-[11px] text-on-surface-variant/70 bg-surface-container-highest rounded p-3 overflow-x-auto whitespace-pre-wrap">{oauthErr}</pre>
                  )}
                </div>
              </section>

              {/* Guidelines */}
              <section className="bg-surface-container rounded-xl border border-outline-variant p-5 space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">Entry Guidelines</p>
                <ul className="space-y-2">
                  {[
                    "Spend values must be in ₹ (INR).",
                    "Ad IDs must be unique — duplicates overwrite existing records.",
                    "Only ad_id and brand are mandatory. All other matching columns are imported automatically.",
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
