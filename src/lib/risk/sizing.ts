// Portfolio-level risk and sizing tools.
//
// • Risk parity:  weights w_i ∝ 1/σ_i so each pair contributes equal risk to the portfolio.
//   For uncorrelated strategies this is exact; for correlated strategies it is the
//   "naive" risk parity that Maillard, Roncalli & Teiletche (2010) call inverse-vol weighting.
//
// • β-exposure:  estimate per-pair daily β to a market index via OLS on returns and
//   compute net portfolio β so the user can see how sector-neutral the book really is.
//
// • Amihud (2002) illiquidity:  ILLIQ_t = |r_t| / V_t (dollar).  Lower ILLIQ ⇒ deeper market.
//   We screen out pairs whose worse leg sits below a percentile threshold.
//
// • Correlation-of-pairs heatmap: builds the correlation matrix of strategy daily P&L
//   so the user can see clusters of effectively-redundant pairs.

import { ols } from "../math/ols";
import { mean, pctReturns, std } from "../math/stats";
import type { BarSeries, PairData } from "../data/synthetic";
import type { BacktestResult } from "../backtest/engine";

export function inverseVolWeights(volatilities: number[]): number[] {
  const inv = volatilities.map((v) => (v > 0 ? 1 / v : 0));
  const total = inv.reduce((s, x) => s + x, 0);
  if (total === 0) return volatilities.map(() => 0);
  return inv.map((x) => x / total);
}

// Risk-parity weights for a covariance matrix Σ. Solves for w with
//   w_i · (Σ w)_i = c   for all i, w ≥ 0, Σ w_i = 1.
// Iterative scheme from Maillard et al. (2010) — converges in <100 iterations for typical pair counts.
export function riskParityWeights(cov: number[][], iters = 200, tol = 1e-7): number[] {
  const n = cov.length;
  let w = new Array(n).fill(1 / n);
  for (let it = 0; it < iters; it++) {
    const sigW = w.map((_, i) => {
      let s = 0;
      for (let j = 0; j < n; j++) s += cov[i][j] * w[j];
      return s;
    });
    // marginal contribution to risk
    const totalRisk = Math.sqrt(w.reduce((s, wi, i) => s + wi * sigW[i], 0));
    if (!isFinite(totalRisk) || totalRisk === 0) break;
    const target = totalRisk / n;       // each name contributes 1/n of total
    let maxDelta = 0;
    const next = w.slice();
    for (let i = 0; i < n; i++) {
      // riskContribution_i = w_i * sigW_i / totalRisk; we want it = target
      const denom = sigW[i];
      if (denom <= 0) continue;
      const newWi = (target * totalRisk) / denom;
      maxDelta = Math.max(maxDelta, Math.abs(newWi - w[i]));
      next[i] = Math.max(newWi, 0);
    }
    const sum = next.reduce((s, x) => s + x, 0);
    if (sum > 0) for (let i = 0; i < n; i++) next[i] /= sum;
    w = next;
    if (maxDelta < tol) break;
  }
  return w;
}

// β of return series r against benchmark series bm via OLS (same length).
export function betaToBenchmark(r: number[], bm: number[]): number {
  if (r.length !== bm.length || r.length < 30) return 0;
  // strip NaNs from either side
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < r.length; i++) {
    if (Number.isFinite(r[i]) && Number.isFinite(bm[i])) {
      xs.push(bm[i]);
      ys.push(r[i]);
    }
  }
  if (xs.length < 30) return 0;
  try {
    const fit = ols(ys, xs);
    return fit.beta;
  } catch {
    return 0;
  }
}

// Amihud illiquidity for a single bar series. Returns the median value across bars,
// interpreted as the price impact per $1 of volume scaled to 1e6 (a standard reporting unit).
export function amihudIlliquidity(series: BarSeries): number {
  const r = pctReturns(series.prices);
  const out: number[] = [];
  for (let i = 0; i < r.length; i++) {
    const dvol = series.prices[i + 1] * series.volumes[i + 1];
    if (dvol <= 0) continue;
    out.push(Math.abs(r[i]) / dvol);
  }
  if (out.length === 0) return Infinity;
  out.sort((a, b) => a - b);
  const med = out[Math.floor(out.length / 2)];
  return med * 1e6; // scaled
}

// Pair-level "worst-leg" Amihud: useful as a screen.
export function pairAmihud(pair: PairData): number {
  return Math.max(amihudIlliquidity(pair.a), amihudIlliquidity(pair.b));
}

// Correlation matrix of an array of return series. Pads to common length.
export function correlationMatrix(series: number[][]): number[][] {
  const n = series.length;
  const out: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const minLen = Math.min(...series.map((s) => s.length));
  const trimmed = series.map((s) => s.slice(s.length - minLen));
  const means = trimmed.map((s) => mean(s));
  const stds = trimmed.map((s) => std(s));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      if (stds[i] === 0 || stds[j] === 0) {
        out[i][j] = i === j ? 1 : 0;
        out[j][i] = out[i][j];
        continue;
      }
      let s = 0;
      for (let k = 0; k < minLen; k++) s += (trimmed[i][k] - means[i]) * (trimmed[j][k] - means[j]);
      const cov = s / (minLen - 1);
      out[i][j] = cov / (stds[i] * stds[j]);
      out[j][i] = out[i][j];
    }
  }
  return out;
}

// Wraps a list of backtest results into the inputs needed by risk-parity sizing.
export function portfolioVolatilities(results: BacktestResult[]): number[] {
  return results.map((r) => std(r.dailyReturn) * Math.sqrt(252));
}

export function portfolioCovariance(results: BacktestResult[]): number[][] {
  const series = results.map((r) => r.dailyReturn);
  const minLen = Math.min(...series.map((s) => s.length));
  const trimmed = series.map((s) => s.slice(s.length - minLen));
  const n = series.length;
  const out: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const means = trimmed.map(mean);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = 0;
      for (let k = 0; k < minLen; k++) s += (trimmed[i][k] - means[i]) * (trimmed[j][k] - means[j]);
      const cov = s / Math.max(1, minLen - 1) * 252;
      out[i][j] = cov;
      out[j][i] = cov;
    }
  }
  return out;
}
