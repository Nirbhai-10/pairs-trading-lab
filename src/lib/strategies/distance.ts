// Distance method — Gatev, Goetzmann & Rouwenhorst (2006).
//
// Original spec: 12-month formation window to normalise both prices to a
// common start and compute SSD; 6-month trading window where positions open
// when the normalised spread diverges by 2 σ_formation and close when the
// spread converges back to zero. We replicate this rolling: every test
// window uses the immediately preceding formation window as its training set.
//
// Notes
// ─────
//   • One position at a time per pair (no doubling).
//   • Sizing is dollar-neutral by construction.
//   • Costs and slippage are charged per leg per fill in bps.
//   • This is not the cointegration approach: there is no β, no ADF, no z-score.
//     Mean reversion is purely empirical from the formation window.

import { mean, std, TRADING_DAYS, sharpe, maxDrawdown, cagr } from "../math/stats";
import type { PairData } from "../data/synthetic";

export interface DistanceParams {
  formationBars: number;    // default 252 (≈ 12 months)
  tradingBars: number;      // default 126 (≈ 6 months)
  entryK: number;           // default 2 (open at ±k σ_formation)
  oneWayCostBps: number;
  slippageBps: number;
  capitalAtRiskFraction: number;
}

export const DEFAULT_DISTANCE: DistanceParams = {
  formationBars: 252,
  tradingBars: 126,
  entryK: 2,
  oneWayCostBps: 2,
  slippageBps: 1,
  capitalAtRiskFraction: 1,
};

export interface DistanceTrade {
  side: "long-A-short-B" | "short-A-long-B";
  entryIdx: number;
  exitIdx: number;
  entryDate: string;
  exitDate: string;
  pnlFrac: number;
  bars: number;
}

export interface DistanceResult {
  params: DistanceParams;
  dailyReturn: number[];
  equity: number[];
  trades: DistanceTrade[];
  metrics: {
    sharpe: number;
    cagr: number;
    maxDrawdown: number;
    totalReturn: number;
    nTrades: number;
    hitRate: number;
  };
}

export function runDistanceBacktest(pair: PairData, paramsIn: Partial<DistanceParams> = {}): DistanceResult {
  const params: DistanceParams = { ...DEFAULT_DISTANCE, ...paramsIn };
  const A = pair.a.prices;
  const B = pair.b.prices;
  const n = A.length;
  const dailyRet: number[] = new Array(n).fill(0);
  const trades: DistanceTrade[] = [];
  const fillCost = (2 * (params.oneWayCostBps + params.slippageBps)) / 10000 * params.capitalAtRiskFraction;

  let cursor = params.formationBars;
  while (cursor + params.tradingBars <= n) {
    const formStart = cursor - params.formationBars;
    const formEnd = cursor;        // exclusive end (i.e. last index in formation = cursor - 1)
    const tradeEnd = Math.min(n, cursor + params.tradingBars);

    const A0 = A[formStart];
    const B0 = B[formStart];
    if (A0 <= 0 || B0 <= 0) { cursor += params.tradingBars; continue; }

    // Normalised spread on formation window.
    const formSpread: number[] = [];
    for (let t = formStart; t < formEnd; t++) {
      formSpread.push(A[t] / A0 - B[t] / B0);
    }
    const sigma = std(formSpread);
    const m = mean(formSpread);
    if (sigma === 0) { cursor += params.tradingBars; continue; }

    // Trade through the test window.
    let state: 0 | 1 | -1 = 0;     // +1 = long-A short-B (when spread is below); -1 = opposite.
    let entryIdx = -1;
    for (let t = formEnd; t < tradeEnd; t++) {
      const dPrev = t > formEnd ? A[t - 1] / A0 - B[t - 1] / B0 : null;
      const dCur = A[t] / A0 - B[t] / B0;
      // Position return on the bar = sign(state) * 0.5 * (rA − rB), dollar-neutral.
      let r = 0;
      if (state !== 0) {
        const rA = A[t] / A[t - 1] - 1;
        const rB = B[t] / B[t - 1] - 1;
        r = params.capitalAtRiskFraction * 0.5 * state * (rA - rB);
      }

      // Decide actions on this bar.
      if (state === 0) {
        if (dCur < m - params.entryK * sigma) {
          state = 1; entryIdx = t; r -= fillCost;
        } else if (dCur > m + params.entryK * sigma) {
          state = -1; entryIdx = t; r -= fillCost;
        }
      } else {
        // Exit when crossing the formation mean.
        const cross =
          (state === 1 && dCur >= m && (dPrev == null || dPrev < m)) ||
          (state === -1 && dCur <= m && (dPrev == null || dPrev > m));
        if (cross || t === tradeEnd - 1) {
          // close
          let pnl = 0;
          for (let k = entryIdx + 1; k <= t; k++) pnl += dailyRet[k];
          // include exit cost (current bar) and entry cost
          r -= fillCost;
          pnl -= fillCost;
          pnl -= fillCost;
          trades.push({
            side: state === 1 ? "long-A-short-B" : "short-A-long-B",
            entryIdx,
            exitIdx: t,
            entryDate: pair.a.dates[entryIdx],
            exitDate: pair.a.dates[t],
            pnlFrac: pnl,
            bars: t - entryIdx,
          });
          state = 0;
        }
      }
      dailyRet[t] = r;
    }
    cursor += params.tradingBars;
  }

  let v = 1;
  const equity: number[] = new Array(n).fill(1);
  for (let t = 0; t < n; t++) { v *= 1 + dailyRet[t]; equity[t] = v; }
  const wins = trades.filter((t) => t.pnlFrac > 0).length;
  return {
    params,
    dailyReturn: dailyRet,
    equity,
    trades,
    metrics: {
      sharpe: sharpe(dailyRet),
      cagr: cagr(equity),
      maxDrawdown: maxDrawdown(equity).mdd,
      totalReturn: equity[n - 1] - 1,
      nTrades: trades.length,
      hitRate: trades.length > 0 ? wins / trades.length : 0,
    },
  };
}

// Annualisation helper that some UIs want to display.
export const DAYS_PER_YEAR = TRADING_DAYS;
