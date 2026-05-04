// Avellaneda & Lee (2010) — single-factor s-score, simplified for the synthetic
// universe in this Lab.
//
// Their full procedure decomposes a cross-section of equities into PCA factors,
// runs a per-stock regression of returns on those factors, accumulates the
// residuals into an OU-like process, and trades the s-score
//
//   s_t = (X_t − μ) / σ ,
//
// where X_t is the cumulative residual and (μ, σ) come from fitting a
// continuous OU process. With our 2-asset pair we use a single factor (the
// market) and run the procedure on the spread A − β·B directly: an OU fit
// gives an equilibrium mean and dispersion, the s-score is the standardised
// distance from equilibrium, and trades open at |s| ≥ s_open and close at
// |s| ≤ s_close.

import { ols } from "../math/ols";
import { fitOu } from "../math/ou";
import { sharpe, std, mean, cagr, maxDrawdown, TRADING_DAYS } from "../math/stats";
import type { PairData } from "../data/synthetic";

export interface SScoreParams {
  sOpen: number;            // open position when |s| ≥ sOpen, default 1.25 (Avellaneda & Lee)
  sClose: number;           // close when |s| ≤ sClose, default 0.5
  sStop: number;            // stop loss
  oneWayCostBps: number;
  slippageBps: number;
  capitalAtRiskFraction: number;
}

export const DEFAULT_SSCORE: SScoreParams = {
  sOpen: 1.25,
  sClose: 0.5,
  sStop: 4.0,
  oneWayCostBps: 2,
  slippageBps: 1,
  capitalAtRiskFraction: 1,
};

export interface SScoreResult {
  params: SScoreParams;
  spread: number[];
  s: number[];                  // s-score series
  ouMu: number;
  ouSigma: number;
  dailyReturn: number[];
  equity: number[];
  metrics: {
    sharpe: number;
    cagr: number;
    maxDrawdown: number;
    totalReturn: number;
    nTrades: number;
    hitRate: number;
    avgHoldingBars: number;
  };
}

export function runSScoreBacktest(pair: PairData, paramsIn: Partial<SScoreParams> = {}): SScoreResult {
  const params: SScoreParams = { ...DEFAULT_SSCORE, ...paramsIn };
  const lpA = pair.a.prices.map(Math.log);
  const lpB = pair.b.prices.map(Math.log);
  const fit = ols(lpA, lpB);
  const spread = lpA.map((v, i) => v - fit.beta * lpB[i]);

  const fillCost = (2 * (params.oneWayCostBps + params.slippageBps)) / 10000 * params.capitalAtRiskFraction;

  // Fit OU on the first half of the sample to establish (μ, σ_OU). After that
  // we hold those parameters fixed, mimicking Avellaneda's approach where the
  // stationary distribution is estimated on a 60-day rolling basis. We use
  // half-sample for stability on the synthetic data.
  const fitN = Math.floor(spread.length / 2);
  const ou = fitOu(spread.slice(0, fitN));
  const ouMu = ou.mu;
  const ouSigma = ou.sigmaOu;
  const s = spread.map((v) => (ouSigma > 0 ? (v - ouMu) / ouSigma : 0));

  const n = spread.length;
  const dailyRet: number[] = new Array(n).fill(0);
  let state: 0 | 1 | -1 = 0;
  let entryIdx = -1;
  let nTrades = 0;
  let nWins = 0;
  let totalBars = 0;
  let lastRunPnl = 0;

  for (let t = 1; t < n; t++) {
    const sCur = s[t];

    // Bar return for held position.
    let r = 0;
    if (state !== 0) {
      const rA = pair.a.prices[t] / pair.a.prices[t - 1] - 1;
      const rB = pair.b.prices[t] / pair.b.prices[t - 1] - 1;
      r = params.capitalAtRiskFraction * 0.5 * state * (rA - rB);
    }

    // Action.
    let opening = false;
    let closing: "exit" | "stop" | null = null;
    if (state === 0) {
      if (sCur <= -params.sOpen) { state = 1; opening = true; }
      else if (sCur >= params.sOpen) { state = -1; opening = true; }
    } else {
      // close when sign-respecting return through close-band, or stop-loss
      if (state === 1 && sCur >= -params.sClose) closing = "exit";
      else if (state === -1 && sCur <= params.sClose) closing = "exit";
      else if (state === 1 && sCur <= -params.sStop) closing = "stop";
      else if (state === -1 && sCur >= params.sStop) closing = "stop";
    }

    if (opening) {
      r -= fillCost;
      entryIdx = t;
      lastRunPnl = -fillCost;
    }
    if (closing) {
      r -= fillCost;
      lastRunPnl += r;            // accumulate exit-bar return + cost
      // Close out: book the trade's net P&L.
      if (entryIdx >= 0) {
        nTrades++;
        totalBars += t - entryIdx;
        if (lastRunPnl > 0) nWins++;
      }
      state = 0;
      entryIdx = -1;
      lastRunPnl = 0;
    } else if (state !== 0) {
      lastRunPnl += r;
    }

    dailyRet[t] = r;
  }
  if (state !== 0 && entryIdx >= 0) {
    dailyRet[n - 1] -= fillCost;
    lastRunPnl -= fillCost;
    nTrades++;
    totalBars += n - 1 - entryIdx;
    if (lastRunPnl > 0) nWins++;
  }

  let v = 1;
  const eq: number[] = new Array(n).fill(1);
  for (let t = 0; t < n; t++) { v *= 1 + dailyRet[t]; eq[t] = v; }

  return {
    params,
    spread, s, ouMu, ouSigma,
    dailyReturn: dailyRet,
    equity: eq,
    metrics: {
      sharpe: sharpe(dailyRet),
      cagr: cagr(eq),
      maxDrawdown: maxDrawdown(eq).mdd,
      totalReturn: eq[n - 1] - 1,
      nTrades,
      hitRate: nTrades > 0 ? nWins / nTrades : 0,
      avgHoldingBars: nTrades > 0 ? totalBars / nTrades : 0,
    },
  };
}

// Helpful descriptors for the UI.
export function describeSScoreOu(spread: number[]) {
  const m = mean(spread);
  const sd = std(spread);
  return { sampleMean: m, sampleStd: sd, periodsPerYear: TRADING_DAYS };
}
