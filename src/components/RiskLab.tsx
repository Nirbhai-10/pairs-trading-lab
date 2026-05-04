"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
  Area,
  AreaChart,
} from "recharts";
import { buildUniverse, listPairSpecs } from "@/lib/data/synthetic";
import { runBacktest, DEFAULT_PARAMS } from "@/lib/backtest/engine";
import { conditionalVaR, historicalVaR, informationRatio, maxConsecutiveLosses, moments, painRatio, sterlingRatio, ulcerIndex } from "@/lib/risk/metrics";
import { stationaryBootstrap } from "@/lib/risk/bootstrap";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Stat } from "@/components/ui/Stat";
import { Select } from "@/components/ui/Select";
import { num, pct, signedPct } from "@/lib/util/format";

export function RiskLab() {
  const universe = useMemo(() => buildUniverse({ seed: "risk-lab-1" }), []);
  const [pairId, setPairId] = useState<string>(universe.pairs[0].spec.id);
  const pair = universe.pairs.find((p) => p.spec.id === pairId) ?? universe.pairs[0];

  const r = useMemo(() => {
    const bt = runBacktest(pair, DEFAULT_PARAMS);
    const ret = bt.dailyReturn;
    const eq = bt.equity;
    const m = moments(ret);
    const var95 = historicalVaR(ret, 0.05);
    const var99 = historicalVaR(ret, 0.01);
    const cvar95 = conditionalVaR(ret, 0.05);
    const cvar99 = conditionalVaR(ret, 0.01);
    const ui = ulcerIndex(eq);
    const pr = painRatio(eq);
    const sr = sterlingRatio(eq);
    const mcl = maxConsecutiveLosses(ret);
    const ir = informationRatio(ret, universe.market.logReturns);
    const boot = stationaryBootstrap(ret, 400, 21, "risk-lab-bootstrap");
    // distribution histogram
    const bins = 40;
    const finite = ret.filter((v) => Number.isFinite(v) && v !== 0);
    const lo = finite.length ? Math.min(...finite) : -0.05;
    const hi = finite.length ? Math.max(...finite) : 0.05;
    const binW = (hi - lo) / bins || 0.001;
    const hist: { x: number; count: number }[] = [];
    for (let i = 0; i < bins; i++) hist.push({ x: lo + (i + 0.5) * binW, count: 0 });
    for (const v of finite) {
      const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / binW)));
      hist[idx].count++;
    }
    return { bt, m, var95, var99, cvar95, cvar99, ui, pr, sr, mcl, ir, boot, hist };
  }, [pair, universe.market.logReturns]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-5 py-10">
      <header className="space-y-2">
        <Badge tone="accent">risk lab</Badge>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Risk Lab — past Sharpe is the easy part.
        </h1>
        <p className="max-w-3xl text-(--color-fg-muted)">
          Pairs-trading P&amp;L is non-Gaussian. This page reports the metrics
          desks actually run after Sharpe: VaR, CVaR/Expected Shortfall,
          Ulcer Index, Pain &amp; Sterling ratios, information ratio, return-distribution
          moments, and a stationary-bootstrap CI on the Sharpe.
        </p>
        <div className="pt-2">
          <Select
            label="Pair"
            value={pairId}
            onChange={setPairId}
            options={listPairSpecs().map((s) => ({
              value: s.id,
              label: `${s.symbolA}/${s.symbolB} · ${s.sector} (${s.tag})`,
            }))}
            className="max-w-sm"
          />
        </div>
      </header>

      {/* Main metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Distributional risk</CardTitle>
          <Badge tone="neutral">historical, daily-bar</Badge>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 lg:grid-cols-8">
            <Stat label="Skew" value={num(r.m.skew, 2)} hint={r.m.skew < 0 ? "left-skewed" : "right-skewed"} />
            <Stat label="Excess kurt" value={num(r.m.excessKurtosis, 2)} hint="0 = Gaussian" />
            <Stat label="VaR 95%" value={pct(r.var95, 2)} tone="bad" />
            <Stat label="VaR 99%" value={pct(r.var99, 2)} tone="bad" />
            <Stat label="CVaR 95%" value={pct(r.cvar95, 2)} tone="bad" />
            <Stat label="CVaR 99%" value={pct(r.cvar99, 2)} tone="bad" />
            <Stat label="Ulcer idx" value={num(r.ui, 4)} />
            <Stat label="Max losing streak" value={String(r.mcl)} hint="consecutive losing bars" />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quality ratios</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 lg:grid-cols-5">
            <Stat label="Sharpe (point)" value={num(r.bt.metrics.sharpe, 2)} tone={r.bt.metrics.sharpe >= 0 ? "good" : "bad"} />
            <Stat label="Sortino" value={num(r.bt.metrics.sortino, 2)} />
            <Stat label="Calmar" value={num(r.bt.metrics.calmar, 2)} />
            <Stat label="Pain ratio" value={num(r.pr, 2)} />
            <Stat label="Sterling" value={num(r.sr, 2)} hint="ann. ret / avg ann. DD" />
          </div>
          <p className="mt-3 text-xs text-(--color-fg-muted)">
            Pain ratio = annual return / Ulcer Index. Sterling = annual return divided by
            the average yearly drawdown. Both are smoother than Calmar (which depends on a
            single worst-DD point) and tend to correlate better with subjective sleeplessness.
          </p>
        </CardBody>
      </Card>

      {/* Bootstrap */}
      <Card>
        <CardHeader>
          <CardTitle>Sharpe — stationary bootstrap CI</CardTitle>
          <Badge tone="neutral">400 resamples · block ≈ 21 bars</Badge>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            <Stat label="Median Sharpe" value={num(r.boot.sharpe.median, 2)} />
            <Stat label="90% CI" value={`${num(r.boot.sharpe.ci90[0], 2)}, ${num(r.boot.sharpe.ci90[1], 2)}`} hint="5th–95th percentile" />
            <Stat label="95% CI" value={`${num(r.boot.sharpe.ci95[0], 2)}, ${num(r.boot.sharpe.ci95[1], 2)}`} hint="2.5th–97.5th" />
            <Stat label="Median total" value={signedPct(r.boot.totalReturn.median, 1)} />
            <Stat label="Total 90% CI" value={`${signedPct(r.boot.totalReturn.ci90[0], 0)}, ${signedPct(r.boot.totalReturn.ci90[1], 0)}`} />
            <Stat label="Information ratio" value={num(r.ir, 2)} hint="vs market" />
          </div>
          <p className="mt-3 text-xs text-(--color-fg-muted)">
            Politis &amp; Romano (1994) stationary bootstrap: random block lengths
            preserve the strong-mixing property of the original return series so
            the implied Sharpe distribution is honest under serial correlation.
            A wide 95% CI on Sharpe is the simplest way to spot data-mined results.
          </p>
        </CardBody>
      </Card>

      {/* Return distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Daily-return distribution</CardTitle>
        </CardHeader>
        <CardBody>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={r.hist} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="x" tick={{ fontSize: 10 }} tickFormatter={(v: number) => pct(v, 1)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <ReferenceLine x={0} stroke="var(--color-fg-faint)" />
                <ReferenceLine x={r.var95} stroke="var(--color-bad)" strokeDasharray="3 3"
                  label={{ value: "VaR 95%", position: "top", fill: "var(--color-bad)", fontSize: 10 }} />
                <Bar dataKey="count" fill="var(--color-accent)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      {/* Bootstrap distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Bootstrap Sharpe distribution</CardTitle>
        </CardHeader>
        <CardBody>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <AreaChart
                data={(() => {
                  const samples = r.boot.sharpe.samples;
                  const bins = 40;
                  if (samples.length === 0) return [];
                  const lo = Math.min(...samples), hi = Math.max(...samples);
                  const binW = (hi - lo) / bins || 0.01;
                  const hist: { x: number; count: number }[] = [];
                  for (let i = 0; i < bins; i++) hist.push({ x: lo + (i + 0.5) * binW, count: 0 });
                  for (const v of samples) {
                    const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / binW)));
                    hist[idx].count++;
                  }
                  return hist;
                })()}
                margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="bootfill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-info)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-info)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="x" tick={{ fontSize: 10 }} tickFormatter={(v: number) => v.toFixed(2)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <ReferenceLine x={r.boot.sharpe.median} stroke="var(--color-accent)" strokeDasharray="3 3" />
                <Area dataKey="count" stroke="var(--color-info)" fill="url(#bootfill)" strokeWidth={1.4} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
