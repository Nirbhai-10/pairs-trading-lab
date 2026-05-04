"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { buildUniverse } from "@/lib/data/synthetic";
import { runBacktest, DEFAULT_PARAMS, type BacktestResult } from "@/lib/backtest/engine";
import { engleGranger } from "@/lib/math/cointegration";
import { fitOu } from "@/lib/math/ou";
import { ols } from "@/lib/math/ols";
import { kpssTest } from "@/lib/math/kpss";
import { conditionalVaR, ulcerIndex } from "@/lib/risk/metrics";
import {
  betaToBenchmark,
  correlationMatrix,
  inverseVolWeights,
  pairAmihud,
  portfolioCovariance,
  portfolioVolatilities,
  riskParityWeights,
} from "@/lib/risk/sizing";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Slider } from "@/components/ui/Slider";
import { Badge } from "@/components/ui/Badge";
import { num, pct, signedPct } from "@/lib/util/format";

function downsample<T>(arr: T[], target = 360): T[] {
  if (arr.length <= target) return arr;
  const stride = Math.ceil(arr.length / target);
  const out: T[] = [];
  for (let i = 0; i < arr.length; i += stride) out.push(arr[i]);
  return out;
}

function correlationToColour(c: number): string {
  // -1 → red, 0 → bg, +1 → accent
  const t = Math.max(-1, Math.min(1, c));
  if (t >= 0) {
    const a = Math.round(t * 255 * 0.55);
    return `rgba(245, 165, 36, ${a / 255})`;
  }
  const a = Math.round(-t * 255 * 0.55);
  return `rgba(239, 68, 68, ${a / 255})`;
}

export function Portfolio() {
  const universe = useMemo(() => buildUniverse({ seed: "portfolio-1" }), []);
  const [amihudPctile, setAmihudPctile] = useState(0.85);
  const [maxHalfLife, setMaxHalfLife] = useState(50);

  const summaries = useMemo(() => {
    return universe.pairs.map((pair) => {
      const lpA = pair.a.prices.map(Math.log);
      const lpB = pair.b.prices.map(Math.log);
      const eg = engleGranger(lpA, lpB, 1);
      const fullOls = ols(lpA, lpB);
      const spread = lpA.map((v, i) => v - fullOls.beta * lpB[i]);
      const ouFit = fitOu(spread);
      let bt: BacktestResult | null = null;
      try { bt = runBacktest(pair, DEFAULT_PARAMS); } catch { bt = null; }
      const amihud = pairAmihud(pair);
      const mktRet = universe.market.logReturns;
      const betaToMkt = betaToBenchmark(pair.a.logReturns, mktRet);
      // Extended risk: KPSS for the spread, CVaR/Ulcer on the strategy returns, capacity proxy.
      const kpss = kpssTest(spread, "level");
      const cvar95 = bt ? conditionalVaR(bt.dailyReturn, 0.05) : 0;
      const ulcer = bt ? ulcerIndex(bt.equity) : 0;
      // Naive capacity: 1% of average daily dollar volume on the worse leg, in $.
      const dvolA = pair.a.prices.reduce((s, p, i) => s + p * pair.a.volumes[i], 0) / pair.a.prices.length;
      const dvolB = pair.b.prices.reduce((s, p, i) => s + p * pair.b.volumes[i], 0) / pair.b.prices.length;
      const capacityUsd = 0.01 * Math.min(dvolA, dvolB);
      return { pair, eg, ouFit, fullOls, bt, amihud, betaToMkt, kpss, cvar95, ulcer, capacityUsd };
    });
  }, [universe]);

  // Amihud threshold (across all pairs).
  const amihudThreshold = useMemo(() => {
    const sorted = summaries.map((s) => s.amihud).slice().sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.floor(amihudPctile * sorted.length));
    return sorted[idx];
  }, [summaries, amihudPctile]);

  // Apply screens — every derived value is rolled into one memo so the React
  // compiler never sees a "may be modified later" dependency.
  const book = useMemo(() => {
    const filtered = summaries.filter((s) => {
      if (!s.bt) return false;
      const halfOk = s.ouFit.halfLife != null && s.ouFit.halfLife <= maxHalfLife;
      const liqOk = s.amihud <= amihudThreshold;
      return halfOk && liqOk && s.eg.isCointegrated5;
    });
    const passingResults = filtered
      .map((s) => s.bt)
      .filter((b): b is BacktestResult => !!b);
    const passingPairs = filtered.map((s) => s.pair.spec.id);
    const vols = portfolioVolatilities(passingResults);
    const cov = portfolioCovariance(passingResults);
    const ivWeights = inverseVolWeights(vols);
    const rpWeights = passingResults.length > 0 ? riskParityWeights(cov) : [];
    const corrMat = correlationMatrix(passingResults.map((r) => r.dailyReturn));
    const netBetaToMkt =
      filtered.length === 0
        ? 0
        : filtered.reduce((s, f, i) => s + (rpWeights[i] ?? 0) * f.betaToMkt, 0);

    // Combined book using risk-parity weights.
    const n = universe.nBars;
    let combined: { date: string; equity: number }[] = [];
    if (passingResults.length > 0) {
      const series: number[] = new Array(n).fill(0);
      for (let i = 0; i < passingResults.length; i++) {
        const w = rpWeights[i] ?? 0;
        const r = passingResults[i].dailyReturn;
        for (let t = 0; t < n; t++) series[t] += w * r[t];
      }
      let v = 1;
      const eq: { date: string; equity: number }[] = [];
      for (let t = 0; t < n; t++) {
        v *= 1 + series[t];
        eq.push({ date: universe.market.dates[t], equity: v });
      }
      combined = downsample(eq, 480);
    }
    return { filtered, passingResults, passingPairs, ivWeights, rpWeights, corrMat, netBetaToMkt, combined };
  }, [summaries, amihudThreshold, maxHalfLife, universe]);

  const { filtered, passingResults, passingPairs, ivWeights, rpWeights, corrMat, netBetaToMkt, combined } = book;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-5 py-10">
      <header className="space-y-2">
        <Badge tone="accent">portfolio</Badge>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Portfolio — pairs as a book.
        </h1>
        <p className="max-w-3xl text-(--color-fg-muted)">
          Risk-parity sizing across pairs, β-to-market exposure, Amihud
          liquidity and half-life filters, and a correlation-of-pairs heatmap
          to surface clusters of redundant edge. All computed from default
          backtest results — adjust filters to see the book change.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
          <CardBody className="space-y-5">
            <Slider
              label="Half-life ceiling"
              value={maxHalfLife}
              min={5}
              max={150}
              step={1}
              digits={0}
              unit=" bars"
              hint="reject pairs whose mean reversion is too slow to trade"
              onChange={setMaxHalfLife}
            />
            <Slider
              label="Amihud percentile cap"
              value={amihudPctile}
              min={0.2}
              max={1.0}
              step={0.05}
              digits={2}
              hint="keep pairs whose worse leg is in this percentile or better"
              onChange={setAmihudPctile}
            />
            <div className="rounded-md border border-(--color-border) bg-(--color-card-soft) p-3 text-xs text-(--color-fg-muted)">
              <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-(--color-fg-faint)">
                Universe
              </div>
              <div>
                <span className="text-(--color-fg)">{summaries.length}</span> candidate pairs ·{" "}
                <span className="text-(--color-fg)">{filtered.length}</span> passing screens ·{" "}
                <span className="text-(--color-fg)">
                  {filtered.filter((f) => f.eg.isCointegrated5).length}
                </span>{" "}
                cointegrated at 5%.
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6 lg:col-span-8">
          <Card>
            <CardHeader>
              <CardTitle>Aggregate book</CardTitle>
              <Badge tone="neutral">risk-parity weighted</Badge>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <Stat
                  label="Net β to mkt"
                  value={num(netBetaToMkt, 2)}
                  hint="weighted leg-A β"
                  tone={Math.abs(netBetaToMkt) < 0.2 ? "good" : "neutral"}
                />
                <Stat
                  label="Pairs in book"
                  value={String(passingResults.length)}
                />
                <Stat
                  label="Mean Sharpe"
                  value={num(
                    passingResults.length > 0
                      ? passingResults.reduce((s, r) => s + r.metrics.sharpe, 0) / passingResults.length
                      : 0,
                    2
                  )}
                />
                <Stat
                  label="Mean half-life"
                  value={num(
                    filtered.length > 0
                      ? filtered.reduce((s, f) => s + (f.ouFit.halfLife ?? 0), 0) / filtered.length
                      : 0,
                    1
                  )}
                  hint="bars"
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Combined equity (risk-parity)</CardTitle>
            </CardHeader>
            <CardBody>
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <AreaChart data={combined} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="combfill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-good)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--color-good)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                    <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                    <ReferenceLine y={1} stroke="var(--color-fg-faint)" strokeDasharray="3 3" />
                    <Tooltip />
                    <Area type="monotone" dataKey="equity" stroke="var(--color-good)"
                      fill="url(#combfill)" strokeWidth={1.4} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pair-by-pair table</CardTitle>
          <Badge tone="neutral">extended risk + capacity</Badge>
        </CardHeader>
        <CardBody className="overflow-auto p-0">
          <table className="w-full text-xs">
            <thead className="bg-(--color-card-soft) text-left font-mono text-[10.5px] uppercase tracking-[0.14em] text-(--color-fg-faint)">
              <tr>
                <th className="px-3 py-2.5">Pair</th>
                <th className="px-3 py-2.5">Sector</th>
                <th className="px-3 py-2.5">β</th>
                <th className="px-3 py-2.5">Coint</th>
                <th className="px-3 py-2.5">KPSS</th>
                <th className="px-3 py-2.5">½-life</th>
                <th className="px-3 py-2.5">Amihud</th>
                <th className="px-3 py-2.5">βmkt</th>
                <th className="px-3 py-2.5">Sharpe</th>
                <th className="px-3 py-2.5">CVaR95</th>
                <th className="px-3 py-2.5">Ulcer</th>
                <th className="px-3 py-2.5">Cap $</th>
                <th className="px-3 py-2.5">Total</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {summaries.map((s) => {
                const passes = filtered.includes(s);
                return (
                  <tr key={s.pair.spec.id} className="border-t border-(--color-border)">
                    <td className="px-3 py-2 text-(--color-fg)">
                      {s.pair.spec.symbolA}<span className="text-(--color-fg-faint)">/</span>{s.pair.spec.symbolB}
                    </td>
                    <td className="px-3 py-2 text-(--color-fg-muted)">{s.pair.spec.sector}</td>
                    <td className="px-3 py-2 tabular text-(--color-fg)">{num(s.fullOls.beta, 2)}</td>
                    <td className="px-3 py-2 tabular">
                      {s.eg.isCointegrated5 ? <span className="text-(--color-good)">✔</span> : <span className="text-(--color-bad)">✘</span>}
                    </td>
                    <td className="px-3 py-2 tabular">
                      {!s.kpss.reject5 ? <span className="text-(--color-good)">✔</span> : <span className="text-(--color-bad)">✘</span>}
                    </td>
                    <td className="px-3 py-2 tabular text-(--color-fg)">{s.ouFit.halfLife ? num(s.ouFit.halfLife, 1) : "—"}</td>
                    <td className="px-3 py-2 tabular text-(--color-fg)">{num(s.amihud, 2)}</td>
                    <td className="px-3 py-2 tabular text-(--color-fg)">{num(s.betaToMkt, 2)}</td>
                    <td className="px-3 py-2 tabular text-(--color-fg)">{s.bt ? num(s.bt.metrics.sharpe, 2) : "—"}</td>
                    <td className="px-3 py-2 tabular text-(--color-bad)">{pct(s.cvar95, 2)}</td>
                    <td className="px-3 py-2 tabular text-(--color-fg)">{num(s.ulcer, 4)}</td>
                    <td className="px-3 py-2 tabular text-(--color-fg)">${(s.capacityUsd / 1e6).toFixed(1)}M</td>
                    <td className={`px-3 py-2 tabular ${s.bt && s.bt.metrics.totalReturn >= 0 ? "text-(--color-good)" : "text-(--color-bad)"}`}>
                      {s.bt ? signedPct(s.bt.metrics.totalReturn, 1) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {passes ? (
                        <Badge tone="good">in book</Badge>
                      ) : !s.eg.isCointegrated5 ? (
                        <Badge tone="bad">not coint</Badge>
                      ) : s.amihud > amihudThreshold ? (
                        <Badge tone="bad">illiquid</Badge>
                      ) : (
                        <Badge tone="bad">slow</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-4 py-3 text-[11px] text-(--color-fg-muted)">
            Capacity is a conservative proxy: 1% of the mean dollar volume on the worse leg.
            Real-money trading should size against actual ADV percentage and impact-curve
            estimates (Almgren-Chriss). KPSS column shows ✔ when the spread fails to reject
            stationarity at 5% — a complementary stamp to the Engle-Granger column.
          </p>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Sizing — inverse-vol vs risk-parity</CardTitle>
          </CardHeader>
          <CardBody>
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <BarChart
                  data={passingPairs.map((id, i) => ({
                    pair: id,
                    iv: ivWeights[i] ?? 0,
                    rp: rpWeights[i] ?? 0,
                  }))}
                  margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
                >
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="pair" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => pct(v, 0)} />
                  <Tooltip />
                  <Bar dataKey="iv" name="inv-vol" fill="var(--color-info)" />
                  <Bar dataKey="rp" name="risk-parity" fill="var(--color-accent)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-(--color-fg-muted)">
              Inverse-volatility is the closed-form solution when strategies are
              uncorrelated; risk-parity adjusts for the off-diagonal covariance
              and matches when correlations are zero.
            </p>
          </CardBody>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Correlation of strategy returns</CardTitle>
          </CardHeader>
          <CardBody>
            {passingResults.length === 0 ? (
              <div className="py-10 text-center text-(--color-fg-muted)">
                No pairs in book.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[10.5px]">
                  <thead>
                    <tr>
                      <th></th>
                      {passingPairs.map((id) => (
                        <th key={id} className="px-1 pb-1.5 text-center font-mono text-(--color-fg-muted)">
                          {id.split("-")[0]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {corrMat.map((row, i) => (
                      <tr key={i}>
                        <td className="pr-2 text-right font-mono text-(--color-fg-muted)">
                          {passingPairs[i].split("-")[0]}
                        </td>
                        {row.map((c, j) => (
                          <td
                            key={j}
                            className="h-9 w-9 border border-(--color-bg)/30 px-0 py-0 text-center tabular text-(--color-fg)"
                            style={{ background: correlationToColour(c) }}
                            title={`${passingPairs[i]} vs ${passingPairs[j]}: ${c.toFixed(2)}`}
                          >
                            {c.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-(--color-fg-muted)">
              Daily P&amp;L correlations. Yellow = positive, red = negative.
              Clusters around 1.0 mean two pairs deliver effectively the same
              edge — risk-parity will down-weight the redundant ones.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
