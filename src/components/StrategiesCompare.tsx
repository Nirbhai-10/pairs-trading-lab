"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildUniverse, listPairSpecs } from "@/lib/data/synthetic";
import { runBacktest, DEFAULT_PARAMS } from "@/lib/backtest/engine";
import { runDistanceBacktest } from "@/lib/strategies/distance";
import { runSScoreBacktest } from "@/lib/strategies/sscore";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Stat } from "@/components/ui/Stat";
import { Select } from "@/components/ui/Select";
import { num, pct, signedPct } from "@/lib/util/format";

function downsample<T>(arr: T[], target = 480): T[] {
  if (arr.length <= target) return arr;
  const stride = Math.ceil(arr.length / target);
  const out: T[] = [];
  for (let i = 0; i < arr.length; i += stride) out.push(arr[i]);
  return out;
}

const STRATEGY_INFO = {
  cointegration: {
    label: "Cointegration (Engle-Granger + z-score)",
    paper: "Engle-Granger 1987 / Vidyamurthy 2004",
    color: "var(--color-accent)",
  },
  distance: {
    label: "Distance method (Gatev-Goetzmann-Rouwenhorst)",
    paper: "Gatev, Goetzmann, Rouwenhorst 2006",
    color: "var(--color-info)",
  },
  sscore: {
    label: "OU s-score (Avellaneda-Lee single-factor)",
    paper: "Avellaneda & Lee 2010",
    color: "var(--color-good)",
  },
} as const;

export function StrategiesCompare() {
  const universe = useMemo(() => buildUniverse({ seed: "strategies-1" }), []);
  const [pairId, setPairId] = useState<string>(universe.pairs[0].spec.id);
  const pair = universe.pairs.find((p) => p.spec.id === pairId) ?? universe.pairs[0];

  const results = useMemo(() => {
    const ct = runBacktest(pair, DEFAULT_PARAMS);
    const dist = runDistanceBacktest(pair);
    const ss = runSScoreBacktest(pair);
    const dates = pair.a.dates;
    const rows = downsample(
      dates.map((d, i) => ({
        date: d,
        cointegration: ct.equity[i],
        distance: dist.equity[i],
        sscore: ss.equity[i],
      })),
      480,
    );
    return { ct, dist, ss, rows };
  }, [pair]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-5 py-10">
      <header className="space-y-2">
        <Badge tone="accent">strategies</Badge>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Three takes on the same pair.
        </h1>
        <p className="max-w-3xl text-(--color-fg-muted)">
          The cointegration approach (rolling OLS + z-score), the original
          empirical distance method (Gatev et al.), and the OU-equilibrium
          s-score (Avellaneda &amp; Lee) — all running on the same synthetic
          pair, with the same costs and slippage. Different views of the same
          truth often disagree on the easy pairs and converge on the hard ones.
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

      {/* Equity overlay */}
      <Card>
        <CardHeader>
          <CardTitle>Equity curves overlaid</CardTitle>
          <Badge tone="neutral">all start at 1.0</Badge>
        </CardHeader>
        <CardBody>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={results.rows} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                <ReferenceLine y={1} stroke="var(--color-fg-faint)" strokeDasharray="3 3" />
                <Tooltip />
                <Line type="monotone" dataKey="cointegration" stroke={STRATEGY_INFO.cointegration.color}
                  strokeWidth={1.6} dot={false} isAnimationActive={false} name="Cointegration" />
                <Line type="monotone" dataKey="distance" stroke={STRATEGY_INFO.distance.color}
                  strokeWidth={1.6} dot={false} isAnimationActive={false} name="Distance" />
                <Line type="monotone" dataKey="sscore" stroke={STRATEGY_INFO.sscore.color}
                  strokeWidth={1.6} dot={false} isAnimationActive={false} name="OU s-score" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      {/* Side-by-side metrics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {(["cointegration", "distance", "sscore"] as const).map((key) => {
          const m = key === "cointegration" ? results.ct.metrics
            : key === "distance" ? results.dist.metrics
            : results.ss.metrics;
          const eq = key === "cointegration" ? results.ct.equity
            : key === "distance" ? results.dist.equity
            : results.ss.equity;
          const info = STRATEGY_INFO[key];
          return (
            <Card key={key}>
              <CardHeader>
                <div>
                  <CardTitle>{info.label}</CardTitle>
                  <p className="mt-1 font-mono text-[10.5px] tracking-[0.14em] text-(--color-fg-faint)">{info.paper}</p>
                </div>
                <Badge tone="neutral">{m.nTrades} trades</Badge>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Stat
                    label="Total"
                    value={signedPct(m.totalReturn, 1)}
                    tone={m.totalReturn >= 0 ? "good" : "bad"}
                  />
                  <Stat label="Sharpe" value={num(m.sharpe, 2)} tone={m.sharpe >= 0 ? "good" : "bad"} />
                  <Stat label="Max DD" value={pct(m.maxDrawdown, 1)} tone="bad" />
                  <Stat label="Hit rate" value={pct(m.hitRate, 1)} />
                </div>
                <div style={{ width: "100%", height: 120 }}>
                  <ResponsiveContainer>
                    <AreaChart data={downsample(eq.map((v, i) => ({ i, v })), 240)}>
                      <defs>
                        <linearGradient id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={info.color} stopOpacity={0.45} />
                          <stop offset="100%" stopColor={info.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area dataKey="v" stroke={info.color} fill={`url(#fill-${key})`} strokeWidth={1.4} isAnimationActive={false} />
                      <ReferenceLine y={1} stroke="var(--color-fg-faint)" strokeDasharray="3 3" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* When each wins */}
      <Card>
        <CardHeader>
          <CardTitle>When each approach wins</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm text-(--color-fg-muted)">
          <p>
            <span className="text-(--color-accent)">Cointegration</span> is the textbook winner when the
            cointegration coefficient is stable and the spread reverts at a tractable speed —
            the rolling z-score adapts naturally as drift changes.
          </p>
          <p>
            <span className="text-(--color-info)">Distance method</span> requires no parametric
            assumptions and is the most robust to estimation noise. Its weakness is that it
            implicitly assumes β = 1, so it under-performs when α ≠ 1 or when the
            normalisation drifts (Do &amp; Faff 2010 traced most of its post-2002 decline to this).
          </p>
          <p>
            <span className="text-(--color-good)">OU s-score</span> shines when the spread really
            is well-described by an OU process: it standardises by the equilibrium dispersion
            rather than rolling moments, so signals are calibrated to the SDE rather than to
            the most-recent volatility regime. It performs poorly when (μ, σ_OU) shift mid-sample
            — e.g. on the &quot;Broken&quot; pair.
          </p>
          <p>
            Disagreement between the three is informative on its own: a pair that all three
            love is genuinely tradable; a pair that only one likes is suspicious.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
