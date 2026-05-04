// Ornstein-Uhlenbeck mean-reversion fit on a stationary spread series.
//
// Continuous-time:  dX_t = θ (μ - X_t) dt + σ dW_t
// Discretised AR(1) at unit step:  X_t = X_{t-1} + θ (μ - X_{t-1}) + ε_t
// or equivalently:  ΔX_t = a + b X_{t-1} + ε_t,  where b = -θ, a = θ μ.
// Half-life of mean reversion:  t_½ = ln(2) / θ = -ln(2) / b   (per period).
//
// References: Vasicek (1977) for the SDE; Bertram (2010) "Analytic solutions
// for optimal statistical arbitrage trading" gives optimal entry/exit
// thresholds for an OU process under a fixed cost.

import { ols } from "./ols";

export interface OuFit {
  theta: number;        // mean-reversion speed (per period); positive ⇒ mean-reverting
  mu: number;           // long-run mean
  sigmaEps: number;     // residual std of the AR(1) regression
  sigmaOu: number;      // implied OU diffusion: σ = sigmaEps / sqrt((1 - exp(-2θ)) / (2θ))
                        //                       ≈ sigmaEps for small θ; falls back to sigmaEps if θ ≤ 0
  halfLife: number | null; // periods until expected gap halves; null if not mean-reverting
  rSquared: number;
}

export function fitOu(spread: number[]): OuFit {
  if (spread.length < 30) throw new Error("fitOu: need at least 30 observations");
  const x = spread.slice(0, -1);   // X_{t-1}
  const dy: number[] = new Array(x.length);
  for (let i = 0; i < x.length; i++) dy[i] = spread[i + 1] - spread[i];
  const fit = ols(dy, x);
  const a = fit.alpha;
  const b = fit.beta;
  const theta = -b;
  const mu = theta !== 0 ? a / theta : 0;
  const sigmaEps = Math.sqrt(fit.sigma2);
  let sigmaOu = sigmaEps;
  if (theta > 0) {
    const f = (1 - Math.exp(-2 * theta)) / (2 * theta);
    if (f > 0) sigmaOu = sigmaEps / Math.sqrt(f);
  }
  const halfLife = b < 0 ? -Math.log(2) / b : null;
  return { theta, mu, sigmaEps, sigmaOu, halfLife, rSquared: fit.rSquared };
}

// Bertram (2010) optimal entry/exit thresholds (in standardised units a = (X-μ)/σ_ou).
// Without transaction costs, the symmetric profit-maximising entry is roughly ±0.75 σ
// for an OU spread observed at high frequency, but at daily frequency with realistic
// costs the optimal entry is closer to ±1.5..2.0 σ. We compute Bertram's closed-form
// approximation here for educational display, not for fine optimisation.
//
// Optimal trading band (a* = entry, m* = exit, symmetric around the mean) maximises
// expected profit per unit time minus cost. We provide a numerical scan instead of
// the special-function approach for clarity.
export function bertramOptimalBand(theta: number, sigmaOu: number, costFraction = 0.0): { entry: number; exit: number; expProfit: number } {
  // expected first-passage time from -a to +a for OU centred at 0 is given by
  // Erfi-based formula; numeric grid suffices for our display.
  // Heuristic: scan entry a∈[0.5, 3.0]σ, exit at -entry; profit/time ∝ (2a - cost) / E[T(a)].
  if (theta <= 0) return { entry: NaN, exit: NaN, expProfit: NaN };
  const tau = 1 / theta;
  let best = { entry: 1.5, exit: -1.5, expProfit: -Infinity };
  for (let aGrid = 0.25; aGrid <= 3.0; aGrid += 0.05) {
    // Approx: expected time between hits of ±a for OU started at 0 ≈ τ · (e^{a²/2} - 1)
    // (a coarse approximation; serves for ordering only).
    const eT = tau * (Math.exp((aGrid * aGrid) / 2) - 1);
    if (eT <= 0) continue;
    const profit = (2 * aGrid * sigmaOu - costFraction) / eT;
    if (profit > best.expProfit) best = { entry: aGrid, exit: -aGrid, expProfit: profit };
  }
  return best;
}
