"use client";

import { useState, useEffect, useRef } from "react";
import { useSettings } from "@/contexts/SettingsProvider";
import {
  ALL_COLUMNS, RULE_COLUMNS, NUMERIC_RULE_KEYS, DEFAULT_CRITERIA,
  Rule, Operator, Logic, CriteriaMap, EmailSettings,
  classifyWithCriteria,
} from "@/lib/settings";
import { Ad } from "@/lib/types";

type CritTab = "kill" | "scale" | "monitor" | "testing";
const CRIT_TABS: { id: CritTab; label: string }[] = [
  { id: "kill",    label: "Kill List" },
  { id: "scale",   label: "Scale"     },
  { id: "monitor", label: "Monitor"   },
  { id: "testing", label: "Testing"   },
];

const OPERATORS: Operator[] = ["<", ">", "=", ">=", "<="];

function uid() { return Math.random().toString(36).slice(2); }

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-[22px]">{icon}</span>
        <h3 className="text-lg font-semibold text-on-surface">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const { settings, savedSettings, update, save, discard, dirty } = useSettings();

  // ── Local draft state ──────────────────────────────────────────────────────
  const [visibleCols, setVisibleCols] = useState<string[]>(settings.visibleColumns);
  const [criteria,    setCriteria]    = useState<CriteriaMap>(
    JSON.parse(JSON.stringify(settings.criteria))
  );
  const [email, setEmail]   = useState<EmailSettings>({ ...settings.email });
  const [critTab, setCritTab] = useState<CritTab>("kill");
  const [newEmail,  setNewEmail]  = useState("");
  const [saved,     setSaved]     = useState(false);
  const [sending,   setSending]   = useState(false);
  const [sendMsg,   setSendMsg]   = useState<{ ok: boolean; text: string } | null>(null);
  const isMount = useRef(true);

  // Live preview: push criteria + visible columns to context on every change
  // so the Analytics dashboard updates in real-time without needing to save first.
  useEffect(() => {
    if (isMount.current) { isMount.current = false; return; }
    update({ criteria, visibleColumns: visibleCols });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria, visibleCols]);

  function toggleCol(key: string) {
    const col = ALL_COLUMNS.find(c => c.key === key);
    if (col?.always) return;
    setVisibleCols(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }

  // ── Rule builder helpers ───────────────────────────────────────────────────
  function updateRule(tab: CritTab, idx: number, patch: Partial<Rule>) {
    setCriteria(prev => {
      const rules = [...prev[tab]];
      const updated = { ...rules[idx], ...patch };
      // When column changes, reset operator and value to sensible defaults
      if (patch.column && patch.column !== rules[idx].column) {
        if (NUMERIC_RULE_KEYS.has(patch.column)) {
          updated.operator = "<";
          updated.value    = 0;
        } else {
          updated.operator = "=";
          updated.value    = "";
        }
      }
      rules[idx] = updated;
      return { ...prev, [tab]: rules };
    });
  }

  function addRule(tab: CritTab) {
    setCriteria(prev => ({
      ...prev,
      [tab]: [...prev[tab], { id: uid(), column: "roas", operator: "<" as Operator, value: 0, logic: "AND" as Logic }],
    }));
  }

  function removeRule(tab: CritTab, idx: number) {
    setCriteria(prev => ({
      ...prev,
      [tab]: prev[tab].filter((_, i) => i !== idx),
    }));
  }

  function resetCriteria() {
    setCriteria(JSON.parse(JSON.stringify(DEFAULT_CRITERIA)));
  }

  // ── Email helpers ──────────────────────────────────────────────────────────
  function addRecipient() {
    const e = newEmail.trim().toLowerCase();
    if (!e || !e.includes("@")) return;
    if (email.recipients.includes(e)) return;
    setEmail(prev => ({ ...prev, recipients: [...prev.recipients, e] }));
    setNewEmail("");
  }

  function removeRecipient(e: string) {
    setEmail(prev => ({ ...prev, recipients: prev.recipients.filter(r => r !== e) }));
  }

  function toggleEmailCategory(cat: string) {
    setEmail(prev => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter(c => c !== cat)
        : [...prev.categories, cat],
    }));
  }

  // ── Email send ────────────────────────────────────────────────────────────
  async function sendReport() {
    if (!email.recipients.length) {
      setSendMsg({ ok: false, text: "Add at least one recipient first." });
      return;
    }
    if (!email.categories.length) {
      setSendMsg({ ok: false, text: "Select at least one category to include." });
      return;
    }
    setSending(true);
    setSendMsg(null);
    try {
      // Fetch + classify once, then send one email per selected category
      const res        = await fetch("/api/ads");
      const json       = await res.json() as { ads: Ad[] };
      const classified = json.ads.map(ad => ({
        ...ad,
        _class: classifyWithCriteria(ad, criteria),
      })) as Ad[];

      const results: string[] = [];
      for (const category of email.categories) {
        const filtered = classified.filter(ad =>
          ad._class.toLowerCase() === category
        );
        const catKey = category as keyof typeof criteria;
        const rules  = criteria[catKey] ?? [];
        const resp   = await fetch("/api/send-report", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ category, recipients: email.recipients, ads: filtered, rules }),
        });
        const data = await resp.json();
        if (data.error) throw new Error(typeof data.error === "object" ? data.error.message ?? JSON.stringify(data.error) : data.error);
        results.push(`${category} (${filtered.length} ads)`);
      }
      setSendMsg({ ok: true, text: `Sent ${results.join(", ")} → ${email.recipients.join(", ")}` });
    } catch (err) {
      setSendMsg({ ok: false, text: String(err) });
    } finally {
      setSending(false);
    }
  }

  // ── Save / Discard ─────────────────────────────────────────────────────────
  function handleSave() {
    update({ visibleColumns: visibleCols, criteria, email });
    save();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleDiscard() {
    setVisibleCols(savedSettings.visibleColumns);
    setCriteria(JSON.parse(JSON.stringify(savedSettings.criteria)));
    setEmail({ ...savedSettings.email });
    discard();
  }

  const rules = criteria[critTab];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between h-16 px-6 bg-surface border-b border-outline-variant/30 shrink-0">
        <div>
          <h2 className="text-base font-extrabold text-on-surface">Dashboard Settings</h2>
          <p className="text-[11px] text-on-surface-variant">Configure columns, classification rules, and email reports.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDiscard}
            className="px-5 py-1.5 border border-outline text-on-surface text-sm rounded-lg hover:bg-surface-variant transition-colors"
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            className={`px-6 py-1.5 text-sm font-bold rounded-lg transition-all ${
              saved
                ? "bg-secondary/30 text-secondary"
                : "bg-secondary text-on-secondary hover:opacity-90"
            }`}
          >
            {saved ? "✓ Saved" : "Save Changes"}
          </button>
        </div>
      </header>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        <div className="max-w-5xl mx-auto space-y-12">

          {/* ── Section 1: Dashboard Columns ── */}
          <Section icon="view_column" title="Dashboard Columns">
            <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-6">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-4">
                Visible Columns — {visibleCols.length} Selected
              </p>
              <div className="flex flex-wrap gap-2">
                {ALL_COLUMNS.map(col => {
                  const on = visibleCols.includes(col.key);
                  return (
                    <button
                      key={col.key}
                      onClick={() => toggleCol(col.key)}
                      disabled={!!col.always}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
                        on
                          ? "bg-secondary/10 border-secondary text-secondary"
                          : "bg-surface-container-high border-outline-variant text-on-surface-variant hover:border-primary/50"
                      } ${col.always ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <span className="material-symbols-outlined text-[13px]">{on ? "check" : "add"}</span>
                      {col.label.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>

          {/* ── Section 2: Category Criteria ── */}
          <Section icon="rule" title="Category Criteria">
            <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl overflow-hidden">
              {/* Tab bar */}
              <div className="flex border-b border-surface-variant bg-surface-container-low">
                {CRIT_TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setCritTab(t.id)}
                    className={`px-7 py-3.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                      critTab === t.id
                        ? "border-b-2 border-primary text-primary"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
                <button
                  onClick={resetCriteria}
                  className="ml-auto mr-4 self-center text-[11px] text-on-surface-variant hover:text-primary transition-colors"
                >
                  Reset to defaults
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                    Rules for {critTab.charAt(0).toUpperCase() + critTab.slice(1)}
                  </p>
                  <span className="px-2 py-0.5 bg-primary-container/20 text-primary-container text-[10px] font-bold rounded">
                    {rules.length} RULE{rules.length !== 1 ? "S" : ""} ACTIVE
                  </span>
                </div>

                <div className="space-y-3">
                  {rules.map((rule, idx) => (
                    <div
                      key={rule.id}
                      className="grid grid-cols-12 gap-3 items-end bg-surface-container p-4 rounded-lg border border-surface-variant"
                    >
                      {/* AND/OR or rule number */}
                      <div className="col-span-1 flex justify-center">
                        {idx === 0 ? (
                          <span className="text-on-surface-variant text-xs font-mono pt-5">IF</span>
                        ) : (
                          <div className="pt-5">
                            <select
                              value={rule.logic}
                              onChange={e => updateRule(critTab, idx, { logic: e.target.value as Logic })}
                              className="bg-transparent border-none text-[11px] font-bold text-primary focus:ring-0 cursor-pointer uppercase appearance-none text-center"
                            >
                              <option value="AND">AND</option>
                              <option value="OR">OR</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Column */}
                      <div className="col-span-4">
                        <label className="block text-[10px] text-on-surface-variant uppercase mb-1">Column</label>
                        <select
                          value={rule.column}
                          onChange={e => updateRule(critTab, idx, { column: e.target.value })}
                          className="w-full bg-background border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none"
                        >
                          {RULE_COLUMNS.map(c => (
                            <option key={c.key} value={c.key}>{c.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Operator */}
                      <div className="col-span-2">
                        <label className="block text-[10px] text-on-surface-variant uppercase mb-1">Operator</label>
                        <select
                          value={rule.operator}
                          onChange={e => updateRule(critTab, idx, { operator: e.target.value as Operator })}
                          disabled={!NUMERIC_RULE_KEYS.has(rule.column)}
                          className="w-full bg-background border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none font-mono disabled:opacity-50"
                        >
                          {(NUMERIC_RULE_KEYS.has(rule.column) ? OPERATORS : ["="]).map(op => (
                            <option key={op} value={op}>{op}</option>
                          ))}
                        </select>
                      </div>

                      {/* Value */}
                      <div className="col-span-4">
                        <label className="block text-[10px] text-on-surface-variant uppercase mb-1">Value</label>
                        {NUMERIC_RULE_KEYS.has(rule.column) ? (
                          <input
                            type="number"
                            value={rule.value as number}
                            onChange={e => updateRule(critTab, idx, { value: Number(e.target.value) })}
                            className="w-full bg-background border border-outline-variant rounded px-3 py-2 text-sm text-on-surface font-mono focus:ring-1 focus:ring-primary outline-none"
                          />
                        ) : (
                          <input
                            type="text"
                            value={rule.value as string}
                            onChange={e => updateRule(critTab, idx, { value: e.target.value })}
                            placeholder="e.g. YouTube"
                            className="w-full bg-background border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none"
                          />
                        )}
                      </div>

                      {/* Delete */}
                      <div className="col-span-1 flex justify-center pb-0.5">
                        <button
                          onClick={() => removeRule(critTab, idx)}
                          disabled={rules.length <= 1}
                          className="p-1.5 text-error hover:bg-error/10 rounded-full transition-colors disabled:opacity-30"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add rule */}
                  <button
                    onClick={() => addRule(critTab)}
                    className="w-full py-4 border-2 border-dashed border-surface-variant rounded-lg flex items-center justify-center gap-2 text-on-surface-variant hover:border-primary/40 hover:text-primary transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    <span className="text-xs font-bold uppercase">Add New Rule</span>
                  </button>
                </div>

                {/* Logic warning */}
                <div className="bg-error-container/10 border border-error-container/40 p-4 rounded-lg flex gap-3">
                  <span className="material-symbols-outlined text-error text-[20px] shrink-0 mt-0.5">report</span>
                  <div>
                    <p className="text-sm font-bold text-error mb-0.5">Rules are evaluated left-to-right</p>
                    <p className="text-xs text-on-surface-variant">
                      AND/OR has no precedence — conditions combine in order. Test your criteria before saving to production.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* ── Section 3: Email Reporting ── */}
          <Section icon="mail" title="Email Reporting">
            <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-6 space-y-6">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                Automated performance reports sent to recipients
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Schedule */}
                <div>
                  <label className="block text-[10px] text-on-surface-variant uppercase mb-2">Report Schedule</label>
                  <select
                    value={email.schedule}
                    onChange={e => setEmail(prev => ({ ...prev, schedule: e.target.value as EmailSettings["schedule"] }))}
                    className="w-full bg-background border border-outline-variant rounded px-3 py-2.5 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                {/* Included categories */}
                <div>
                  <p className="text-[10px] text-on-surface-variant uppercase mb-2">Included Categories</p>
                  <div className="flex flex-wrap gap-2">
                    {["kill", "scale", "monitor", "testing"].map(cat => {
                      const on = email.categories.includes(cat);
                      return (
                        <button
                          key={cat}
                          onClick={() => toggleEmailCategory(cat)}
                          className={`flex items-center gap-1 px-3 py-1 rounded-full text-[11px] border transition-colors ${
                            on
                              ? "bg-secondary/10 border-secondary text-secondary"
                              : "bg-surface-container-high border-outline-variant text-on-surface-variant hover:border-primary/50"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[13px]">{on ? "check" : "add"}</span>
                          {cat.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Add recipient */}
              <div className="border-t border-outline-variant pt-5 space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Recipients</p>
                <div className="flex gap-3">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addRecipient()}
                    placeholder="name@example.com"
                    className="flex-1 bg-background border border-outline-variant rounded px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:ring-1 focus:ring-primary outline-none"
                  />
                  <button
                    onClick={addRecipient}
                    className="px-5 py-2 bg-primary text-on-primary text-sm font-bold rounded-lg hover:opacity-90 transition-all"
                  >
                    Add
                  </button>
                </div>

                {/* Recipient list */}
                {email.recipients.length > 0 ? (
                  <div className="space-y-2">
                    {email.recipients.map(r => (
                      <div key={r} className="flex items-center justify-between bg-surface-container px-4 py-2.5 rounded-lg border border-surface-variant">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-on-surface-variant text-[16px]">mail</span>
                          <span className="text-sm text-on-surface">{r}</span>
                        </div>
                        <button onClick={() => removeRecipient(r)} className="text-error hover:bg-error/10 p-1 rounded-full transition-colors">
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant py-2">No recipients added yet.</p>
                )}

                {/* Send Report */}
                <div className="border-t border-outline-variant pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Send Report Now</p>
                    {email.categories.length > 0 && (
                      <p className="text-[11px] text-on-surface-variant">
                        Will send: {email.categories.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(", ")}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={sendReport}
                    disabled={sending || !email.recipients.length || !email.categories.length}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary text-sm font-bold rounded-lg hover:opacity-90 disabled:opacity-40 transition-all"
                  >
                    {sending ? (
                      <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[18px]">send</span>
                    )}
                    {sending ? "Sending…" : "Send Report"}
                  </button>
                  {sendMsg && (
                    <div className={`flex items-start gap-2 px-4 py-3 rounded-lg border text-sm ${
                      sendMsg.ok
                        ? "bg-secondary/10 border-secondary/30 text-secondary"
                        : "bg-error-container/10 border-error-container/30 text-error"
                    }`}>
                      <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0">{sendMsg.ok ? "check_circle" : "error"}</span>
                      <span>{sendMsg.text}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Section>

          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}
