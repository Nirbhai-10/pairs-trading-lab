// Ordinary Least Squares — simple (one regressor + intercept) and multiple.
// Plus rolling simple OLS for time-varying hedge ratios.

import { inv, matmul, transpose, type Matrix } from "./linalg";
import { mean } from "./stats";

export interface OlsResult {
  alpha: number;            // intercept
  beta: number;             // slope on x
  residuals: number[];
  rSquared: number;
  stdErrAlpha: number;
  stdErrBeta: number;
  tStatBeta: number;
  sigma2: number;           // residual variance (unbiased, n-k)
  n: number;
}

// Simple OLS: y = alpha + beta * x + eps.
export function ols(y: number[], x: number[]): OlsResult {
  const n = Math.min(y.length, x.length);
  if (n < 3) throw new Error("ols: need at least 3 observations");
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    sxy += dx * (y[i] - my);
    sxx += dx * dx;
  }
  if (sxx === 0) throw new Error("ols: zero variance in x");
  const beta = sxy / sxx;
  const alpha = my - beta * mx;
  const residuals: number[] = new Array(n);
  let ssr = 0;
  for (let i = 0; i < n; i++) {
    const r = y[i] - alpha - beta * x[i];
    residuals[i] = r;
    ssr += r * r;
  }
  let sst = 0;
  for (let i = 0; i < n; i++) {
    const d = y[i] - my;
    sst += d * d;
  }
  const rSquared = sst === 0 ? 0 : 1 - ssr / sst;
  const sigma2 = ssr / (n - 2);
  const stdErrBeta = Math.sqrt(sigma2 / sxx);
  const stdErrAlpha = Math.sqrt(sigma2 * (1 / n + (mx * mx) / sxx));
  const tStatBeta = stdErrBeta === 0 ? 0 : beta / stdErrBeta;
  return { alpha, beta, residuals, rSquared, stdErrAlpha, stdErrBeta, tStatBeta, sigma2, n };
}

export interface OlsMultiResult {
  coef: number[];           // includes intercept if X has constant column
  residuals: number[];
  rSquared: number;
  stdErrors: number[];
  tStats: number[];
  sigma2: number;
  n: number;
  k: number;
}

// Multiple OLS: y = X * coef + eps. X is rows x cols; caller supplies the constant column.
export function olsMulti(y: number[], X: Matrix): OlsMultiResult {
  const n = X.length;
  const k = X[0].length;
  if (y.length !== n) throw new Error("olsMulti: y/X length mismatch");
  if (n <= k) throw new Error("olsMulti: not enough observations");
  const Xt = transpose(X);
  const XtX = matmul(Xt, X);
  const XtX_inv = inv(XtX);
  // beta = (X'X)^-1 X' y
  const Xty = Xt.map((row) => row.reduce((s, v, j) => s + v * y[j], 0));
  const coef = XtX_inv.map((row) => row.reduce((s, v, j) => s + v * Xty[j], 0));
  const fitted: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < k; j++) s += X[i][j] * coef[j];
    fitted[i] = s;
  }
  const residuals = y.map((yi, i) => yi - fitted[i]);
  let ssr = 0;
  for (let i = 0; i < n; i++) ssr += residuals[i] * residuals[i];
  const my = mean(y);
  let sst = 0;
  for (let i = 0; i < n; i++) {
    const d = y[i] - my;
    sst += d * d;
  }
  const rSquared = sst === 0 ? 0 : 1 - ssr / sst;
  const sigma2 = ssr / (n - k);
  const stdErrors = XtX_inv.map((row, i) => Math.sqrt(sigma2 * row[i]));
  const tStats = coef.map((b, i) => (stdErrors[i] === 0 ? 0 : b / stdErrors[i]));
  return { coef, residuals, rSquared, stdErrors, tStats, sigma2, n, k };
}

// Rolling simple OLS. Returns alpha, beta arrays of length y.length, with nulls before window-1.
export function rollingOls(y: number[], x: number[], window: number): { alpha: (number | null)[]; beta: (number | null)[] } {
  const n = Math.min(y.length, x.length);
  const alpha: (number | null)[] = new Array(n).fill(null);
  const beta: (number | null)[] = new Array(n).fill(null);
  if (window < 3 || window > n) return { alpha, beta };
  // Use online sums for efficiency: maintain Σx, Σy, Σxy, Σxx over the window.
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < window; i++) {
    sx += x[i];
    sy += y[i];
    sxy += x[i] * y[i];
    sxx += x[i] * x[i];
  }
  const compute = (i: number) => {
    const w = window;
    const denom = w * sxx - sx * sx;
    if (denom === 0) {
      alpha[i] = null; beta[i] = null;
      return;
    }
    const b = (w * sxy - sx * sy) / denom;
    const a = (sy - b * sx) / w;
    alpha[i] = a;
    beta[i] = b;
  };
  compute(window - 1);
  for (let i = window; i < n; i++) {
    const drop = i - window;
    sx += x[i] - x[drop];
    sy += y[i] - y[drop];
    sxy += x[i] * y[i] - x[drop] * y[drop];
    sxx += x[i] * x[i] - x[drop] * x[drop];
    compute(i);
  }
  return { alpha, beta };
}
