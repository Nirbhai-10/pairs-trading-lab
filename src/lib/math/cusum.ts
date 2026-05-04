// Brown-Durbin-Evans (1975) CUSUM test for parameter stability.
//
// Given a regression model y_t = X_t' β + ε_t fit by OLS, the recursive
// residuals are
//   w_t = (y_t − X_t' β̂_{t−1}) / sqrt(1 + X_t'(X_{t−1}'X_{t−1})^{−1}X_t),
// scaled to be iid N(0, σ^2) under the null of constant β. The CUSUM is
//   W_t = (1 / σ̂) ∑_{j=k+1}^{t} w_j,
// which under H0 behaves like Brownian motion. Confidence bands at the
// 5% level are ±a · sqrt(T − k) at t = T, with a ≈ 0.948, expanding linearly.
// We provide a simplified univariate variant on the spread itself: recursive
// mean residuals, since the Pair Lab spreads are already de-trended via the
// hedge ratio. This matches the standard "CUSUM of mean shifts" diagnostic.

import { mean, std } from "./stats";

export interface CusumResult {
  cusum: number[];                // running CUSUM statistic
  upperBand: number[];            // 5% upper band at t
  lowerBand: number[];
  breached: boolean;
  firstBreach: number | null;     // index where the band was first crossed (null = never)
}

export function cusumOfMeans(y: number[], aLevel = 0.948): CusumResult {
  const T = y.length;
  if (T < 10) throw new Error("cusumOfMeans: need ≥ 10 observations");
  const m = mean(y);
  const sd = std(y);
  if (sd === 0) {
    return { cusum: new Array(T).fill(0), upperBand: new Array(T).fill(0), lowerBand: new Array(T).fill(0), breached: false, firstBreach: null };
  }
  const cusum = new Array<number>(T).fill(0);
  let s = 0;
  for (let i = 0; i < T; i++) {
    s += (y[i] - m) / sd;
    cusum[i] = s;
  }
  // Bands: ±a · sqrt(T) at t=T, ±a · t / sqrt(T) at intermediate t (linear expansion form).
  const upper = new Array<number>(T).fill(0);
  const lower = new Array<number>(T).fill(0);
  let breached = false;
  let firstBreach: number | null = null;
  for (let t = 0; t < T; t++) {
    // Brown-Durbin-Evans 1975: bands are ±[ a√T + 2a t / √T ] expanding linearly.
    // For visual simplicity we use ±a · √T · (t / T) — matches the textbook representation.
    const bound = aLevel * Math.sqrt(T) + 2 * aLevel * (t + 1) / Math.sqrt(T);
    upper[t] = bound;
    lower[t] = -bound;
    if (cusum[t] > bound || cusum[t] < -bound) {
      if (!breached) { breached = true; firstBreach = t; }
    }
  }
  return { cusum, upperBand: upper, lowerBand: lower, breached, firstBreach };
}
