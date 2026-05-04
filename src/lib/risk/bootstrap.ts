// Politis & Romano (1994) stationary bootstrap.
//
// Given a return series, draw resamples of equal length where each block
// length is geometric with mean 1/p. Geometric block lengths preserve the
// strong-mixing property of the original series, giving honest standard
// errors for serially-correlated statistics (Sharpe, Sortino, max drawdown).
// We provide a Sharpe / total-return CI as the primary application.

import seedrandom from "seedrandom";
import { TRADING_DAYS, mean, std } from "../math/stats";

export interface BootstrapStats {
  median: number;
  ci90: [number, number];
  ci95: [number, number];
  samples: number[];
}

function annualSharpe(r: number[]): number {
  const m = mean(r);
  const s = std(r);
  if (s === 0) return 0;
  return (m / s) * Math.sqrt(TRADING_DAYS);
}

export function stationaryBootstrap(
  r: number[],
  numResamples = 500,
  meanBlockLen = 21,           // ≈ 1 month of daily bars
  seed = "pairs-trading-lab",
): { sharpe: BootstrapStats; totalReturn: BootstrapStats } {
  const rng = seedrandom(seed);
  const n = r.length;
  if (n < 60) {
    return {
      sharpe: { median: 0, ci90: [0, 0], ci95: [0, 0], samples: [] },
      totalReturn: { median: 0, ci90: [0, 0], ci95: [0, 0], samples: [] },
    };
  }
  const p = 1 / meanBlockLen;
  const sharpes: number[] = [];
  const totals: number[] = [];
  const buf: number[] = new Array(n);
  for (let s = 0; s < numResamples; s++) {
    let i = 0;
    while (i < n) {
      // Block start.
      let idx = Math.floor(rng() * n);
      // Geometric block length with parameter p.
      let len = 1;
      while (rng() > p) len++;
      for (let k = 0; k < len && i < n; k++) {
        buf[i++] = r[idx];
        idx = (idx + 1) % n;
      }
    }
    sharpes.push(annualSharpe(buf));
    let total = 1;
    for (let i2 = 0; i2 < n; i2++) total *= 1 + buf[i2];
    totals.push(total - 1);
  }
  const summarise = (arr: number[]): BootstrapStats => {
    const sorted = arr.slice().sort((a, b) => a - b);
    const q = (alpha: number) => {
      const i = Math.min(sorted.length - 1, Math.max(0, Math.floor(alpha * sorted.length)));
      return sorted[i];
    };
    return {
      median: q(0.5),
      ci90: [q(0.05), q(0.95)],
      ci95: [q(0.025), q(0.975)],
      samples: arr,
    };
  };
  return { sharpe: summarise(sharpes), totalReturn: summarise(totals) };
}
