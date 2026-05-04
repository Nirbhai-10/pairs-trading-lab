// Smoke test for math + backtest. Runs in node via tsx.
//
// Usage:  npx tsx scripts/smoke.ts

import { ols, rollingOls } from "../src/lib/math/ols";
import { adfTest } from "../src/lib/math/adf";
import { engleGranger } from "../src/lib/math/cointegration";
import { kalmanHedge } from "../src/lib/math/kalman";
import { fitOu } from "../src/lib/math/ou";
import { buildUniverse } from "../src/lib/data/synthetic";
import { runBacktest } from "../src/lib/backtest/engine";

const fmt = (x: number, d = 4) => (Number.isFinite(x) ? x.toFixed(d) : "NaN");

function header(s: string) {
  console.log("\n" + "=".repeat(60));
  console.log(s);
  console.log("=".repeat(60));
}

// ---- 1. OLS sanity: y = 2 + 3 x + small noise ----
header("OLS: should recover α≈2, β≈3");
{
  const x = Array.from({ length: 200 }, (_, i) => i / 10);
  const y = x.map((xi) => 2 + 3 * xi + (Math.random() - 0.5) * 0.05);
  const fit = ols(y, x);
  console.log(`  alpha=${fmt(fit.alpha)}  beta=${fmt(fit.beta)}  R²=${fmt(fit.rSquared)}  tBeta=${fmt(fit.tStatBeta, 1)}`);
}

// ---- 2. ADF on stationary AR(1) vs random walk ----
header("ADF: stationary AR(1) should reject; random walk should not");
{
  const stat: number[] = [];
  let v = 0;
  for (let i = 0; i < 600; i++) { v = 0.5 * v + (Math.random() - 0.5); stat.push(v); }
  const rw: number[] = [];
  v = 0;
  for (let i = 0; i < 600; i++) { v = v + (Math.random() - 0.5); rw.push(v); }
  const r1 = adfTest(stat, 1);
  const r2 = adfTest(rw, 1);
  console.log(`  Stationary  → t=${fmt(r1.tStat, 2)}, CV5%=${fmt(r1.criticalValues["5%"], 2)}, stationary=${r1.isStationary5}`);
  console.log(`  Random walk → t=${fmt(r2.tStat, 2)}, CV5%=${fmt(r2.criticalValues["5%"], 2)}, stationary=${r2.isStationary5}`);
}

// ---- 3. Universe + cointegration on each pair ----
header("Universe build & cointegration filter");
const u = buildUniverse({ seed: "smoke-1" });
console.log(`  market: ${u.market.dates.length} bars, last close = ${fmt(u.market.prices.at(-1) ?? 0, 2)}`);
for (const p of u.pairs) {
  const lpA = p.a.prices.map(Math.log);
  const lpB = p.b.prices.map(Math.log);
  const eg = engleGranger(lpA, lpB, 1);
  console.log(
    `  ${p.spec.id.padEnd(12)} (${p.spec.tag.padEnd(12)})  β=${fmt(eg.hedgeRatio, 3)}  t=${fmt(eg.adf.tStat, 2)}  ` +
    `CV5%=${fmt(eg.cointCriticalValues["5%"], 2)}  cointegrated=${eg.isCointegrated5}  R²=${fmt(eg.rSquared, 3)}`
  );
}

// ---- 4. OU half-life on the strongest pair's spread ----
header("OU half-life on MEGA-WHEN spread");
{
  const p = u.pairs.find((q) => q.spec.id === "MEGA-WHEN")!;
  const lpA = p.a.prices.map(Math.log);
  const lpB = p.b.prices.map(Math.log);
  const fit = ols(lpA, lpB);
  const spread = lpA.map((v, i) => v - fit.beta * lpB[i]);
  const ou = fitOu(spread);
  console.log(`  θ=${fmt(ou.theta, 4)}  μ=${fmt(ou.mu, 4)}  half-life=${ou.halfLife ? fmt(ou.halfLife, 1) : "n/a"} bars  R²=${fmt(ou.rSquared, 3)}`);
}

// ---- 5. Kalman β on a strong pair ----
header("Kalman β converges near OLS β on MEGA-WHEN");
{
  const p = u.pairs.find((q) => q.spec.id === "MEGA-WHEN")!;
  const lpA = p.a.prices.map(Math.log);
  const lpB = p.b.prices.map(Math.log);
  const olsFit = ols(lpA, lpB);
  const k = kalmanHedge(lpA, lpB, { delta: 1e-4 });
  const lastBeta = k.beta[k.beta.length - 1];
  console.log(`  OLS β = ${fmt(olsFit.beta, 3)}   Kalman β (final) = ${fmt(lastBeta, 3)}`);
}

// ---- 6. Run a backtest on every pair, print metrics ----
header("Backtest summary across pairs");
for (const p of u.pairs) {
  try {
    const r = runBacktest(p, { hedgeModel: "rolling", zEntry: 2, zExit: 0.5, zStop: 4, timeStop: 30 });
    console.log(
      `  ${p.spec.id.padEnd(12)}  N=${String(r.metrics.nTrades).padStart(3)}  ` +
      `total=${fmt(r.metrics.totalReturn * 100, 1)}%  ` +
      `Sharpe=${fmt(r.metrics.sharpe, 2)}  ` +
      `MDD=${fmt(r.metrics.maxDrawdown * 100, 1)}%  ` +
      `hit=${fmt(r.metrics.hitRate * 100, 1)}%  halted=${r.halted}`
    );
  } catch (e) {
    console.log(`  ${p.spec.id} backtest error: ${(e as Error).message}`);
  }
}
