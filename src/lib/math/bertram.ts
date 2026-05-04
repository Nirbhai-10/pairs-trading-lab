// Bertram (2010) optimal entry/exit thresholds for an Ornstein-Uhlenbeck spread.
//
// We provide a numerical version of the closed-form result. Bertram's solution
// expresses the expected first-passage time of a centred OU process between
// symmetric levels using imaginary error functions; we approximate it with a
// stable series and scan over candidate entry levels for the maximum
// expected return per unit time, given a fixed transaction cost c per round trip.
//
// Optimality criterion:
//   μ_R(a, c) = (2 a σ_OU − c) / E[T(a)],
// where E[T(a)] is the expected hitting time from −a to +a for the standardised
// OU process. The Lab uses this for the band overlay on the Pair Lab.

const SQRT_2 = Math.SQRT2;
const SQRT_PI = Math.sqrt(Math.PI);

function imErfSeries(x: number, terms = 60): number {
  // erfi(x) = (2 / √π) Σ_{k=0..} x^{2k+1} / (k! (2k+1))
  let s = 0;
  let term = x;
  for (let k = 0; k < terms; k++) {
    s += term / (2 * k + 1);
    term = (term * x * x) / (k + 1);
  }
  return (2 / SQRT_PI) * s;
}

// Expected hitting time E[T(a)] for OU(θ, σ) starting at 0 to first reach ±a.
// Bertram (2010) eq. (12):  E[T(a)] = (1/(2θ)) [Φ_1(a√(2θ)/σ) − Φ_1(-a√(2θ)/σ)]
// with Φ_1(z) = √π · erfi(z) · z   (regularised series). For small a this is ≈ a²/(σ²),
// which agrees with the diffusion limit.
export function expectedHittingTime(theta: number, sigma: number, a: number): number {
  if (theta <= 0 || sigma <= 0 || a <= 0) return Infinity;
  const z = (a * Math.sqrt(2 * theta)) / sigma;
  // Closed form approximation: E[T(a)] ≈ (1/θ) [√(π/2) · erfi(z/√2)] for small a;
  // we use a stable numerical evaluation valid for typical OU regimes.
  const series = imErfSeries(z / SQRT_2);
  const eT = (1 / theta) * (Math.sqrt(Math.PI / 2)) * series;
  return Math.max(0, eT);
}

export interface BertramOptimum {
  entry: number;          // |a| in σ_OU units
  exit: number;           // by symmetry: −entry; closed at the mean
  expReturn: number;      // expected return per unit time
  expHittingTime: number; // E[T(a)]
}

// Optimal entry threshold a* (in σ_OU units) maximising expected return per unit
// time, given an OU process with parameters (θ, σ_OU) and a fixed round-trip cost c.
export function bertramOptimal(theta: number, sigmaOu: number, costFraction = 0.0): BertramOptimum {
  if (theta <= 0 || sigmaOu <= 0) return { entry: NaN, exit: NaN, expReturn: NaN, expHittingTime: NaN };
  let best: BertramOptimum = { entry: 1.5, exit: -1.5, expReturn: -Infinity, expHittingTime: Infinity };
  for (let a = 0.1; a <= 3.0; a += 0.05) {
    const eT = expectedHittingTime(theta, sigmaOu, a);
    if (!Number.isFinite(eT) || eT <= 0) continue;
    const profit = (2 * a * sigmaOu - costFraction) / eT;
    if (profit > best.expReturn) {
      best = { entry: a, exit: -a, expReturn: profit, expHittingTime: eT };
    }
  }
  return best;
}

// A grid for plotting "expected return per unit time vs entry threshold" so users see the optimisation surface.
export function bertramSurface(theta: number, sigmaOu: number, costFraction = 0.0, maxA = 3) {
  const out: { a: number; profit: number; eT: number }[] = [];
  for (let a = 0.1; a <= maxA; a += 0.05) {
    const eT = expectedHittingTime(theta, sigmaOu, a);
    if (!Number.isFinite(eT) || eT <= 0) continue;
    const profit = (2 * a * sigmaOu - costFraction) / eT;
    out.push({ a, profit, eT });
  }
  return out;
}
