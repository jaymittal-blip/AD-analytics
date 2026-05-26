import { Ad, AdClass } from "./types";

// ── Column definitions ───────────────────────────────────────────────────────

export const ALL_COLUMNS: { key: string; label: string; always?: boolean }[] = [
  { key: "ad_id",                 label: "AD ID",                  always: true },
  { key: "_class",                label: "Recommendation",         always: true },
  { key: "platform",              label: "Platform"                             },
  { key: "brand",                 label: "Brand"                                },
  { key: "category",              label: "Category"                             },
  { key: "ad_type",               label: "Ad Type"                              },
  { key: "target_audience",       label: "Target Audience"                      },
  { key: "creative_theme",        label: "Creative Theme"                       },
  { key: "status",                label: "Status"                               },
  { key: "start_date",            label: "Start Date"                           },
  { key: "days_running",          label: "Days Running"                         },
  { key: "spend",                 label: "Spend"                                },
  { key: "revenue",               label: "Revenue"                              },
  { key: "roas",                  label: "ROAS"                                 },
  { key: "impressions",           label: "Impressions"                          },
  { key: "clicks",                label: "Clicks"                               },
  { key: "ctr",                   label: "CTR"                                  },
  { key: "conversions",           label: "Conversions"                          },
  { key: "cpc",                   label: "CPC"                                  },
  { key: "cpa",                   label: "CPA"                                  },
  { key: "creative_score",        label: "Creative Score"                       },
  { key: "landing_page_score",    label: "Landing Page Score"                   },
  { key: "frequency",             label: "Frequency"                            },
  { key: "video_completion_rate", label: "Video Completion Rate"                },
];

// All columns available as rule targets (excludes _class which is the computed result)
export const RULE_COLUMNS = ALL_COLUMNS.filter(c => c.key !== "_class");

// Numeric columns — support all operators; text columns only support "="
export const NUMERIC_RULE_KEYS = new Set([
  "days_running", "spend", "revenue", "roas", "impressions", "clicks",
  "ctr", "conversions", "cpc", "cpa", "creative_score", "landing_page_score",
  "frequency", "video_completion_rate",
]);

// ── Rule types ───────────────────────────────────────────────────────────────

export type Operator = "<" | ">" | "=" | ">=" | "<=";
export type Logic    = "AND" | "OR";

export interface Rule {
  id:       string;
  column:   string;
  operator: Operator;
  value:    number | string;
  logic:    Logic; // how this rule joins with the previous rule (ignored for rule[0])
}

export type CriteriaMap = Record<"kill" | "scale" | "monitor" | "testing", Rule[]>;

export interface EmailSettings {
  schedule:   "daily" | "weekly" | "monthly";
  categories: string[];
  recipients: string[];
}

export interface AppSettings {
  visibleColumns: string[];
  criteria:       CriteriaMap;
  email:          EmailSettings;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_VISIBLE_COLUMNS: string[] = [
  "ad_id", "_class", "platform", "brand", "creative_theme",
  "target_audience", "days_running", "spend", "roas", "ctr", "revenue",
];

export const DEFAULT_CRITERIA: CriteriaMap = {
  kill: [
    { id: "k1", column: "roas",         operator: "<",  value: 2.5,   logic: "AND" },
    { id: "k2", column: "days_running", operator: ">=", value: 14,    logic: "OR"  },
    { id: "k3", column: "spend",        operator: ">=", value: 30000, logic: "AND" },
  ],
  scale: [
    { id: "s1", column: "roas",  operator: ">=", value: 15,    logic: "AND" },
    { id: "s2", column: "spend", operator: ">=", value: 20000, logic: "AND" },
  ],
  monitor: [
    { id: "m1", column: "roas", operator: ">=", value: 2.5, logic: "AND" },
    { id: "m2", column: "roas", operator: "<",  value: 15,  logic: "AND" },
  ],
  testing: [
    { id: "t1", column: "days_running", operator: "<", value: 14,    logic: "AND" },
    { id: "t2", column: "spend",        operator: "<", value: 30000, logic: "AND" },
  ],
};

export const DEFAULT_EMAIL: EmailSettings = {
  schedule:   "weekly",
  categories: ["kill", "scale"],
  recipients: [],
};

export const DEFAULT_SETTINGS: AppSettings = {
  visibleColumns: DEFAULT_VISIBLE_COLUMNS,
  criteria:       DEFAULT_CRITERIA,
  email:          DEFAULT_EMAIL,
};

// ── Rule evaluation ───────────────────────────────────────────────────────────

function evalRule(ad: Ad, rule: Rule): boolean {
  const raw = (ad as unknown as Record<string, unknown>)[rule.column];
  if (raw === undefined || raw === null) return false;
  if (NUMERIC_RULE_KEYS.has(rule.column)) {
    const n = Number(raw);
    const v = Number(rule.value);
    switch (rule.operator) {
      case "<":  return n <  v;
      case ">":  return n >  v;
      case "=":  return n === v;
      case ">=": return n >= v;
      case "<=": return n <= v;
    }
  }
  // Text columns: only "=" is meaningful — case-insensitive match
  return String(raw).toLowerCase() === String(rule.value).toLowerCase();
}

// Evaluate left-to-right (AND/OR, no precedence)
export function evalRules(ad: Ad, rules: Rule[]): boolean {
  if (rules.length === 0) return false;
  let result = evalRule(ad, rules[0]);
  for (let i = 1; i < rules.length; i++) {
    result = rules[i].logic === "AND"
      ? result && evalRule(ad, rules[i])
      : result || evalRule(ad, rules[i]);
  }
  return result;
}

// ── Classifier with custom criteria ──────────────────────────────────────────

export function classifyWithCriteria(
  ad: Omit<Ad, "_class">,
  criteria: CriteriaMap
): AdClass {
  const status = (ad.status ?? "").toLowerCase();
  const adFull = ad as Ad;

  if (status === "completed" || status === "paused") {
    if (evalRules(adFull, criteria.kill))  return "ENDED_LOSS";
    if (evalRules(adFull, criteria.scale)) return "ENDED_WIN";
    return "ENDED_OK";
  }
  if (evalRules(adFull, criteria.kill))    return "KILL";
  if (evalRules(adFull, criteria.scale))   return "SCALE";
  if (evalRules(adFull, criteria.testing)) return "TESTING";
  if (evalRules(adFull, criteria.monitor)) return "MONITOR";
  // Unclassified active ads → Testing (no criteria matched; needs more data)
  return "TESTING";
}
