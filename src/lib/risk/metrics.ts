// Extended risk metrics. Inputs are daily fractional returns and/or an equity curve.
//
//   • VaR / CVaR (historical)            — Rockafellar & Uryasev (2002)
//   • Ulcer Index, Pain Ratio            — Martin & McCann (1989), Becker (2006)
//   • Sterling ratio                      — Deane Sterling (1981)
//   • Information ratio vs benchmark     — Treynor & Black (1973), Goodwin (1998)
//   • Skew, Kurtosis                     — descriptive but underrated for stat-arb
//   • Maximum consecutive losses         — practitioner heuristic
//
// All annualised where the convention is daily; uses 252 trading days.

import { mean, std, TRADING_DAYS, quantile } from "../math/stats";

export interface ReturnMoments {
  mean: number;
  std: number;
  skew: number;
  excessKurtosis: number;
}

export function moments(r: number[]): ReturnMoments {
  if (r.length < 4) return { mean: 0, std: 0, skew: 0, excessKurtosis: 0 };
  const m = mean(r);
  const sd = std(r);
  if (sd === 0) return { mean: m, std: 0, skew: 0, excessKurtosis: 0 };
  let m3 = 0, m4 = 0;
  for (let i = 0; i < r.length; i++) {
    const d = r[i] - m;
    m3 += d * d * d;
    m4 += d * d * d * d;
  }
  m3 /= r.length;
  m4 /= r.length;
  const skew = m3 / Math.pow(sd, 3);
  const excessKurtosis = m4 / Math.pow(sd, 4) - 3;
  return { mean: m, std: sd, skew, excessKurtosis };
}

// Historical VaR at α (α=0.05 → 95% VaR). Returns negative number (loss).
export function historicalVaR(r: number[], alpha = 0.05): number {
  if (r.length === 0) return 0;
  return quantile(r, alpha);
}

// Conditional VaR / Expected Shortfall: average loss in the worst α% tail.
export function conditionalVaR(r: number[], alpha = 0.05): number {
  if (r.length === 0) return 0;
  const sorted = [...r].sort((a, b) => a - b);
  const cutoff = Math.max(1, Math.floor(alpha * sorted.length));
  let s = 0;
  for (let i = 0; i < cutoff; i++) s += sorted[i];
  return s / cutoff;
}

// Ulcer Index = sqrt( mean( (drawdown_t)^2 ) ).  Lower is better.
export function ulcerIndex(equity: number[]): number {
  if (equity.length === 0) return 0;
  let peak = equity[0];
  let s = 0;
  for (let i = 0; i < equity.length; i++) {
    if (equity[i] > peak) peak = equity[i];
    const dd = (peak - equity[i]) / peak;
    s += dd * dd;
  }
  return Math.sqrt(s / equity.length);
}

// Pain ratio = annualised return / Ulcer Index.
export function painRatio(equity: number[], periodsPerYear = TRADING_DAYS): number {
  const ui = ulcerIndex(equity);
  if (ui === 0 || equity.length < 2) return 0;
  const total = equity[equity.length - 1] / equity[0] - 1;
  const years = (equity.length - 1) / periodsPerYear;
  const annual = years > 0 ? Math.pow(1 + total, 1 / years) - 1 : 0;
  return annual / ui;
}

// Sterling ratio = annualised return / |average annual drawdown|.
// We approximate using the trailing 12-month max drawdown over the sample.
export function sterlingRatio(equity: number[], periodsPerYear = TRADING_DAYS): number {
  if (equity.length < periodsPerYear * 2) return 0;
  const annualDDs: number[] = [];
  const yearBars = periodsPerYear;
  for (let start = 0; start + yearBars <= equity.length; start += yearBars) {
    let peak = equity[start];
    let mdd = 0;
    for (let i = start; i < start + yearBars; i++) {
      if (equity[i] > peak) peak = equity[i];
      mdd = Math.max(mdd, (peak - equity[i]) / peak);
    }
    annualDDs.push(mdd);
  }
  const avgDD = annualDDs.reduce((s, x) => s + x, 0) / Math.max(1, annualDDs.length);
  if (avgDD === 0) return 0;
  const total = equity[equity.length - 1] / equity[0] - 1;
  const years = (equity.length - 1) / periodsPerYear;
  const annual = years > 0 ? Math.pow(1 + total, 1 / years) - 1 : 0;
  return annual / avgDD;
}

// Information ratio: active-return mean / tracking error vs benchmark.
export function informationRatio(strategy: number[], benchmark: number[], periodsPerYear = TRADING_DAYS): number {
  const n = Math.min(strategy.length, benchmark.length);
  const active: number[] = new Array(n);
  for (let i = 0; i < n; i++) active[i] = strategy[i] - benchmark[i];
  const m = mean(active);
  const sd = std(active);
  if (sd === 0) return 0;
  return (m / sd) * Math.sqrt(periodsPerYear);
}

// Maximum consecutive losing trades or losing days.
export function maxConsecutiveLosses(r: number[]): number {
  let cur = 0;
  let best = 0;
  for (let i = 0; i < r.length; i++) {
    if (r[i] < 0) { cur++; best = Math.max(best, cur); }
    else cur = 0;
  }
  return best;
}
