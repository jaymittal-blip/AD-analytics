import { Ad } from "./types";
import { CriteriaMap, Rule } from "./settings";

export interface ScaleSuggestion {
  increaseRange: string;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  warnings: string[];
}

export interface OutlookResult {
  verdict: "LIKELY_SCALE" | "LIKELY_KILL" | "UNCERTAIN";
  confidence: "high" | "medium" | "low";
  reasons: string[];
  warnings: string[];
}

function firstRoasValue(rules: Rule[]): number | null {
  const r = rules.find(r => r.column === "roas");
  return r ? Number(r.value) : null;
}

function getComparables(ad: Ad, allAds: Ad[]) {
  const match = (a: Ad) =>
    a.brand === ad.brand ||
    a.creative_theme === ad.creative_theme ||
    a.target_audience === ad.target_audience;
  return {
    wins:   allAds.filter(a => a._class === "ENDED_WIN"  && match(a)),
    losses: allAds.filter(a => a._class === "ENDED_LOSS" && match(a)),
  };
}

export function getScaleSuggestion(ad: Ad, allAds: Ad[], criteria: CriteriaMap): ScaleSuggestion {
  const scaleThreshold = firstRoasValue(criteria.scale) ?? 15;
  const { wins, losses } = getComparables(ad, allAds);
  const reasons: string[] = [];
  const warnings: string[] = [];

  // Base increase from ROAS headroom above scale threshold
  const headroomPct = (ad.roas - scaleThreshold) / scaleThreshold;
  let [lo, hi] =
    headroomPct > 1.0 ? [50, 100] :
    headroomPct > 0.5 ? [30,  60] :
    headroomPct > 0.2 ? [15,  35] :
                        [10,  20];

  if (headroomPct > 0.5) {
    reasons.push(`ROAS ${ad.roas.toFixed(1)}x is ${Math.round(headroomPct * 100)}% above your scale threshold`);
  } else {
    reasons.push(`ROAS ${ad.roas.toFixed(1)}x just clears the scale threshold — scale conservatively`);
  }

  // Frequency modifier
  if (ad.frequency > 2.5) {
    lo = Math.round(lo * 0.4); hi = Math.round(hi * 0.4);
    warnings.push(`Frequency ${ad.frequency.toFixed(1)} — audience near saturation, cap scale`);
  } else if (ad.frequency > 2.0) {
    lo = Math.round(lo * 0.7); hi = Math.round(hi * 0.7);
    warnings.push(`Frequency ${ad.frequency.toFixed(1)} — monitor for fatigue after scaling`);
  } else {
    reasons.push(`Frequency ${ad.frequency.toFixed(1)} — audience not saturated`);
  }

  // Days running modifier
  if (ad.days_running < 7) {
    lo = Math.round(lo * 0.4); hi = Math.round(hi * 0.4);
    warnings.push(`Only ${ad.days_running} days running — scale very cautiously`);
  } else if (ad.days_running < 14) {
    lo = Math.round(lo * 0.7); hi = Math.round(hi * 0.7);
    warnings.push(`${ad.days_running} days — wait for 14+ days before aggressive scaling`);
  } else if (ad.days_running > 30) {
    reasons.push(`${ad.days_running} days of proven performance`);
  }

  // Historical ceiling from ENDED_WIN comparables
  if (wins.length > 0) {
    const peakSpend = Math.max(...wins.map(a => a.spend));
    const headroomToCeiling = (peakSpend - ad.spend) / ad.spend;
    if (headroomToCeiling < 0.25) {
      const maxIncrease = Math.max(5, Math.round(headroomToCeiling * 100 * 0.8));
      hi = Math.min(hi, maxIncrease);
      lo = Math.min(lo, hi);
      warnings.push(`Near peak spend of ${wins.length} comparable winner(s) — ceiling risk`);
    } else {
      reasons.push(`${wins.length} comparable ENDED_WIN ad(s) peaked at ₹${Math.round(peakSpend / 1000)}K`);
    }
  }

  // ENDED_LOSS ceiling warning
  if (losses.length > 0) {
    const minLossSpend = Math.min(...losses.map(a => a.spend));
    if (ad.spend * (1 + hi / 100) > minLossSpend * 0.85) {
      warnings.push(`Similar ads failed around ₹${Math.round(minLossSpend / 1000)}K — watch that ceiling`);
    }
  }

  // Safety: ensure lo never exceeds hi
  hi = Math.max(hi, 2);
  lo = Math.min(lo, hi);

  const dataPoints = wins.length + losses.length;
  const confidence: ScaleSuggestion["confidence"] =
    dataPoints >= 3 ? "high" : dataPoints >= 1 ? "medium" : "low";

  return { increaseRange: `+${lo}–${hi}%`, confidence, reasons, warnings };
}

export function getOutlook(ad: Ad, allAds: Ad[], criteria: CriteriaMap): OutlookResult {
  const killThreshold  = firstRoasValue(criteria.kill)  ?? 2.5;
  const scaleThreshold = firstRoasValue(criteria.scale) ?? 15;
  const { wins, losses } = getComparables(ad, allAds);
  const reasons: string[] = [];
  const warnings: string[] = [];

  // Too early for very new Testing ads
  if (ad.days_running < 5) {
    reasons.push(`Only ${ad.days_running} days running — need more data`);
    return { verdict: "UNCERTAIN", confidence: "low", reasons, warnings };
  }

  let score = 0;

  // 1. ROAS position between thresholds
  const range = Math.max(scaleThreshold - killThreshold, 1);
  const pos   = (ad.roas - killThreshold) / range;
  if (pos > 0.65)     { score += 2; reasons.push(`ROAS ${ad.roas.toFixed(1)}x trending toward scale threshold`); }
  else if (pos > 0.35){ score += 1; reasons.push(`ROAS ${ad.roas.toFixed(1)}x in mid-range`); }
  else if (pos < 0.2) { score -= 2; warnings.push(`ROAS ${ad.roas.toFixed(1)}x dangerously close to kill threshold`); }
  else                { score -= 1; }

  // 2. Frequency
  if (ad.frequency > 2.5)      { score -= 2; warnings.push(`High frequency (${ad.frequency.toFixed(1)}) — audience saturating`); }
  else if (ad.frequency > 2.0) { score -= 1; warnings.push(`Frequency ${ad.frequency.toFixed(1)} is elevated`); }
  else if (ad.frequency < 1.5) { score += 1; reasons.push(`Low frequency (${ad.frequency.toFixed(1)}) — room to grow`); }

  // 3. Historical win/loss ratio from comparables
  const total = wins.length + losses.length;
  if (total > 0) {
    const winRate = wins.length / total;
    if (winRate >= 0.6)      { score += 2; reasons.push(`${wins.length}/${total} comparable ads ended as winners`); }
    else if (winRate >= 0.4) { score += 1; }
    else                     { score -= 1; warnings.push(`${losses.length}/${total} comparable ads ended as losses`); }
  }

  // 4. CTR vs ENDED_WIN comparables
  if (wins.length > 0) {
    const avgWinCtr = wins.reduce((s, a) => s + (a.ctr ?? 0), 0) / wins.length;
    if (avgWinCtr > 0) {
      if (ad.ctr >= avgWinCtr)           { score += 1; reasons.push(`CTR matches or beats comparable winners`); }
      else if (ad.ctr < avgWinCtr * 0.7) { score -= 1; warnings.push(`CTR below comparable winners (avg ${avgWinCtr.toFixed(1)}%)`); }
    }
  }

  // 5. Stagnation signal
  if (ad.days_running > 21 && pos < 0.35) {
    score -= 1;
    warnings.push(`${ad.days_running} days without approaching scale — stagnation risk`);
  }

  const verdict: OutlookResult["verdict"] =
    score >= 3  ? "LIKELY_SCALE" :
    score <= -2 ? "LIKELY_KILL"  : "UNCERTAIN";

  const confidence: OutlookResult["confidence"] =
    total >= 3 ? "high" : total >= 1 ? "medium" : "low";

  return { verdict, confidence, reasons, warnings };
}

export const SCALE_SUGGESTION_INFO =
  "Suggested spend increase based on: ROAS headroom above your scale threshold, " +
  "current frequency (audience fatigue risk), days running (proof of stability), " +
  "and comparable ENDED_WIN/ENDED_LOSS ads with the same brand, creative theme, or audience. " +
  "Confidence is higher when more comparable ended ads are available.";

export const OUTLOOK_INFO =
  "Predicts whether this ad is trending toward Scale or Kill by scoring: " +
  "ROAS position between your kill and scale thresholds, frequency level, " +
  "win/loss rate of historically comparable ads (same brand, theme, or audience), " +
  "CTR vs those winners, and stagnation if days running is high but ROAS hasn't moved.";
