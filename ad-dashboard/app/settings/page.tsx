"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSettings } from "@/contexts/SettingsProvider";
import {
  ALL_COLUMNS, RULE_COLUMNS, NUMERIC_RULE_KEYS, DEFAULT_CRITERIA,
  Rule, Operator, Logic, CriteriaMap, EmailSettings,
  classifyWithCriteria,
} from "@/lib/settings";
import { Ad } from "@/lib/types";
import {
  Columns, SlidersHorizontal, Mail, BellRing,
  AlertTriangle, Check, Plus, Trash2, PlusCircle,
  AlertCircle, UserPlus, CheckCircle2, XCircle,
  UserMinus, Loader2, Send,
  Info, BellPlus, BellRing as BellActive, BellOff,
  Pencil,
  type LucideIcon,
} from "lucide-react";

type CritTab = "kill" | "scale" | "monitor" | "testing";
const CRIT_TABS: { id: CritTab; label: string }[] = [
  { id: "kill",    label: "Kill List" },
  { id: "scale",   label: "Scale"     },
  { id: "monitor", label: "Monitor"   },
  { id: "testing", label: "Testing"   },
];

const OPERATORS: Operator[] = ["<", ">", "=", ">=", "<="];
const SCHEDULE_LABELS: Record<string, string> = {
  daily: "Daily", weekly: "Weekly", monthly: "Monthly",
  instant: "Instant (within 2 min)",
};
const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function uid() { return Math.random().toString(36).slice(2); }

function Section({ Icon, title, subtitle, children }: { Icon: LucideIcon; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon size={14} strokeWidth={1.75} className="text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-on-surface tracking-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-on-surface-variant">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

interface ReportUser {
  id: number; email: string; is_active: boolean;
  schedule: string; send_hour: number; send_day_of_week: number;
  send_day_of_month: number; categories: string[]; last_sent_at: string | null;
}
interface AlertRecipient {
  id: number; email: string; is_active: boolean;
  schedule: string; send_hour: number; send_day_of_week: number;
  send_day_of_month: number; last_sent_at: string | null;
}

function ScheduleFields({
  schedule, hour, dow, dom, includeInstant,
  onSchedule, onHour, onDow, onDom,
}: {
  schedule: string; hour: number; dow: number; dom: number; includeInstant: boolean;
  onSchedule: (v: string) => void; onHour: (v: number) => void;
  onDow: (v: number) => void; onDom: (v: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div>
        <label className="block text-[10px] text-on-surface-variant uppercase mb-1">Schedule</label>
        <select value={schedule} onChange={e => onSchedule(e.target.value)}
          className="bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary">
          {includeInstant && <option value="instant">Instant (within 2 min)</option>}
          <option value="daily">Every Day</option>
          <option value="weekly">Every Week</option>
          <option value="monthly">Every Month</option>
        </select>
      </div>
      {schedule !== "instant" && (
        <div>
          <label className="block text-[10px] text-on-surface-variant uppercase mb-1">Send at (IST)</label>
          <select value={hour} onChange={e => onHour(Number(e.target.value))}
            className="bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary">
            {Array.from({length: 24}, (_, i) => (
              <option key={i} value={i}>{String(i).padStart(2,"0")}:00</option>
            ))}
          </select>
        </div>
      )}
      {schedule === "weekly" && (
        <div>
          <label className="block text-[10px] text-on-surface-variant uppercase mb-1">Day of week</label>
          <select value={dow} onChange={e => onDow(Number(e.target.value))}
            className="bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary">
            {DOW_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </div>
      )}
      {schedule === "monthly" && (
        <div>
          <label className="block text-[10px] text-on-surface-variant uppercase mb-1">Day of month</label>
          <select value={dom} onChange={e => onDom(Number(e.target.value))}
            className="bg-surface-container-low border border-outline-variant rounded px-3 py-1.5 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary">
            {Array.from({length: 28}, (_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { settings, savedSettings, update, save, discard } = useSettings();

  // ── Local draft state ──────────────────────────────────────────────────────
  const [visibleCols, setVisibleCols] = useState<string[]>(settings.visibleColumns);
  const [criteria,    setCriteria]    = useState<CriteriaMap>(JSON.parse(JSON.stringify(settings.criteria)));
  const [email,       setEmail]       = useState<EmailSettings>({ ...settings.email });
  const [critTab,     setCritTab]     = useState<CritTab>("kill");
  const [saved,       setSaved]       = useState(false);
  const [sending,     setSending]     = useState(false);
  const [sendMsg,     setSendMsg]     = useState<{ ok: boolean; text: string } | null>(null);
  const isMount = useRef(true);

  // ── Criteria changed warning ───────────────────────────────────────────────
  const [criteriaChangedSinceLastSave, setCriteriaChangedSinceLastSave] = useState(false);
  const prevCriteria = useRef(JSON.stringify(settings.criteria));

  // ── DB users state ─────────────────────────────────────────────────────────
  const [users,       setUsers]       = useState<ReportUser[]>([]);
  const [alerts,      setAlerts]      = useState<AlertRecipient[]>([]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserSched, setNewUserSched] = useState("daily");
  const [newUserHour,  setNewUserHour]  = useState(9);
  const [newUserDow,   setNewUserDow]   = useState(1);
  const [newUserDom,   setNewUserDom]   = useState(1);
  const [newUserCats,  setNewUserCats]  = useState(["kill","scale","monitor","testing"]);
  const [userMsg,      setUserMsg]      = useState<{ ok: boolean; text: string } | null>(null);
  const [newAlertEmail, setNewAlertEmail] = useState("");
  const [newAlertSched, setNewAlertSched] = useState("instant");
  const [newAlertHour,  setNewAlertHour]  = useState(9);
  const [newAlertDow,   setNewAlertDow]   = useState(1);
  const [newAlertDom,   setNewAlertDom]   = useState(1);
  const [alertMsg,      setAlertMsg]      = useState<{ ok: boolean; text: string } | null>(null);
  const [showAddAlert,  setShowAddAlert]  = useState(false);
  const [showAddUser,   setShowAddUser]   = useState(false);

  // ── Inline edit state ─────────────────────────────────────────────────────
  const [editingUserId,   setEditingUserId]   = useState<number | null>(null);
  const [editUserSched,   setEditUserSched]   = useState("daily");
  const [editUserHour,    setEditUserHour]    = useState(9);
  const [editUserDow,     setEditUserDow]     = useState(1);
  const [editUserDom,     setEditUserDom]     = useState(1);
  const [editUserCats,    setEditUserCats]    = useState<string[]>([]);
  const [editingAlertId,  setEditingAlertId]  = useState<number | null>(null);
  const [editAlertSched,  setEditAlertSched]  = useState("instant");
  const [editAlertHour,   setEditAlertHour]   = useState(9);
  const [editAlertDow,    setEditAlertDow]    = useState(1);
  const [editAlertDom,    setEditAlertDom]    = useState(1);

  const fetchUsers = useCallback(async () => {
    const [ur, ar] = await Promise.all([fetch("/api/users"), fetch("/api/alert-recipients")]);
    const ud = await ur.json(); const ad = await ar.json();
    if (ud.users)      setUsers(ud.users);
    if (ad.recipients) setAlerts(ad.recipients);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Live preview
  useEffect(() => {
    if (isMount.current) { isMount.current = false; return; }
    update({ criteria, visibleColumns: visibleCols });
    // Detect criteria change
    if (JSON.stringify(criteria) !== prevCriteria.current) {
      setCriteriaChangedSinceLastSave(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria, visibleCols]);

  function toggleCol(key: string) {
    const col = ALL_COLUMNS.find(c => c.key === key);
    if (col?.always) return;
    setVisibleCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }

  function updateRule(tab: CritTab, idx: number, patch: Partial<Rule>) {
    setCriteria(prev => {
      const rules = [...prev[tab]];
      const updated = { ...rules[idx], ...patch };
      if (patch.column && patch.column !== rules[idx].column) {
        if (NUMERIC_RULE_KEYS.has(patch.column)) { updated.operator = "<"; updated.value = 0; }
        else { updated.operator = "="; updated.value = ""; }
      }
      rules[idx] = updated;
      return { ...prev, [tab]: rules };
    });
  }

  function addRule(tab: CritTab) {
    setCriteria(prev => ({ ...prev, [tab]: [...prev[tab], { id: uid(), column: "roas", operator: "<" as Operator, value: 0, logic: "AND" as Logic }] }));
  }
  function removeRule(tab: CritTab, idx: number) {
    setCriteria(prev => ({ ...prev, [tab]: prev[tab].filter((_, i) => i !== idx) }));
  }
  function resetCriteria() { setCriteria(JSON.parse(JSON.stringify(DEFAULT_CRITERIA))); }

  // ── Report email (existing, from localStorage list) ───────────────────────
  function toggleEmailCategory(cat: string) {
    setEmail(prev => ({
      ...prev,
      categories: prev.categories.includes(cat) ? prev.categories.filter(c => c !== cat) : [...prev.categories, cat],
    }));
  }

  async function sendReport() {
    if (!email.recipients.length && users.filter(u => u.is_active).length === 0) {
      setSendMsg({ ok: false, text: "Add at least one recipient first." }); return;
    }
    if (!email.categories.length) { setSendMsg({ ok: false, text: "Select at least one category to include." }); return; }
    setSending(true); setSendMsg(null);
    try {
      const res        = await fetch("/api/ads");
      const json       = await res.json() as { ads: Ad[] };
      const classified = json.ads.map(ad => ({ ...ad, _class: classifyWithCriteria(ad, criteria) })) as Ad[];
      const dbRecipients = users.filter(u => u.is_active).map(u => u.email);
      const allRecipients = [...new Set([...email.recipients, ...dbRecipients])];
      const results: string[] = [];
      for (const category of email.categories) {
        const filtered = classified.filter(ad => ad._class.toLowerCase() === category);
        const resp = await fetch("/api/send-report", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, recipients: allRecipients, ads: filtered, rules: criteria[category as keyof typeof criteria] ?? [] }),
        });
        const data = await resp.json();
        if (data.error) throw new Error(typeof data.error === "object" ? data.error.message ?? JSON.stringify(data.error) : data.error);
        results.push(`${category} (${filtered.length} ads)`);
      }
      setSendMsg({ ok: true, text: `Sent ${results.join(", ")} → ${allRecipients.join(", ")}` });
    } catch (err) { setSendMsg({ ok: false, text: String(err) }); }
    finally { setSending(false); }
  }

  // ── DB user actions ───────────────────────────────────────────────────────
  async function addUser() {
    const e = newUserEmail.trim().toLowerCase();
    if (!e || !e.includes("@")) { setUserMsg({ ok: false, text: "Enter a valid email." }); return; }
    try {
      const r = await fetch("/api/users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, schedule: newUserSched, send_hour: newUserHour, send_day_of_week: newUserDow, send_day_of_month: newUserDom, categories: newUserCats }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setUserMsg({ ok: true, text: `${e} saved — will receive ${SCHEDULE_LABELS[newUserSched] ?? newUserSched} reports.` });
      setNewUserEmail(""); setShowAddUser(false);
      fetchUsers();
    } catch (err) { setUserMsg({ ok: false, text: String(err) }); }
  }

  async function deleteUser(id: number, email: string) {
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    setUserMsg({ ok: true, text: `${email} will no longer receive reports (kept in database).` });
    fetchUsers();
  }

  async function restoreUser(id: number) {
    await fetch(`/api/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: true }) });
    fetchUsers();
  }

  // ── Alert recipient actions ───────────────────────────────────────────────
  async function addAlertRecipient() {
    const e = newAlertEmail.trim().toLowerCase();
    if (!e || !e.includes("@")) { setAlertMsg({ ok: false, text: "Enter a valid email." }); return; }
    try {
      const r = await fetch("/api/alert-recipients", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, schedule: newAlertSched, send_hour: newAlertHour, send_day_of_week: newAlertDow, send_day_of_month: newAlertDom }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setAlertMsg({ ok: true, text: `${e} added — ${SCHEDULE_LABELS[newAlertSched] ?? newAlertSched} alerts configured.` });
      setNewAlertEmail(""); setShowAddAlert(false);
      fetchUsers();
    } catch (err) { setAlertMsg({ ok: false, text: String(err) }); }
  }

  async function deleteAlert(id: number, email: string) {
    await fetch(`/api/alert-recipients/${id}`, { method: "DELETE" });
    setAlertMsg({ ok: true, text: `${email} removed from alerts (kept in database).` });
    fetchUsers();
  }

  async function restoreAlert(id: number) {
    await fetch(`/api/alert-recipients/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: true }) });
    fetchUsers();
  }

  function startEditUser(u: ReportUser) {
    setEditingUserId(u.id);
    setEditUserSched(u.schedule); setEditUserHour(u.send_hour);
    setEditUserDow(u.send_day_of_week); setEditUserDom(u.send_day_of_month);
    setEditUserCats(u.categories);
  }

  async function saveEditUser(id: number) {
    await fetch(`/api/users/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedule: editUserSched, send_hour: editUserHour, send_day_of_week: editUserDow, send_day_of_month: editUserDom, categories: editUserCats }),
    });
    setEditingUserId(null);
    fetchUsers();
  }

  function startEditAlert(a: AlertRecipient) {
    setEditingAlertId(a.id);
    setEditAlertSched(a.schedule); setEditAlertHour(a.send_hour);
    setEditAlertDow(a.send_day_of_week); setEditAlertDom(a.send_day_of_month);
  }

  async function saveEditAlert(id: number) {
    await fetch(`/api/alert-recipients/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedule: editAlertSched, send_hour: editAlertHour, send_day_of_week: editAlertDow, send_day_of_month: editAlertDom }),
    });
    setEditingAlertId(null);
    fetchUsers();
  }

  // ── Save / Discard ─────────────────────────────────────────────────────────
  async function handleSave() {
    update({ visibleColumns: visibleCols, criteria, email });
    save();
    setSaved(true);
    // Sync criteria to DB so server-side classification can use them
    await fetch("/api/settings/criteria", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criteria }),
    });
    // If criteria changed, trigger criteria-based change detection
    if (criteriaChangedSinceLastSave) {
      fetch("/api/sheets/auto-sync?reason=criteria").catch(() => {});
    }
    prevCriteria.current = JSON.stringify(criteria);
    setCriteriaChangedSinceLastSave(false);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleDiscard() {
    setVisibleCols(savedSettings.visibleColumns);
    setCriteria(JSON.parse(JSON.stringify(savedSettings.criteria)));
    setEmail({ ...savedSettings.email });
    discard();
    setCriteriaChangedSinceLastSave(false);
  }

  const rules = criteria[critTab];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between h-16 px-6 bg-surface-container-lowest border-b border-outline-variant shrink-0">
        <div>
          <h2 className="text-sm font-bold text-on-surface">Settings</h2>
          <p className="text-[10px] text-on-surface-variant">Configure columns, classification rules, and email reports.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleDiscard} className="px-4 py-1.5 border border-outline-variant text-on-surface-variant text-sm rounded-xl hover:bg-surface-container transition-colors">Discard</button>
          <button onClick={handleSave} className={`px-5 py-1.5 text-sm font-semibold rounded-xl transition-all ${saved ? "bg-secondary-container text-on-secondary-container" : "bg-primary text-on-primary hover:bg-primary-container"}`}>
            {saved ? "✓ Saved" : "Save Changes"}
          </button>
        </div>
      </header>

      {/* Criteria-changed warning banner */}
      {criteriaChangedSinceLastSave && (
        <div className="bg-tertiary-container border-b border-tertiary/30 px-6 py-3 flex items-center gap-3">
          <AlertTriangle size={16} strokeWidth={1.75} className="text-tertiary shrink-0" />
          <p className="text-[12px] text-on-tertiary-container flex-1">
            <strong>Criteria changed but not saved.</strong> Save to apply changes and trigger change detection.
          </p>
          <button onClick={handleSave} className="text-[11px] font-bold text-tertiary border border-tertiary/40 px-3 py-1 rounded-lg hover:bg-tertiary/10 transition-colors">Save Now</button>
        </div>
      )}

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* ── Section 1: Dashboard Columns ── */}
          <Section Icon={Columns} title="Dashboard Columns">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-card">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-4">Visible Columns — {visibleCols.length} Selected</p>
              <div className="flex flex-wrap gap-2">
                {ALL_COLUMNS.map(col => {
                  const on = visibleCols.includes(col.key);
                  return (
                    <button key={col.key} onClick={() => toggleCol(col.key)} disabled={!!col.always}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${on ? "bg-secondary-container border-secondary text-on-secondary-container" : "bg-surface-container border-outline-variant text-on-surface-variant hover:border-primary/50"} ${col.always ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                      {on ? <Check size={11} strokeWidth={2.5} /> : <Plus size={11} strokeWidth={2.5} />}
                      {col.label.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>

          {/* ── Section 2: Category Criteria ── */}
          <Section Icon={SlidersHorizontal} title="Category Criteria">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-card">
              <div className="flex border-b border-surface-variant bg-surface-container-low">
                {CRIT_TABS.map(t => (
                  <button key={t.id} onClick={() => setCritTab(t.id)}
                    className={`px-7 py-3.5 text-xs font-bold uppercase tracking-wider transition-colors ${critTab === t.id ? "border-b-2 border-primary text-primary" : "text-on-surface-variant hover:text-on-surface"}`}>
                    {t.label}
                  </button>
                ))}
                <button onClick={resetCriteria} className="ml-auto mr-4 self-center text-[11px] text-on-surface-variant hover:text-primary transition-colors">Reset to defaults</button>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Rules for {critTab.charAt(0).toUpperCase() + critTab.slice(1)}</p>
                  <span className="px-2 py-0.5 bg-primary-container/20 text-primary-container text-[10px] font-bold rounded">{rules.length} RULE{rules.length !== 1 ? "S" : ""} ACTIVE</span>
                </div>
                <div className="space-y-3">
                  {rules.map((rule, idx) => (
                    <div key={rule.id} className="grid grid-cols-12 gap-3 items-end bg-surface-container p-4 rounded-lg border border-surface-variant">
                      <div className="col-span-1 flex justify-center">
                        {idx === 0 ? <span className="text-on-surface-variant text-xs font-mono pt-5">IF</span> : (
                          <div className="pt-5">
                            <select value={rule.logic} onChange={e => updateRule(critTab, idx, { logic: e.target.value as Logic })}
                              className="bg-transparent border-none text-[11px] font-bold text-primary focus:ring-0 cursor-pointer uppercase appearance-none text-center">
                              <option value="AND">AND</option><option value="OR">OR</option>
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="col-span-4">
                        <label className="block text-[10px] text-on-surface-variant uppercase mb-1">Column</label>
                        <select value={rule.column} onChange={e => updateRule(critTab, idx, { column: e.target.value })}
                          className="w-full bg-background border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none">
                          {RULE_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] text-on-surface-variant uppercase mb-1">Operator</label>
                        <select value={rule.operator} onChange={e => updateRule(critTab, idx, { operator: e.target.value as Operator })}
                          disabled={!NUMERIC_RULE_KEYS.has(rule.column)}
                          className="w-full bg-background border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none font-mono disabled:opacity-50">
                          {(NUMERIC_RULE_KEYS.has(rule.column) ? OPERATORS : ["="]).map(op => <option key={op} value={op}>{op}</option>)}
                        </select>
                      </div>
                      <div className="col-span-4">
                        <label className="block text-[10px] text-on-surface-variant uppercase mb-1">Value</label>
                        {NUMERIC_RULE_KEYS.has(rule.column) ? (
                          <input type="number" value={rule.value as number} onChange={e => updateRule(critTab, idx, { value: Number(e.target.value) })}
                            className="w-full bg-background border border-outline-variant rounded px-3 py-2 text-sm text-on-surface font-mono focus:ring-1 focus:ring-primary outline-none" />
                        ) : (
                          <input type="text" value={rule.value as string} onChange={e => updateRule(critTab, idx, { value: e.target.value })} placeholder="e.g. YouTube"
                            className="w-full bg-background border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none" />
                        )}
                      </div>
                      <div className="col-span-1 flex justify-center pb-0.5">
                        <button onClick={() => removeRule(critTab, idx)} disabled={rules.length <= 1} className="p-1.5 text-error hover:bg-error/10 rounded-full transition-colors disabled:opacity-30">
                          <Trash2 size={15} strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => addRule(critTab)} className="w-full py-4 border-2 border-dashed border-outline-variant rounded-xl flex items-center justify-center gap-2 text-on-surface-variant hover:border-primary/40 hover:text-primary transition-all">
                    <PlusCircle size={16} strokeWidth={1.75} />
                    <span className="text-xs font-semibold uppercase">Add New Rule</span>
                  </button>
                </div>
                <div className="bg-error-container/10 border border-error/20 p-4 rounded-xl flex gap-3">
                  <AlertCircle size={18} strokeWidth={1.75} className="text-error shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-error mb-0.5">Rules are evaluated left-to-right</p>
                    <p className="text-xs text-on-surface-variant">AND/OR has no precedence — conditions combine in order. Test your criteria before saving to production.</p>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* ── Section 3: Email Report Recipients ── */}
          <Section Icon={Mail} title="Email Report Recipients" subtitle="Recipients get scheduled performance reports. Removals are soft-deleted — email is kept in the database.">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 space-y-4 shadow-card">

              {/* DB recipient list */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Saved Recipients</p>
                  <button onClick={() => setShowAddUser(v => !v)} className="flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:opacity-80 transition-opacity">
                    <UserPlus size={13} strokeWidth={1.75} />
                    Add Email
                  </button>
                </div>

                {showAddUser && (
                  <div className="bg-surface-container-highest rounded-xl p-4 space-y-3 border border-outline-variant/60">
                    <input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && addUser()}
                      placeholder="name@company.com"
                      className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary outline-none" />
                    <ScheduleFields schedule={newUserSched} hour={newUserHour} dow={newUserDow} dom={newUserDom} includeInstant={false}
                      onSchedule={setNewUserSched} onHour={setNewUserHour} onDow={setNewUserDow} onDom={setNewUserDom} />
                    <div>
                      <p className="text-[10px] text-on-surface-variant uppercase mb-1">Include categories</p>
                      <div className="flex gap-2">
                        {["kill","scale","monitor","testing"].map(cat => {
                          const on = newUserCats.includes(cat);
                          return (
                            <button key={cat} onClick={() => setNewUserCats(prev => on ? prev.filter(c => c !== cat) : [...prev, cat])}
                              className={`flex items-center gap-1 px-3 py-1 rounded-full text-[11px] border transition-colors ${on ? "bg-secondary-container border-secondary text-on-secondary-container" : "border-outline-variant text-on-surface-variant hover:border-primary/50"}`}>
                              {on && <Check size={10} strokeWidth={2.5} />}
                              {cat.toUpperCase()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setShowAddUser(false)} className="text-sm text-on-surface-variant px-4 py-1.5 rounded-lg hover:bg-surface-container transition-colors">Cancel</button>
                      <button onClick={addUser} className="text-sm font-bold bg-primary text-on-primary px-5 py-1.5 rounded-lg hover:opacity-90 transition-all">Save Email</button>
                    </div>
                  </div>
                )}

                {userMsg && (
                  <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border text-[12px] ${userMsg.ok ? "bg-secondary-container/50 border-secondary/30 text-on-secondary-container" : "bg-error-container/30 border-error/20 text-error"}`}>
                    {userMsg.ok ? <CheckCircle2 size={13} strokeWidth={1.75} className="mt-0.5 shrink-0" /> : <XCircle size={13} strokeWidth={1.75} className="mt-0.5 shrink-0" />}
                    <span>{userMsg.text}</span>
                  </div>
                )}

                {users.length === 0 ? (
                  <p className="text-xs text-on-surface-variant py-2">No recipients saved yet. Click &quot;Add Email&quot; to save one.</p>
                ) : (
                  <div className="space-y-2">
                    {users.map(u => (
                      <div key={u.id} className="rounded-lg border bg-surface-container border-surface-variant">
                        <div className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <Mail size={15} strokeWidth={1.75} className="text-on-surface-variant shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm text-on-surface truncate">{u.email}</p>
                              <p className="text-[11px] text-on-surface-variant">
                                {SCHEDULE_LABELS[u.schedule] ?? u.schedule}
                                {u.categories.length > 0 && <> · {u.categories.join(", ")}</>}
                                {u.last_sent_at && <> · Last sent: {new Date(u.last_sent_at).toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}</>}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => editingUserId === u.id ? setEditingUserId(null) : startEditUser(u)} title="Edit schedule"
                              className={`p-1.5 rounded-full transition-colors ${editingUserId === u.id ? "text-primary bg-primary/10" : "text-on-surface-variant hover:bg-surface-container-high"}`}>
                              <Pencil size={13} strokeWidth={1.75} />
                            </button>
                            <button onClick={() => deleteUser(u.id, u.email)} title="Remove" className="p-1.5 text-error hover:bg-error/10 rounded-full transition-colors">
                              <UserMinus size={15} strokeWidth={1.75} />
                            </button>
                          </div>
                        </div>
                        {editingUserId === u.id && (
                          <div className="px-4 pb-4 pt-1 border-t border-outline-variant/40 space-y-3">
                            <ScheduleFields schedule={editUserSched} hour={editUserHour} dow={editUserDow} dom={editUserDom} includeInstant={false}
                              onSchedule={setEditUserSched} onHour={setEditUserHour} onDow={setEditUserDow} onDom={setEditUserDom} />
                            <div>
                              <p className="text-[10px] text-on-surface-variant uppercase mb-1">Include categories</p>
                              <div className="flex gap-2">
                                {["kill","scale","monitor","testing"].map(cat => {
                                  const on = editUserCats.includes(cat);
                                  return (
                                    <button key={cat} onClick={() => setEditUserCats(prev => on ? prev.filter(c => c !== cat) : [...prev, cat])}
                                      className={`flex items-center gap-1 px-3 py-1 rounded-full text-[11px] border transition-colors ${on ? "bg-secondary-container border-secondary text-on-secondary-container" : "border-outline-variant text-on-surface-variant hover:border-primary/50"}`}>
                                      {on && <Check size={10} strokeWidth={2.5} />}
                                      {cat.toUpperCase()}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setEditingUserId(null)} className="text-sm text-on-surface-variant px-4 py-1.5 rounded-lg hover:bg-surface-container transition-colors">Cancel</button>
                              <button onClick={() => saveEditUser(u.id)} className="text-sm font-bold bg-primary text-on-primary px-5 py-1.5 rounded-lg hover:opacity-90 transition-all">Save</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Manual send */}
              <div className="border-t border-outline-variant pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Send Report Now</p>
                  <p className="text-[10px] text-on-surface-variant/60">Choose categories, then hit send</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {["kill","scale","monitor","testing"].map(cat => {
                    const on = email.categories.includes(cat);
                    return (
                      <button key={cat} onClick={() => toggleEmailCategory(cat)}
                        className={`flex items-center gap-1 px-3 py-1 rounded-full text-[11px] border transition-colors ${on ? "bg-secondary-container border-secondary text-on-secondary-container" : "bg-surface-container border-outline-variant text-on-surface-variant hover:border-primary/50"}`}>
                        {on ? <Check size={10} strokeWidth={2.5} /> : <Plus size={10} strokeWidth={2.5} />}
                        {cat.toUpperCase()}
                      </button>
                    );
                  })}
                  <button onClick={sendReport} disabled={sending || (!email.recipients.length && users.filter(u => u.is_active).length === 0) || !email.categories.length}
                    className="ml-auto flex items-center gap-1.5 px-4 py-1.5 bg-primary text-on-primary text-[12px] font-semibold rounded-xl hover:bg-primary-container disabled:opacity-40 transition-all">
                    {sending ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : <Send size={13} strokeWidth={1.75} />}
                    {sending ? "Sending…" : "Send Report"}
                  </button>
                </div>
                {sendMsg && (
                  <div className={`flex items-start gap-2 px-4 py-3 rounded-xl border text-sm ${sendMsg.ok ? "bg-secondary-container/50 border-secondary/30 text-on-secondary-container" : "bg-error-container/30 border-error/20 text-error"}`}>
                    {sendMsg.ok ? <CheckCircle2 size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" /> : <XCircle size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" />}
                    <span>{sendMsg.text}</span>
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* ── Section 4: Category Change Alerts ── */}
          <Section Icon={BellRing} title="Category Change Alerts"
            subtitle="Notifies recipients when an ad moves between categories (e.g. Monitor → Kill). Each recipient sets their own cadence.">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 space-y-4 shadow-card">

              <div className="flex items-center gap-2 text-[11px] text-on-surface-variant">
                <Info size={13} strokeWidth={1.75} className="text-tertiary shrink-0" />
                <span><strong className="text-on-surface">Instant</strong> — next 2-min sync. &nbsp;<strong className="text-on-surface">Batched</strong> — changes bundled by day / week / month.</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Alert Recipients</p>
                  <button onClick={() => setShowAddAlert(v => !v)} className="flex items-center gap-1.5 text-[11px] font-semibold text-tertiary hover:opacity-80 transition-opacity">
                    <BellPlus size={13} strokeWidth={1.75} />
                    Add Recipient
                  </button>
                </div>

                {showAddAlert && (
                  <div className="bg-surface-container-highest rounded-xl p-4 space-y-3 border border-outline-variant/60">
                    <input type="email" value={newAlertEmail} onChange={e => setNewAlertEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && addAlertRecipient()}
                      placeholder="name@company.com"
                      className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary outline-none" />
                    <ScheduleFields schedule={newAlertSched} hour={newAlertHour} dow={newAlertDow} dom={newAlertDom} includeInstant
                      onSchedule={setNewAlertSched} onHour={setNewAlertHour} onDow={setNewAlertDow} onDom={setNewAlertDom} />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setShowAddAlert(false)} className="text-sm text-on-surface-variant px-4 py-1.5 rounded-lg hover:bg-surface-container transition-colors">Cancel</button>
                      <button onClick={addAlertRecipient} className="text-sm font-bold bg-tertiary/20 text-tertiary border border-tertiary/40 px-5 py-1.5 rounded-lg hover:bg-tertiary/30 transition-all">Add Recipient</button>
                    </div>
                  </div>
                )}

                {alertMsg && (
                  <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border text-[12px] ${alertMsg.ok ? "bg-secondary-container/50 border-secondary/30 text-on-secondary-container" : "bg-error-container/30 border-error/20 text-error"}`}>
                    {alertMsg.ok ? <CheckCircle2 size={13} strokeWidth={1.75} className="mt-0.5 shrink-0" /> : <XCircle size={13} strokeWidth={1.75} className="mt-0.5 shrink-0" />}
                    <span>{alertMsg.text}</span>
                  </div>
                )}

                {alerts.length === 0 ? (
                  <p className="text-xs text-on-surface-variant py-2">No alert recipients yet. Add one above.</p>
                ) : (
                  <div className="space-y-2">
                    {alerts.map(a => (
                      <div key={a.id} className="rounded-lg border bg-surface-container border-surface-variant">
                        <div className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <BellActive size={15} strokeWidth={1.75} className="text-tertiary shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm text-on-surface truncate">{a.email}</p>
                              <p className="text-[11px] text-on-surface-variant">
                                {SCHEDULE_LABELS[a.schedule] ?? a.schedule}
                                {a.last_sent_at && <> · Last alerted: {new Date(a.last_sent_at).toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}</>}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => editingAlertId === a.id ? setEditingAlertId(null) : startEditAlert(a)} title="Edit schedule"
                              className={`p-1.5 rounded-full transition-colors ${editingAlertId === a.id ? "text-tertiary bg-tertiary/10" : "text-on-surface-variant hover:bg-surface-container-high"}`}>
                              <Pencil size={13} strokeWidth={1.75} />
                            </button>
                            <button onClick={() => deleteAlert(a.id, a.email)} title="Remove" className="p-1.5 text-error hover:bg-error/10 rounded-full transition-colors">
                              <BellOff size={15} strokeWidth={1.75} />
                            </button>
                          </div>
                        </div>
                        {editingAlertId === a.id && (
                          <div className="px-4 pb-4 pt-1 border-t border-outline-variant/40 space-y-3">
                            <ScheduleFields schedule={editAlertSched} hour={editAlertHour} dow={editAlertDow} dom={editAlertDom} includeInstant
                              onSchedule={setEditAlertSched} onHour={setEditAlertHour} onDow={setEditAlertDow} onDom={setEditAlertDom} />
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setEditingAlertId(null)} className="text-sm text-on-surface-variant px-4 py-1.5 rounded-lg hover:bg-surface-container transition-colors">Cancel</button>
                              <button onClick={() => saveEditAlert(a.id)} className="text-sm font-bold bg-tertiary/20 text-tertiary border border-tertiary/40 px-5 py-1.5 rounded-lg hover:bg-tertiary/30 transition-all">Save</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Section>

          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}
