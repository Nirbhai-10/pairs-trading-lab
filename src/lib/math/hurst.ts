// Hurst exponent via Mandelbrot–Wallis R/S analysis.
//
// For each window length n, split the series into ⌊T/n⌋ non-overlapping
// chunks; rescale each chunk's range R by its sample standard deviation S.
// Average across chunks. Then H is the slope of log(R/S) on log(n):
//   E[R(n)/S(n)] ≈ c · n^H.
//
// Interpretation: H = 0.5 random walk · H < 0.5 mean-reverting · H > 0.5 trending.
//
// References: Hurst (1951), Mandelbrot & Wallis (1969).

import { mean, std } from "./stats";

export interface HurstResult {
  hurst: number;
  intercept: number;
  rSquared: number;
  points: { n: number; rs: number }[];
}

export function hurstExponent(y: number[]): HurstResult {
  const T = y.length;
  if (T < 64) throw new Error("hurstExponent: need at least 64 observations");
  // Decadal grid of window sizes covering the sample.
  const windows: number[] = [];
  for (let n = 16; n <= Math.floor(T / 4); n = Math.floor(n * 1.6)) {
    windows.push(n);
  }
  const points: { n: number; rs: number }[] = [];
  for (const n of windows) {
    const chunks = Math.floor(T / n);
    if (chunks < 2) continue;
    const rsValues: number[] = [];
    for (let k = 0; k < chunks; k++) {
      const slice = y.slice(k * n, (k + 1) * n);
      const m = mean(slice);
      const dev = slice.map((v) => v - m);
      // cumulative deviation
      const cum: number[] = new Array(n);
      let s = 0;
      for (let i = 0; i < n; i++) { s += dev[i]; cum[i] = s; }
      const range = Math.max(...cum) - Math.min(...cum);
      const sd = std(slice);
      if (sd > 0) rsValues.push(range / sd);
    }
    if (rsValues.length > 0) {
      points.push({ n, rs: rsValues.reduce((a, b) => a + b, 0) / rsValues.length });
    }
  }
  if (points.length < 3) throw new Error("hurstExponent: not enough points to fit");
  // Linear regression of log(rs) on log(n).
  const xs = points.map((p) => Math.log(p.n));
  const ys = points.map((p) => Math.log(p.rs));
  const xm = mean(xs);
  const ym = mean(ys);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - xm) * (ys[i] - ym);
    sxx += (xs[i] - xm) * (xs[i] - xm);
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = ym - slope * xm;
  // R^2
  let ssr = 0, sst = 0;
  for (let i = 0; i < xs.length; i++) {
    const yh = intercept + slope * xs[i];
    ssr += (ys[i] - yh) ** 2;
    sst += (ys[i] - ym) ** 2;
  }
  const rSquared = sst === 0 ? 0 : 1 - ssr / sst;
  return { hurst: slope, intercept, rSquared, points };
}
