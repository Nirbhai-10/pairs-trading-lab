// KPSS test — Kwiatkowski, Phillips, Schmidt & Shin (1992).
// Null: series is (level- or trend-) stationary. Alternative: unit root.
// Complementary to ADF, which has the opposite null.
//
//   η = T^{-2} ∑ S_t^2  /  σ̂²_∞,
//   S_t = ∑_{j=1..t} ê_j   (cumulative demeaned residual)
//
// Long-run variance σ̂²_∞ is estimated with a Newey-West kernel.
// Asymptotic critical values: 1% = 0.739, 5% = 0.463, 10% = 0.347 (level case).

import { mean } from "./stats";

export interface KpssResult {
  stat: number;
  longRunVar: number;
  reject5: boolean;
  reject1: boolean;
  pValueApprox: number;
  bandwidth: number;
}

export function kpssTest(y: number[], type: "level" | "trend" = "level"): KpssResult {
  const T = y.length;
  if (T < 12) throw new Error("kpssTest: series too short");
  // Residuals from a regression on a constant (level) or constant + trend.
  let resid: number[];
  if (type === "level") {
    const m = mean(y);
    resid = y.map((v) => v - m);
  } else {
    // OLS on (1, t)
    const t = Array.from({ length: T }, (_, i) => i + 1);
    const tMean = (T + 1) / 2;
    let sxx = 0, sxy = 0;
    const yMean = mean(y);
    for (let i = 0; i < T; i++) {
      sxx += (t[i] - tMean) * (t[i] - tMean);
      sxy += (t[i] - tMean) * (y[i] - yMean);
    }
    const slope = sxx === 0 ? 0 : sxy / sxx;
    const intercept = yMean - slope * tMean;
    resid = y.map((v, i) => v - intercept - slope * t[i]);
  }

  // Newey-West long-run variance with Andrews (1991) automatic bandwidth ≈ floor(4*(T/100)^{2/9}).
  const l = Math.max(1, Math.floor(4 * Math.pow(T / 100, 2 / 9)));
  let s2 = 0;
  for (let i = 0; i < T; i++) s2 += resid[i] * resid[i];
  s2 /= T;
  for (let h = 1; h <= l; h++) {
    let g = 0;
    for (let i = h; i < T; i++) g += resid[i] * resid[i - h];
    g /= T;
    const w = 1 - h / (l + 1);
    s2 += 2 * w * g;
  }

  // Cumulative partial sum.
  let cum = 0;
  let stat = 0;
  for (let i = 0; i < T; i++) {
    cum += resid[i];
    stat += cum * cum;
  }
  stat /= T * T;
  stat /= s2 > 0 ? s2 : 1;

  const cv1 = type === "level" ? 0.739 : 0.216;
  const cv5 = type === "level" ? 0.463 : 0.146;
  const cv10 = type === "level" ? 0.347 : 0.119;

  let p: number;
  if (stat >= cv1) p = 0.005;
  else if (stat >= cv5) p = 0.05 - ((stat - cv5) / (cv1 - cv5)) * (0.05 - 0.01);
  else if (stat >= cv10) p = 0.10 - ((stat - cv10) / (cv5 - cv10)) * (0.10 - 0.05);
  else p = Math.min(0.99, 0.10 + (cv10 - stat));
  if (!Number.isFinite(p)) p = 1;

  return {
    stat,
    longRunVar: s2,
    reject5: stat > cv5,
    reject1: stat > cv1,
    pValueApprox: p,
    bandwidth: l,
  };
}
