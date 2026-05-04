// Basic descriptive statistics. Daily-bar conventions.

export const TRADING_DAYS = 252;

export function mean(x: number[]): number {
  if (x.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i];
  return s / x.length;
}

export function variance(x: number[], ddof = 1): number {
  if (x.length <= ddof) return 0;
  const m = mean(x);
  let s = 0;
  for (let i = 0; i < x.length; i++) {
    const d = x[i] - m;
    s += d * d;
  }
  return s / (x.length - ddof);
}

export function std(x: number[], ddof = 1): number {
  return Math.sqrt(variance(x, ddof));
}

export function covariance(x: number[], y: number[], ddof = 1): number {
  const n = Math.min(x.length, y.length);
  if (n <= ddof) return 0;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let s = 0;
  for (let i = 0; i < n; i++) s += (x[i] - mx) * (y[i] - my);
  return s / (n - ddof);
}

export function correlation(x: number[], y: number[]): number {
  const c = covariance(x, y);
  const sx = std(x);
  const sy = std(y);
  if (sx === 0 || sy === 0) return 0;
  return c / (sx * sy);
}

// Simple returns from a price series.
export function pctReturns(p: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < p.length; i++) r.push(p[i] / p[i - 1] - 1);
  return r;
}

// Log returns.
export function logReturns(p: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < p.length; i++) r.push(Math.log(p[i] / p[i - 1]));
  return r;
}

export function cumProduct(returns: number[], start = 1): number[] {
  const out: number[] = [];
  let v = start;
  for (let i = 0; i < returns.length; i++) {
    v *= 1 + returns[i];
    out.push(v);
  }
  return out;
}

export function rollingMean(x: number[], window: number): (number | null)[] {
  const out: (number | null)[] = new Array(x.length).fill(null);
  if (window <= 0 || window > x.length) return out;
  let s = 0;
  for (let i = 0; i < window; i++) s += x[i];
  out[window - 1] = s / window;
  for (let i = window; i < x.length; i++) {
    s += x[i] - x[i - window];
    out[i] = s / window;
  }
  return out;
}

export function rollingStd(x: number[], window: number, ddof = 1): (number | null)[] {
  const out: (number | null)[] = new Array(x.length).fill(null);
  if (window <= ddof || window > x.length) return out;
  // O(n*w) but n*w ~ 1e5; fine.
  for (let i = window - 1; i < x.length; i++) {
    const slice = x.slice(i - window + 1, i + 1);
    out[i] = std(slice, ddof);
  }
  return out;
}

// Quick Sharpe given a series of period returns. Annualization factor defaults to TRADING_DAYS.
export function sharpe(returns: number[], rfPerPeriod = 0, annualize = TRADING_DAYS): number {
  if (returns.length < 2) return 0;
  const excess = returns.map((r) => r - rfPerPeriod);
  const m = mean(excess);
  const s = std(excess);
  if (s === 0) return 0;
  return (m / s) * Math.sqrt(annualize);
}

export function sortino(returns: number[], rfPerPeriod = 0, annualize = TRADING_DAYS): number {
  if (returns.length < 2) return 0;
  const excess = returns.map((r) => r - rfPerPeriod);
  const m = mean(excess);
  const downs = excess.filter((r) => r < 0);
  if (downs.length < 2) return 0;
  // semi-deviation around 0 (target = rf)
  let s = 0;
  for (let i = 0; i < downs.length; i++) s += downs[i] * downs[i];
  const downStd = Math.sqrt(s / downs.length);
  if (downStd === 0) return 0;
  return (m / downStd) * Math.sqrt(annualize);
}

// Maximum drawdown from an equity curve. Returns (mdd as positive fraction, peakIdx, troughIdx).
export function maxDrawdown(equity: number[]): { mdd: number; peakIdx: number; troughIdx: number } {
  let peak = equity[0] ?? 1;
  let peakIdx = 0;
  let mdd = 0;
  let troughIdx = 0;
  let curPeakIdx = 0;
  for (let i = 0; i < equity.length; i++) {
    if (equity[i] > peak) { peak = equity[i]; curPeakIdx = i; }
    const dd = (peak - equity[i]) / peak;
    if (dd > mdd) { mdd = dd; peakIdx = curPeakIdx; troughIdx = i; }
  }
  return { mdd, peakIdx, troughIdx };
}

export function cagr(equity: number[], periodsPerYear = TRADING_DAYS): number {
  if (equity.length < 2) return 0;
  const total = equity[equity.length - 1] / equity[0];
  if (total <= 0) return -1;
  const years = (equity.length - 1) / periodsPerYear;
  return Math.pow(total, 1 / years) - 1;
}

export function quantile(x: number[], q: number): number {
  if (x.length === 0) return NaN;
  const sorted = [...x].sort((a, b) => a - b);
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - i) + sorted[hi] * (i - lo);
}
