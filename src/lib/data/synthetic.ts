// Synthetic but realistic demo data for pairs trading.
//
// Each "stock" is a function of (a) a sector random-walk factor, (b) a
// pair-specific stationary OU disturbance, and (c) iid Gaussian level noise.
//
//   log P_A(t)  =  log P_A(0)  +  F_sector(t)        +  s_AB(t)  +  ε_A(t)
//   log P_B(t)  =  log P_B(0)  +  F_sector(t) / α     +              ε_B(t)
//
// where F is I(1) (random walk), s_AB is OU-stationary, and ε_A, ε_B are iid
// stationary level noise. Then
//
//   log P_A  −  α · log P_B   =   const  +  s_AB(t)  +  ε_A(t)  −  α ε_B(t),
//
// which is stationary ⇒ A and B are cointegrated with cointegration vector (1, −α).
//
// We also generate a market index, per-stock daily volume, and a per-stock
// daily β-to-market factor used downstream for β-hedging and Amihud screens.
//
// Everything is fully deterministic given a seed.

import seedrandom from "seedrandom";

const TRADING_DAYS_PER_YEAR = 252;

export interface BarSeries {
  dates: string[];
  prices: number[];
  volumes: number[];        // shares traded that day
  logReturns: number[];     // length n - 1, aligned to dates[1..]
}

export interface PairSpec {
  id: string;
  symbolA: string;
  symbolB: string;
  sector: "Banks" | "Tech" | "Energy" | "Consumer" | "Healthcare" | "Industrials";
  tag: "Strong" | "Moderate" | "Weak" | "Broken" | "Independent";
  truth: { alpha: number; ouTheta: number; ouSigma: number; regimeBreak?: number };
  description: string;
}

export interface PairData {
  spec: PairSpec;
  a: BarSeries;
  b: BarSeries;
}

export interface DemoUniverse {
  market: BarSeries;          // synthetic market index "MKT"
  pairs: PairData[];
  startDate: Date;
  nBars: number;
}

// ----- helpers -----------------------------------------------------------

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Build a forward calendar of business days (Mon-Fri only, no holidays).
function businessDays(start: Date, n: number): string[] {
  const out: string[] = [];
  const d = new Date(start);
  while (out.length < n) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) out.push(isoDate(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function gaussian(rng: () => number): number {
  // Box-Muller
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Random walk with drift (geometric brownian motion in log-space).
function gbm(rng: () => number, n: number, mu: number, sigma: number): number[] {
  // Returns log-price increments cumulatively summed; caller chooses level by adding a constant.
  const out = new Array<number>(n);
  let v = 0;
  for (let i = 0; i < n; i++) {
    v += mu + sigma * gaussian(rng);
    out[i] = v;
  }
  return out;
}

// OU process X_{t+1} = X_t + θ(μ - X_t) + σ ε_t, simulated with unit time step.
function ou(rng: () => number, n: number, theta: number, mu: number, sigma: number, x0 = 0): number[] {
  const out = new Array<number>(n);
  let x = x0;
  for (let i = 0; i < n; i++) {
    x = x + theta * (mu - x) + sigma * gaussian(rng);
    out[i] = x;
  }
  return out;
}

// Build a price series from cumulative log increments and a starting price.
function pricesFromLog(startPrice: number, cumLog: number[]): number[] {
  return cumLog.map((c) => startPrice * Math.exp(c));
}

// Volume series: log-normal around a target dollar volume that scales with price.
function makeVolume(rng: () => number, n: number, targetShares: number, vol = 0.35): number[] {
  const v = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const z = gaussian(rng);
    v[i] = Math.max(1, targetShares * Math.exp(vol * z - 0.5 * vol * vol));
  }
  return v;
}

// ----- spec catalogue ----------------------------------------------------

const PAIR_SPECS: PairSpec[] = [
  {
    id: "MEGA-WHEN",
    symbolA: "MEGA", symbolB: "WHEN",
    sector: "Banks", tag: "Strong",
    truth: { alpha: 1.0, ouTheta: 0.08, ouSigma: 0.018 },
    description: "Two large-cap money-centre banks with near-identical earnings drivers. Spread mean-reverts in ~9 days.",
  },
  {
    id: "NORTH-SOUTH",
    symbolA: "NORTH", symbolB: "SOUTH",
    sector: "Energy", tag: "Strong",
    truth: { alpha: 0.95, ouTheta: 0.05, ouSigma: 0.022 },
    description: "Integrated oil majors. Common exposure to crude prices; ~14-day half-life.",
  },
  {
    id: "SAGE-OAKE",
    symbolA: "SAGE", symbolB: "OAKE",
    sector: "Tech", tag: "Moderate",
    truth: { alpha: 1.1, ouTheta: 0.035, ouSigma: 0.028 },
    description: "Mega-cap platform companies. Slower mean reversion (~20 days), wider tradable bands.",
  },
  {
    id: "AURA-KINS",
    symbolA: "AURA", symbolB: "KINS",
    sector: "Consumer", tag: "Weak",
    truth: { alpha: 1.0, ouTheta: 0.018, ouSigma: 0.020 },
    description: "Consumer-staples lookalikes. Cointegration is borderline — half-life ~38 days. Filter candidate.",
  },
  {
    id: "PYRE-VALE",
    symbolA: "PYRE", symbolB: "VALE",
    sector: "Industrials", tag: "Broken",
    truth: { alpha: 0.9, ouTheta: 0.06, ouSigma: 0.020, regimeBreak: 0.55 },
    description: "Industrial pair that cointegrated until a structural break ~55% through the sample. A live test of breakdown filters.",
  },
  {
    id: "ATLO-BERN",
    symbolA: "ATLO", symbolB: "BERN",
    sector: "Healthcare", tag: "Independent",
    truth: { alpha: 1.0, ouTheta: 0.0, ouSigma: 0.0 },
    description: "Two healthcare names with no shared latent factor. Should fail cointegration tests — included to verify the filter rejects bad pairs.",
  },
];

export function listPairSpecs(): PairSpec[] {
  return PAIR_SPECS;
}

// ----- universe builder --------------------------------------------------

export interface BuildOpts {
  seed?: string;
  years?: number;             // default 5
  startDate?: Date;           // default 2020-01-02
}

export function buildUniverse(opts: BuildOpts = {}): DemoUniverse {
  const seed = opts.seed ?? "pairs-trading-lab-v1";
  const rng = seedrandom(seed);
  const years = opts.years ?? 5;
  const nBars = Math.round(years * TRADING_DAYS_PER_YEAR);
  const start = opts.startDate ?? new Date(Date.UTC(2020, 0, 2));
  const dates = businessDays(start, nBars);

  // Market factor (log space). Annualised drift 7%, vol 16%.
  const muM = 0.07 / TRADING_DAYS_PER_YEAR;
  const sigmaM = 0.16 / Math.sqrt(TRADING_DAYS_PER_YEAR);
  const marketCum = gbm(rng, nBars, muM, sigmaM);
  const marketPrices = pricesFromLog(100, marketCum);
  const marketVols = makeVolume(rng, nBars, 100_000_000, 0.25);
  const marketLogRets: number[] = [];
  for (let i = 1; i < nBars; i++) marketLogRets.push(marketCum[i] - marketCum[i - 1]);
  const market: BarSeries = { dates, prices: marketPrices, volumes: marketVols, logReturns: marketLogRets };

  // Sector factors — partly correlated with market.
  const sectorFactor = (loadOnMarket: number, idioVol: number): number[] => {
    const idio = gbm(rng, nBars, 0, idioVol / Math.sqrt(TRADING_DAYS_PER_YEAR));
    return marketCum.map((m, i) => loadOnMarket * m + idio[i]);
  };
  const sectorMap: Record<PairSpec["sector"], number[]> = {
    Banks:        sectorFactor(1.10, 0.10),
    Energy:       sectorFactor(0.90, 0.18),
    Tech:         sectorFactor(1.25, 0.14),
    Consumer:     sectorFactor(0.65, 0.07),
    Healthcare:   sectorFactor(0.75, 0.09),
    Industrials:  sectorFactor(1.00, 0.11),
  };

  // Build each pair from its sector factor + OU spread (or independent walks for the negative example).
  const pairs: PairData[] = PAIR_SPECS.map((spec) => {
    const F = sectorMap[spec.sector];
    let logA: number[];
    let logB: number[];

    if (spec.tag === "Independent") {
      // Two independent random walks with mild drift — same sector factor influence is intentionally absent.
      logA = gbm(rng, nBars, 0.04 / TRADING_DAYS_PER_YEAR, 0.22 / Math.sqrt(TRADING_DAYS_PER_YEAR));
      logB = gbm(rng, nBars, 0.05 / TRADING_DAYS_PER_YEAR, 0.24 / Math.sqrt(TRADING_DAYS_PER_YEAR));
    } else {
      const sAB = ou(rng, nBars, spec.truth.ouTheta, 0, spec.truth.ouSigma);
      // Stationary level noise (NOT cumulative). Tiny per-bar shocks so log-prices keep most of
      // their structure from the sector factor + OU spread, with realistic measurement noise.
      const epsLvlSigma = 0.012;
      const epsA = new Array<number>(nBars);
      const epsB = new Array<number>(nBars);
      for (let i = 0; i < nBars; i++) {
        epsA[i] = epsLvlSigma * gaussian(rng);
        epsB[i] = epsLvlSigma * gaussian(rng);
      }
      // logA shares F directly; logB is scaled by 1/α so that (logA − α·logB) cancels F.
      // For α=1 this collapses to the natural "shared sector" formulation.
      const inv = 1 / spec.truth.alpha;
      logA = F.map((f, i) => f + sAB[i] + epsA[i]);
      logB = F.map((f, i) => inv * f + epsB[i]);

      if (spec.tag === "Broken" && spec.truth.regimeBreak) {
        // After the break, B accumulates a divergent random walk so the cointegration relationship
        // collapses. A live test of breakdown filters.
        const breakIdx = Math.floor(nBars * spec.truth.regimeBreak);
        const drift = 0.30 / Math.sqrt(TRADING_DAYS_PER_YEAR); // strong post-break diffusion
        let extra = 0;
        for (let i = breakIdx; i < nBars; i++) {
          extra += drift * gaussian(rng) + 0.0008; // upward drift in B detaches the relationship
          logB[i] += extra;
        }
      }
    }

    // Anchor levels with realistic starting prices and dollar volumes.
    const startA = 50 + Math.floor(rng() * 80);
    const startB = 40 + Math.floor(rng() * 70);
    const pricesA = pricesFromLog(startA, logA);
    const pricesB = pricesFromLog(startB, logB);

    const vols = (target: number, vol: number) => makeVolume(rng, nBars, target, vol);
    const a: BarSeries = {
      dates,
      prices: pricesA,
      volumes: vols(2_500_000 + Math.floor(rng() * 5_000_000), 0.35),
      logReturns: diff(logA),
    };
    const b: BarSeries = {
      dates,
      prices: pricesB,
      volumes: vols(2_500_000 + Math.floor(rng() * 5_000_000), 0.35),
      logReturns: diff(logB),
    };
    return { spec, a, b };
  });

  return { market, pairs, startDate: start, nBars };
}

function diff(x: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < x.length; i++) out.push(x[i] - x[i - 1]);
  return out;
}
