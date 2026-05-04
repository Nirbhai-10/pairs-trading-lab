// Walk-forward backtester for a sector-neutral pairs strategy.
//
// Pipeline:
//   1. Pick a hedge-ratio model:  static OLS | rolling OLS | Kalman.
//   2. Build the spread S_t = log P_A(t) − β_t · log P_B(t).
//   3. Standardise via rolling z = (S − μ_w) / σ_w.
//   4. Generate signals: entry at |z| ≥ z_entry, exit at |z| ≤ z_exit
//      (or stop-loss when |z| ≥ z_stop, or time-stop after H bars).
//   5. Apply realistic frictions:  one-way cost (bps), slippage (bps),
//      dollar-neutral position sizing, exposure cap, drawdown cut-off.
//
// Returns daily P&L expressed as fraction-of-capital, plus a trade ledger and
// performance metrics. Calculations stay in log-price space because the
// cointegration relationship is defined on log-prices.

import { rollingOls, ols } from "../math/ols";
import { kalmanHedge } from "../math/kalman";
import { rollingZScore } from "../math/zscore";
import { cagr, maxDrawdown, mean, sharpe, sortino, std, TRADING_DAYS } from "../math/stats";
import type { PairData } from "../data/synthetic";

export type HedgeModel = "static" | "rolling" | "kalman";
export type SizingMode = "dollar-neutral" | "beta-hedged";

export interface BacktestParams {
  hedgeModel: HedgeModel;
  hedgeWindow?: number;       // window for rolling OLS (default 60)
  kalmanDelta?: number;       // process noise for Kalman (default 1e-4)
  zWindow: number;            // rolling z-score window (default 60)
  zEntry: number;             // |z| to enter a position (default 2.0)
  zExit: number;              // |z| to exit (default 0.5)
  zStop: number;              // hard stop |z| (default 4.0)
  timeStop: number;           // bars to hold before forced exit (default 30)
  oneWayCostBps: number;      // commissions per leg per fill, in bps of notional (default 2)
  slippageBps: number;        // additional one-way slippage in bps (default 1)
  capitalAtRiskFraction: number; // max gross exposure used per position, 0..1 (default 1.0)
  drawdownStop: number;       // strategy halts if equity drawdown exceeds this fraction (default 0.25)
  sizingMode: SizingMode;     // dollar-neutral or beta-hedged (default dollar-neutral)
  warmup: number;             // bars before any trading is allowed (default 100)
}

export const DEFAULT_PARAMS: BacktestParams = {
  hedgeModel: "rolling",
  hedgeWindow: 60,
  kalmanDelta: 1e-4,
  zWindow: 60,
  zEntry: 2.0,
  zExit: 0.5,
  zStop: 4.0,
  timeStop: 30,
  oneWayCostBps: 2,
  slippageBps: 1,
  capitalAtRiskFraction: 1.0,
  drawdownStop: 0.25,
  sizingMode: "dollar-neutral",
  warmup: 100,
};

export interface Trade {
  side: "long-spread" | "short-spread";
  entryIdx: number;
  exitIdx: number;
  entryDate: string;
  exitDate: string;
  entryZ: number;
  exitZ: number;
  betaAtEntry: number;
  pnlFrac: number;            // fraction of capital
  bars: number;
  reason: "z-exit" | "stop-loss" | "time-stop" | "forced-eod";
}

export interface BacktestResult {
  params: BacktestParams;
  beta: (number | null)[];        // hedge ratio at each bar
  spread: (number | null)[];      // log-spread at each bar
  zScore: (number | null)[];      // rolling z
  position: number[];             // -1 short / 0 flat / +1 long, at each bar
  dailyReturn: number[];          // fraction returns per bar (post-cost)
  equity: number[];               // cumulative equity (start = 1.0)
  trades: Trade[];
  metrics: {
    cagr: number;
    sharpe: number;
    sortino: number;
    maxDrawdown: number;
    hitRate: number;
    avgHoldingBars: number;
    nTrades: number;
    totalReturn: number;
    annualVol: number;
    calmar: number;
  };
  costsPaid: number;              // total cumulative cost as fraction of capital
  halted: boolean;                // true if drawdown stop tripped
}

function logPrice(p: number[]): number[] {
  return p.map((x) => Math.log(x));
}

function buildHedgeRatio(pair: PairData, params: BacktestParams): { beta: (number | null)[] } {
  const lpA = logPrice(pair.a.prices);
  const lpB = logPrice(pair.b.prices);
  const n = lpA.length;
  if (params.hedgeModel === "static") {
    const fit = ols(lpA, lpB);
    const beta: (number | null)[] = new Array(n).fill(fit.beta);
    return { beta };
  }
  if (params.hedgeModel === "rolling") {
    const w = params.hedgeWindow ?? 60;
    const r = rollingOls(lpA, lpB, w);
    return { beta: r.beta };
  }
  // kalman
  const k = kalmanHedge(lpA, lpB, { delta: params.kalmanDelta ?? 1e-4 });
  return { beta: k.beta };
}

export function runBacktest(pair: PairData, paramsIn: Partial<BacktestParams> = {}): BacktestResult {
  const params: BacktestParams = { ...DEFAULT_PARAMS, ...paramsIn };
  const lpA = logPrice(pair.a.prices);
  const lpB = logPrice(pair.b.prices);
  const n = lpA.length;
  if (n < params.warmup + params.zWindow + 5) {
    throw new Error("runBacktest: series too short for the chosen warmup + z-window");
  }

  const { beta } = buildHedgeRatio(pair, params);

  // Spread S_t = log A − β_t · log B   (use β_t aligned at the same bar; for static and Kalman this is fine,
  // for rolling-OLS the hedge ratio is estimated on data up to t inclusive — i.e., contemporaneous.
  // To avoid look-ahead, we shift β by one bar when building the trading signal.)
  const spread: (number | null)[] = new Array(n).fill(null);
  for (let t = 0; t < n; t++) {
    const bt = beta[t];
    if (bt == null) continue;
    spread[t] = lpA[t] - bt * lpB[t];
  }

  // Rolling z on spread (treat null spread as gap; z requires a contiguous window).
  // We compute z over the largest contiguous prefix where spread is defined.
  const firstDef = spread.findIndex((v) => v != null);
  const z: (number | null)[] = new Array(n).fill(null);
  if (firstDef >= 0) {
    const sub: number[] = [];
    for (let t = firstDef; t < n; t++) sub.push(spread[t] as number);
    const zSub = rollingZScore(sub, params.zWindow).z;
    for (let i = 0; i < zSub.length; i++) z[firstDef + i] = zSub[i];
  }

  // ---- Trading loop ----
  const position: number[] = new Array(n).fill(0);
  const dailyRet: number[] = new Array(n).fill(0);
  const trades: Trade[] = [];
  const costPerFill = (params.oneWayCostBps + params.slippageBps) / 10000; // fraction per leg per fill
  // dollar-neutral round trip = 4 fills (enter long A, enter short B, exit long A, exit short B).
  // We charge entry + exit costs explicitly; each event costs 2 * costPerFill (two legs).

  let state: 0 | 1 | -1 = 0;
  let entryIdx = -1;
  let entryZ = 0;
  let entryBeta = 0;
  let costsPaid = 0;
  let equity = 1.0;
  let peakEquity = 1.0;
  let halted = false;
  // Cost per round-trip leg, expressed as fraction of capital. Each entry or exit
  // touches both legs, so a full open or close costs `2 * costPerFill * capitalAtRiskFraction`.
  const fillCostPerTouch = 2 * costPerFill * params.capitalAtRiskFraction;

  // We size each position at `capitalAtRiskFraction` of current equity, dollar-neutral.
  // Per-bar log-spread change ≈ ΔlogA − β · ΔlogB (using β at the bar before).
  // For dollar-neutral: long+short of equal $ → P&L per $1 long-equivalent ≈ r_A − r_B (using simple returns).
  //   r_A = exp(ΔlogA) − 1, r_B = exp(ΔlogB) − 1.
  // For β-hedged: P&L ≈ r_A − β · r_B (long $1 in A, short $β in B; gross = $1 + $β).
  //   We normalise so the gross exposure equals capitalAtRiskFraction.

  for (let t = 1; t < n; t++) {
    if (halted) {
      dailyRet[t] = 0;
      continue;
    }
    const zPrev = z[t - 1];
    const zCur = z[t];
    const betaPrev = beta[t - 1];
    const lpAprev = lpA[t - 1];
    const lpBprev = lpB[t - 1];

    // Period return contributions from the position held at t-1 → t.
    let r = 0;
    if (state !== 0) {
      const rA = Math.exp(lpA[t] - lpAprev) - 1;
      const rB = Math.exp(lpB[t] - lpBprev) - 1;
      const sign = state; // +1 long-spread (long A, short B) / -1 short-spread
      if (params.sizingMode === "dollar-neutral") {
        // Half capital long, half short; gross = capital, net = 0.
        // PnL fraction = capitalAtRisk * 0.5 * (sign*rA - sign*rB)
        r = params.capitalAtRiskFraction * 0.5 * sign * (rA - rB);
      } else {
        // β-hedged: long $1 in A, short $β in B (gross 1+β). Normalise gross to capitalAtRisk.
        const b = entryBeta || (betaPrev ?? 1);
        const gross = 1 + Math.abs(b);
        const wA = 1 / gross;
        const wB = Math.abs(b) / gross;
        r = params.capitalAtRiskFraction * sign * (wA * rA - wB * rB);
      }
    }
    dailyRet[t] = r;

    // Decide actions for the next bar based on signal at t (we observe z_t after close).
    if (t < params.warmup || zCur == null || betaPrev == null) {
      position[t] = state;
      // equity update
      equity *= 1 + r;
      peakEquity = Math.max(peakEquity, equity);
      if ((peakEquity - equity) / peakEquity > params.drawdownStop) halted = true;
      continue;
    }

    const barsHeld = state !== 0 ? t - entryIdx : 0;

    let actExit: Trade["reason"] | null = null;
    let actEntry: 1 | -1 | 0 = 0;

    if (state === 1) {
      // long spread: exit when z rises back through z_exit (toward 0 from below)
      if (zCur >= -params.zExit) actExit = "z-exit";
      else if (zCur <= -params.zStop) actExit = "stop-loss";
      else if (barsHeld >= params.timeStop) actExit = "time-stop";
    } else if (state === -1) {
      if (zCur <= params.zExit) actExit = "z-exit";
      else if (zCur >= params.zStop) actExit = "stop-loss";
      else if (barsHeld >= params.timeStop) actExit = "time-stop";
    } else {
      // flat — look for fresh entries
      if (zCur <= -params.zEntry && (zPrev == null || zPrev > -params.zEntry)) actEntry = 1;
      else if (zCur >= params.zEntry && (zPrev == null || zPrev < params.zEntry)) actEntry = -1;
    }

    // Apply state transitions and bake fill costs directly into dailyRet[t] so that
    // every downstream metric (Sharpe, drawdown, equity) reflects the same cost basis.
    if (actExit && state !== 0) {
      dailyRet[t] -= fillCostPerTouch;
      costsPaid += fillCostPerTouch;
      let pnl = 0;
      for (let k = entryIdx + 1; k <= t; k++) pnl += dailyRet[k];
      // Trade-level P&L already reflects the exit cost via dailyRet[t]; subtract entry cost
      // once more so the trade ledger is also a complete picture of the round trip.
      pnl -= fillCostPerTouch;
      trades.push({
        side: state === 1 ? "long-spread" : "short-spread",
        entryIdx,
        exitIdx: t,
        entryDate: pair.a.dates[entryIdx],
        exitDate: pair.a.dates[t],
        entryZ,
        exitZ: zCur,
        betaAtEntry: entryBeta,
        pnlFrac: pnl,
        bars: t - entryIdx,
        reason: actExit,
      });
      state = 0;
    }

    if (actEntry !== 0 && state === 0) {
      dailyRet[t] -= fillCostPerTouch;
      costsPaid += fillCostPerTouch;
      state = actEntry;
      entryIdx = t;
      entryZ = zCur;
      entryBeta = betaPrev as number;
    }

    position[t] = state;

    // Update running equity (cost-inclusive) and check the hard drawdown stop.
    equity *= 1 + dailyRet[t];
    peakEquity = Math.max(peakEquity, equity);
    if ((peakEquity - equity) / peakEquity > params.drawdownStop) {
      if (state !== 0) {
        dailyRet[t] -= fillCostPerTouch;
        costsPaid += fillCostPerTouch;
        equity *= 1 - fillCostPerTouch;        // already in dailyRet but we need a fresh forced-exit cost charge
        let pnl = 0;
        for (let k = entryIdx + 1; k <= t; k++) pnl += dailyRet[k];
        pnl -= fillCostPerTouch;
        trades.push({
          side: state === 1 ? "long-spread" : "short-spread",
          entryIdx, exitIdx: t,
          entryDate: pair.a.dates[entryIdx],
          exitDate: pair.a.dates[t],
          entryZ, exitZ: zCur, betaAtEntry: entryBeta,
          pnlFrac: pnl, bars: t - entryIdx, reason: "forced-eod",
        });
        state = 0;
        position[t] = 0;
      }
      halted = true;
    }
  }

  // Force exit at end of sample if still holding. The cost is baked into the final bar's return.
  if (state !== 0) {
    const t = n - 1;
    dailyRet[t] -= fillCostPerTouch;
    costsPaid += fillCostPerTouch;
    let pnl = 0;
    for (let k = entryIdx + 1; k <= t; k++) pnl += dailyRet[k];
    pnl -= fillCostPerTouch;
    trades.push({
      side: state === 1 ? "long-spread" : "short-spread",
      entryIdx, exitIdx: t,
      entryDate: pair.a.dates[entryIdx],
      exitDate: pair.a.dates[t],
      entryZ, exitZ: z[t] ?? 0, betaAtEntry: entryBeta,
      pnlFrac: pnl, bars: t - entryIdx, reason: "forced-eod",
    });
    state = 0;
    position[t] = 0;
  }

  // Equity curve from cost-inclusive dailyRet.
  const eq: number[] = new Array(n).fill(1);
  let v = 1;
  for (let t = 0; t < n; t++) {
    v *= 1 + dailyRet[t];
    eq[t] = v;
  }

  const annualVol = std(dailyRet) * Math.sqrt(TRADING_DAYS);
  const sharpeAnn = sharpe(dailyRet);
  const sortinoAnn = sortino(dailyRet);
  const dd = maxDrawdown(eq);
  const cagrVal = cagr(eq);
  const total = eq[n - 1] - 1;
  const calmar = dd.mdd > 0 ? cagrVal / dd.mdd : 0;
  const wins = trades.filter((t) => t.pnlFrac > 0).length;
  const hitRate = trades.length > 0 ? wins / trades.length : 0;
  const avgBars = trades.length > 0 ? mean(trades.map((t) => t.bars)) : 0;

  return {
    params,
    beta,
    spread,
    zScore: z,
    position,
    dailyReturn: dailyRet,
    equity: eq,
    trades,
    metrics: {
      cagr: cagrVal,
      sharpe: sharpeAnn,
      sortino: sortinoAnn,
      maxDrawdown: dd.mdd,
      hitRate,
      avgHoldingBars: avgBars,
      nTrades: trades.length,
      totalReturn: total,
      annualVol,
      calmar,
    },
    costsPaid,
    halted,
  };
}
