// Augmented Dickey-Fuller test, constant-only specification (case "c").
// Regression: Δy_t = α + γ y_{t-1} + Σ_{i=1..p} φ_i Δy_{t-i} + ε_t
// H0: γ = 0  (unit root, non-stationary)   H1: γ < 0  (stationary)
// We compare the t-statistic on γ against MacKinnon (1996) finite-sample critical
// values, computed via response surface τ_q(T) = β_∞ + β_1/T + β_2/T² + β_3/T³.

import { olsMulti } from "./ols";

// MacKinnon (1996) Table 2, case "c" (constant, no trend).
// Source: J.G. MacKinnon, "Numerical Distribution Functions for Unit Root and
// Cointegration Tests," Journal of Applied Econometrics, 11 (1996) 601-618.
const MACKINNON_C = {
  "0.01":  { binf: -3.43035, b1:  -6.5393, b2: -16.786, b3:  -79.433 },
  "0.025": { binf: -3.12035, b1:  -4.6063, b2:  -8.553, b3:  -27.877 },
  "0.05":  { binf: -2.86154, b1:  -2.8903, b2:  -4.234, b3:  -40.040 },
  "0.10":  { binf: -2.56677, b1:  -1.5384, b2:  -2.809, b3:    0.000 },
} as const;

export type AdfLevel = "0.01" | "0.025" | "0.05" | "0.10";

function mackinnonCV(level: AdfLevel, T: number): number {
  const c = MACKINNON_C[level];
  return c.binf + c.b1 / T + c.b2 / (T * T) + c.b3 / (T * T * T);
}

export interface AdfResult {
  tStat: number;            // ADF test statistic
  lag: number;              // number of augmenting lags used
  nUsed: number;            // observations used in regression
  criticalValues: { "1%": number; "5%": number; "10%": number };
  pValueApprox: number;     // crude monotone interpolation; tails labelled as <0.01 / >0.10
  isStationary5: boolean;   // true if tStat < CV(5%)
  isStationary1: boolean;   // true if tStat < CV(1%)
  gamma: number;            // estimated coefficient on y_{t-1}
}

// Schwert (1989) default for ADF lag length.
export function schwertLag(T: number): number {
  return Math.floor(12 * Math.pow(T / 100, 0.25));
}

export function adfTest(y: number[], lag = 1): AdfResult {
  const T = y.length;
  if (T < 8 + lag) throw new Error(`adfTest: series too short (T=${T}, lag=${lag})`);
  const dy: number[] = new Array(T - 1);
  for (let i = 1; i < T; i++) dy[i - 1] = y[i] - y[i - 1];

  // Build regression matrices: dependent = Δy_t for t = lag+1..T-1 (zero-indexed in dy: lag..T-2).
  // Regressors: [1, y_{t-1}, Δy_{t-1}, ..., Δy_{t-lag}].
  const start = lag;
  const nUsed = dy.length - lag;
  if (nUsed < 4) throw new Error("adfTest: not enough observations after lags");
  const yReg: number[] = new Array(nUsed);
  const X: number[][] = new Array(nUsed);
  for (let i = 0; i < nUsed; i++) {
    const t = start + i;            // index into dy
    yReg[i] = dy[t];                 // Δy_t
    const row: number[] = [1, y[t]]; // y[t] is y_{t} which equals y_{(t-1)+1} ... but careful:
    // dy index t corresponds to Δy_{t+1} since dy[i] = y[i+1] - y[i].
    // So Δy at "calendar time t+1" uses regressor y_{t} = y[t]. That's what row[1] is. ✓
    for (let j = 1; j <= lag; j++) row.push(dy[t - j]);
    X[i] = row;
  }

  const fit = olsMulti(yReg, X);
  // gamma is coefficient on y_{t-1}, which is column index 1.
  const gamma = fit.coef[1];
  const tStat = fit.tStats[1];

  const cv1 = mackinnonCV("0.01", nUsed);
  const cv5 = mackinnonCV("0.05", nUsed);
  const cv10 = mackinnonCV("0.10", nUsed);

  // Crude monotone p-value: piecewise linear in (tStat → quantile).
  // tStat < CV1% ⇒ p<0.01; between CV5% and CV1% interpolate; etc.
  let p: number;
  if (tStat <= cv1) p = 0.005;
  else if (tStat <= cv5) p = 0.01 + ((tStat - cv1) / (cv5 - cv1)) * (0.05 - 0.01);
  else if (tStat <= cv10) p = 0.05 + ((tStat - cv5) / (cv10 - cv5)) * (0.10 - 0.05);
  else p = Math.min(0.99, 0.10 + (tStat - cv10) * 0.10);
  if (!Number.isFinite(p)) p = 1;

  return {
    tStat,
    lag,
    nUsed,
    criticalValues: { "1%": cv1, "5%": cv5, "10%": cv10 },
    pValueApprox: p,
    isStationary5: tStat < cv5,
    isStationary1: tStat < cv1,
    gamma,
  };
}

// Rolling ADF on a window. Useful for breakdown filters.
export function rollingAdf(y: number[], window: number, lag = 1): { tStat: (number | null)[]; pVal: (number | null)[] } {
  const n = y.length;
  const tStat: (number | null)[] = new Array(n).fill(null);
  const pVal: (number | null)[] = new Array(n).fill(null);
  if (window < 30 || window > n) return { tStat, pVal };
  for (let i = window - 1; i < n; i++) {
    try {
      const slice = y.slice(i - window + 1, i + 1);
      const r = adfTest(slice, lag);
      tStat[i] = r.tStat;
      pVal[i] = r.pValueApprox;
    } catch {
      tStat[i] = null;
      pVal[i] = null;
    }
  }
  return { tStat, pVal };
}
