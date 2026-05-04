// Kalman filter for the time-varying hedge ratio used in pairs trading.
//
// Observation: y_t = α_t + β_t · x_t + v_t,                      v_t ~ N(0, R)
// State:       θ_t = [α_t, β_t]^T = θ_{t-1} + w_t,                w_t ~ N(0, Q)
//
// Two-state local-level model on (α, β). Q is typically a small diagonal matrix
// scaled by δ; R is the observation noise. This formulation is the standard
// presentation used in textbook pairs-trading treatments (e.g. Chan, "Algorithmic
// Trading: Winning Strategies and Their Rationale", 2013, ch. 3).

import { ols } from "./ols";

export interface KalmanOptions {
  delta?: number;     // process-noise scale: Q = (delta / (1 - delta)) * I scaled by initial variance, see below
  ve?: number;        // observation noise variance R; if undefined we use sample residual variance from OLS warm-up
  warmup?: number;    // warm-up window for initial OLS estimate of (α, β); default 30
}

export interface KalmanResult {
  alpha: number[];        // smoothed-forward α_t
  beta: number[];         // smoothed-forward β_t
  spread: number[];       // observed - predicted = innovation e_t
  predVar: number[];      // S_t (innovation variance)
  zScore: number[];       // e_t / sqrt(S_t) — natural standardisation under the model
}

export function kalmanHedge(y: number[], x: number[], opts: KalmanOptions = {}): KalmanResult {
  const n = Math.min(y.length, x.length);
  const warmup = opts.warmup ?? 30;
  if (n < warmup + 5) throw new Error(`kalmanHedge: series too short (n=${n}, warmup=${warmup})`);

  // Warm-up via static OLS on the first `warmup` points.
  const init = ols(y.slice(0, warmup), x.slice(0, warmup));
  const R = opts.ve ?? init.sigma2;        // observation noise variance
  const delta = opts.delta ?? 1e-4;        // process noise scale (per-period diffusion of α, β)
  // A small δ keeps β nearly constant; larger δ lets β adapt faster.
  const Q00 = delta;
  const Q11 = delta;

  // State estimate and covariance (2-state).
  let a = init.alpha;
  let b = init.beta;
  // Diffuse-ish initial covariance.
  let P00 = 1, P01 = 0, P10 = 0, P11 = 1;

  const alphaArr: number[] = new Array(n).fill(0);
  const betaArr: number[] = new Array(n).fill(0);
  const spread: number[] = new Array(n).fill(0);
  const predVar: number[] = new Array(n).fill(0);
  const zScore: number[] = new Array(n).fill(0);

  for (let t = 0; t < n; t++) {
    // Predict (random walk → state mean unchanged; covariance += Q).
    P00 += Q00;
    P11 += Q11;

    // Observation: F = [1, x_t].
    const xt = x[t];
    const yPred = a + b * xt;
    const e = y[t] - yPred;
    // S = F P F' + R = P00 + 2*xt*P01 + xt*xt*P11 + R
    const S = P00 + 2 * xt * P01 + xt * xt * P11 + R;
    // Kalman gain K = P F' / S = (1/S) [P00 + xt*P01, P10 + xt*P11]
    const K0 = (P00 + xt * P01) / S;
    const K1 = (P10 + xt * P11) / S;

    // Update state.
    a = a + K0 * e;
    b = b + K1 * e;

    // Update covariance: P = (I - K F) P
    // I - K F = [[1 - K0,        -K0*xt],
    //            [   -K1,    1 - K1*xt]]
    const IminusKF00 = 1 - K0;
    const IminusKF01 = -K0 * xt;
    const IminusKF10 = -K1;
    const IminusKF11 = 1 - K1 * xt;

    const newP00 = IminusKF00 * P00 + IminusKF01 * P10;
    const newP01 = IminusKF00 * P01 + IminusKF01 * P11;
    const newP10 = IminusKF10 * P00 + IminusKF11 * P10;
    const newP11 = IminusKF10 * P01 + IminusKF11 * P11;
    P00 = newP00; P01 = newP01; P10 = newP10; P11 = newP11;

    alphaArr[t] = a;
    betaArr[t] = b;
    spread[t] = e;
    predVar[t] = S;
    zScore[t] = S > 0 ? e / Math.sqrt(S) : 0;
  }

  return { alpha: alphaArr, beta: betaArr, spread, predVar, zScore };
}
