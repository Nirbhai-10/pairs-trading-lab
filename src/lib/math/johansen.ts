// Johansen (1988, 1991) cointegration test, 2-variable specification.
//
//   Y_t = (y1_t, y2_t)' ∈ ℝ² with VAR(p).
// Reduce to ΔY_t = αβ' Y_{t-1} + Σ Γ_i ΔY_{t-i} + ε_t.
// We test how many cointegration vectors r ∈ {0,1,2} the model supports.
//
// Two statistics are reported:
//   • Trace statistic    λ_trace(r) = −T ∑_{i=r+1..k} ln(1 − λ_i)
//   • Max-eigenvalue     λ_max(r)   = −T · ln(1 − λ_{r+1})
//
// Compared against Osterwald-Lenum (1992) finite-sample critical values for
// case "c" (constant in the cointegrating relation), k = 2 variables.
//
// We implement the simplest variant: VAR(1) (no augmenting lags), constant
// in the cointegrating relation. This is the textbook 2-variable Johansen
// presentation that lines up cleanly with Engle-Granger for pedagogical
// comparison; the same trace test extends to VAR(p) with auxiliary regressions.

import { matmul, transpose, type Matrix } from "./linalg";
import { mean } from "./stats";

interface SymMat {
  S00: Matrix;
  S01: Matrix;
  S10: Matrix;
  S11: Matrix;
}

function inv2(M: Matrix): Matrix {
  const a = M[0][0], b = M[0][1], c = M[1][0], d = M[1][1];
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-15) throw new Error("inv2: singular matrix");
  const k = 1 / det;
  return [
    [d * k, -b * k],
    [-c * k, a * k],
  ];
}

// Eigenvalues of 2×2 matrix.
function eig2(M: Matrix): [number, number] {
  const a = M[0][0], b = M[0][1], c = M[1][0], d = M[1][1];
  const tr = a + d;
  const det = a * d - b * c;
  const disc = tr * tr - 4 * det;
  if (disc < 0) {
    // Complex eigenvalues — should not happen for the well-formed Johansen problem
    // because S_11^{-1} S_10 S_00^{-1} S_01 is positive semi-definite.
    return [tr / 2, tr / 2];
  }
  const r = Math.sqrt(disc);
  const l1 = (tr + r) / 2;
  const l2 = (tr - r) / 2;
  return [l1, l2];
}

export interface JohansenResult {
  eigenvalues: [number, number];
  traceR0: number;     // null: r ≤ 0
  traceR1: number;     // null: r ≤ 1
  maxR0: number;       // null: r = 0 vs r = 1
  maxR1: number;
  cv5Trace: { r0: number; r1: number };
  cv5Max: { r0: number; r1: number };
  rejectR0_5pct: boolean;   // ⇒ at least one cointegration vector exists
  rejectR1_5pct: boolean;   // ⇒ both relationships are cointegrating
  cointegrationVector: [number, number];
}

// Osterwald-Lenum (1992) Table 1, case "c" (constant), k = 2.
const CV5_TRACE = { r0: 15.41, r1: 3.76 };
const CV1_TRACE = { r0: 20.04, r1: 6.65 };
const CV5_MAX   = { r0: 14.07, r1: 3.76 };
const CV1_MAX   = { r0: 18.63, r1: 6.65 };

export function johansen2(y1: number[], y2: number[]): JohansenResult {
  const T = Math.min(y1.length, y2.length);
  if (T < 30) throw new Error("johansen2: need ≥ 30 observations");
  // Build ΔY_t and Y_{t-1}, lengths T-1 each.
  const dy: Matrix = [];
  const yLag: Matrix = [];
  for (let t = 1; t < T; t++) {
    dy.push([y1[t] - y1[t - 1], y2[t] - y2[t - 1]]);
    yLag.push([y1[t - 1], y2[t - 1]]);
  }
  const n = dy.length;

  // De-mean both (constant in cointegration relation).
  const dyMean = [mean(dy.map((r) => r[0])), mean(dy.map((r) => r[1]))];
  const ylMean = [mean(yLag.map((r) => r[0])), mean(yLag.map((r) => r[1]))];
  const R0 = dy.map((r) => [r[0] - dyMean[0], r[1] - dyMean[1]]);
  const R1 = yLag.map((r) => [r[0] - ylMean[0], r[1] - ylMean[1]]);

  // Sums of squares S_ij = (1/n) R_i' R_j.
  const scale = (M: Matrix, k: number) => M.map((row) => row.map((x) => x * k));
  const Mij = (Ri: Matrix, Rj: Matrix): Matrix => scale(matmul(transpose(Ri), Rj), 1 / n);
  const sym: SymMat = {
    S00: Mij(R0, R0),
    S01: Mij(R0, R1),
    S10: Mij(R1, R0),
    S11: Mij(R1, R1),
  };

  // Solve generalized eigenvalue problem |λ S_11 − S_10 S_00^{-1} S_01| = 0
  // i.e., eigenvalues of S_11^{-1} S_10 S_00^{-1} S_01.
  const M = matmul(matmul(inv2(sym.S11), sym.S10), matmul(inv2(sym.S00), sym.S01));
  const [l1raw, l2raw] = eig2(M);
  const l1 = Math.min(0.999, Math.max(0, l1raw));
  const l2 = Math.min(0.999, Math.max(0, l2raw));
  const lambdas = l1 >= l2 ? [l1, l2] : [l2, l1];

  // Trace statistics.
  const traceR0 = -n * (Math.log(1 - lambdas[0]) + Math.log(1 - lambdas[1]));
  const traceR1 = -n * Math.log(1 - lambdas[1]);
  const maxR0 = -n * Math.log(1 - lambdas[0]);
  const maxR1 = -n * Math.log(1 - lambdas[1]);

  // Cointegration vector β = top eigenvector of the same problem (un-normalised).
  // For 2×2 we can read it off from M − λ₁ I.
  const a = M[0][0] - lambdas[0];
  const b = M[0][1];
  // Solve a·β1 + b·β2 = 0 ⇒ β = (−b, a) (or (b, −a)). Normalise so β1 = 1 for interpretability.
  let beta: [number, number];
  if (Math.abs(b) > 1e-12) {
    beta = [1, -a / b];
  } else if (Math.abs(a) > 1e-12) {
    beta = [-M[1][1] / a, 1];
  } else {
    beta = [1, -1];
  }
  return {
    eigenvalues: [lambdas[0], lambdas[1]],
    traceR0, traceR1, maxR0, maxR1,
    cv5Trace: CV5_TRACE,
    cv5Max: CV5_MAX,
    rejectR0_5pct: traceR0 > CV5_TRACE.r0,
    rejectR1_5pct: traceR1 > CV5_TRACE.r1,
    cointegrationVector: beta,
  };
}

// Re-export critical values for the UI.
export const JOHANSEN_CVS = {
  trace: { r0: { "5%": CV5_TRACE.r0, "1%": CV1_TRACE.r0 }, r1: { "5%": CV5_TRACE.r1, "1%": CV1_TRACE.r1 } },
  max:   { r0: { "5%": CV5_MAX.r0,   "1%": CV1_MAX.r0   }, r1: { "5%": CV5_MAX.r1,   "1%": CV1_MAX.r1   } },
};
