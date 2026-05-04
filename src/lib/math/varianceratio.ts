// Variance-ratio test — Lo & MacKinlay (1988).
//
// Tests the random-walk null using the ratio
//   VR(q) = Var( r_t + r_{t-1} + ... + r_{t-q+1} ) / ( q · Var(r_t) ).
// Under a random walk, VR(q) → 1.  VR < 1 ⇒ mean reversion (negative
// serial correlation), VR > 1 ⇒ momentum.
//
// We report the heteroskedasticity-robust z-statistic (Lo-MacKinlay's z*),
// which is asymptotically standard normal under H0.

import { mean } from "./stats";

export interface VrResult {
  q: number;
  vr: number;
  z: number;            // heteroskedasticity-robust z (z*)
  pValueTwoSided: number;
}

function normalCdf(x: number): number {
  // Abramowitz & Stegun 7.1.26 polynomial approximation to erf.
  const sign = x < 0 ? -1 : 1;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * ax);
  const erfA = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return 0.5 * (1 + sign * erfA);
}

// y is a return-like series (or log-price differences). q ≥ 2.
export function varianceRatio(y: number[], q: number): VrResult {
  const n = y.length;
  if (q < 2) throw new Error("varianceRatio: q must be ≥ 2");
  if (n < 4 * q) throw new Error("varianceRatio: series too short for the chosen q");
  const mu = mean(y);
  // sigma_a^2 — variance of single-period returns (unbiased).
  let sumA = 0;
  for (let i = 0; i < n; i++) {
    const d = y[i] - mu;
    sumA += d * d;
  }
  const sigA2 = sumA / (n - 1);
  // sigma_b^2 — variance of q-period overlapping returns / q (Lo-MacKinlay form).
  // m = q · (n - q + 1) · (1 − q/n)  (used to make estimator unbiased)
  const m = q * (n - q + 1) * (1 - q / n);
  let sumB = 0;
  for (let k = q - 1; k < n; k++) {
    let s = 0;
    for (let j = 0; j < q; j++) s += y[k - j];
    s -= q * mu;
    sumB += s * s;
  }
  const sigB2 = sumB / m;
  const vr = sigB2 / sigA2;

  // Heteroskedasticity-robust variance Lo & MacKinlay (1988):  θ̂(q) = Σ_{j=1..q-1} [2(q−j)/q]^2 · δ̂(j),
  //   δ̂(j) = Σ (y_t−µ)^2 (y_{t−j}−µ)^2 / [Σ (y_t−µ)^2]^2
  let theta = 0;
  for (let j = 1; j < q; j++) {
    let num = 0;
    for (let t = j; t < n; t++) num += Math.pow(y[t] - mu, 2) * Math.pow(y[t - j] - mu, 2);
    const denom = Math.pow(sumA, 2);
    const delta = denom > 0 ? num / denom : 0;
    theta += Math.pow((2 * (q - j)) / q, 2) * delta;
  }
  const z = theta > 0 ? (vr - 1) / Math.sqrt(theta / n) : 0;
  const pTwo = 2 * (1 - normalCdf(Math.abs(z)));

  return { q, vr, z, pValueTwoSided: Math.min(1, pTwo) };
}

// Run the test at multiple horizons in one go.
export function varianceRatioProfile(y: number[], qs: number[] = [2, 4, 8, 16, 32]): VrResult[] {
  return qs
    .filter((q) => y.length >= 4 * q)
    .map((q) => varianceRatio(y, q));
}
