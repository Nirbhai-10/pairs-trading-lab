// Small dense linear algebra helpers used by OLS / ADF / Kalman.
// Arrays-of-arrays representation. Built to be readable, not fast — series here are O(10^3).

export type Matrix = number[][];
export type Vector = number[];

export function zeros(rows: number, cols: number): Matrix {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

export function identity(n: number): Matrix {
  const m = zeros(n, n);
  for (let i = 0; i < n; i++) m[i][i] = 1;
  return m;
}

export function transpose(a: Matrix): Matrix {
  const r = a.length;
  const c = a[0].length;
  const t = zeros(c, r);
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) t[j][i] = a[i][j];
  return t;
}

export function matmul(a: Matrix, b: Matrix): Matrix {
  const r = a.length;
  const k = a[0].length;
  const c = b[0].length;
  if (b.length !== k) throw new Error(`matmul shape: ${r}x${k} * ${b.length}x${c}`);
  const out = zeros(r, c);
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      let s = 0;
      for (let p = 0; p < k; p++) s += a[i][p] * b[p][j];
      out[i][j] = s;
    }
  }
  return out;
}

export function matvec(a: Matrix, x: Vector): Vector {
  const r = a.length;
  const c = a[0].length;
  if (x.length !== c) throw new Error(`matvec shape: ${r}x${c} * ${x.length}`);
  const out = new Array(r).fill(0);
  for (let i = 0; i < r; i++) {
    let s = 0;
    for (let j = 0; j < c; j++) s += a[i][j] * x[j];
    out[i] = s;
  }
  return out;
}

// Solve A x = b for square A using partial-pivot Gaussian elimination.
// Returns x. Throws if singular within tolerance.
export function solve(A: Matrix, b: Vector): Vector {
  const n = A.length;
  if (A[0].length !== n) throw new Error("solve: A must be square");
  if (b.length !== n) throw new Error("solve: b length must match A");
  // Augmented matrix [A | b]
  const M = A.map((row, i) => [...row, b[i]]);
  for (let k = 0; k < n; k++) {
    // pivot
    let maxRow = k;
    let maxVal = Math.abs(M[k][k]);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(M[i][k]);
      if (v > maxVal) { maxVal = v; maxRow = i; }
    }
    if (maxVal < 1e-14) throw new Error("solve: matrix is singular");
    if (maxRow !== k) [M[k], M[maxRow]] = [M[maxRow], M[k]];
    // eliminate
    for (let i = k + 1; i < n; i++) {
      const f = M[i][k] / M[k][k];
      for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
    }
  }
  // back-substitute
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

// Invert a square matrix via Gauss-Jordan. Used for OLS (X'X)^-1 when we need standard errors.
export function inv(A: Matrix): Matrix {
  const n = A.length;
  if (A[0].length !== n) throw new Error("inv: A must be square");
  const M = A.map((row, i) => {
    const r = [...row];
    for (let j = 0; j < n; j++) r.push(i === j ? 1 : 0);
    return r;
  });
  for (let k = 0; k < n; k++) {
    let maxRow = k;
    let maxVal = Math.abs(M[k][k]);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(M[i][k]);
      if (v > maxVal) { maxVal = v; maxRow = i; }
    }
    if (maxVal < 1e-14) throw new Error("inv: matrix is singular");
    if (maxRow !== k) [M[k], M[maxRow]] = [M[maxRow], M[k]];
    const pivot = M[k][k];
    for (let j = 0; j < 2 * n; j++) M[k][j] /= pivot;
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      const f = M[i][k];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) M[i][j] -= f * M[k][j];
    }
  }
  return M.map((row) => row.slice(n));
}
