"use client";

import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildUniverse, listPairSpecs, type PairSpec } from "@/lib/data/synthetic";
import { ols, rollingOls } from "@/lib/math/ols";
import { kalmanHedge } from "@/lib/math/kalman";
import { engleGranger } from "@/lib/math/cointegration";
import { rollingZScore } from "@/lib/math/zscore";
import { fitOu } from "@/lib/math/ou";
import { rollingAdf } from "@/lib/math/adf";
import { bertramSurface, bertramOptimal } from "@/lib/math/bertram";
import { pairAmihud } from "@/lib/risk/sizing";
import { correlation } from "@/lib/math/stats";
import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/Tabs";
import { num, pct } from "@/lib/util/format";

// Down-sample: charts don't need 1260 points, ~360 looks identical and renders fast.
function downsample<T>(arr: T[], target = 360): T[] {
  if (arr.length <= target) return arr;
  const stride = Math.ceil(arr.length / target);
  const out: T[] = [];
  for (let i = 0; i < arr.length; i += stride) out.push(arr[i]);
  return out;
}

type ChartTab = "prices" | "beta" | "spread" | "zscore" | "adfwin" | "dist" | "bertram";

const TAB_OPTIONS: ReadonlyArray<{ value: ChartTab; label: string }> = [
  { value: "prices", label: "Prices" },
  { value: "beta", label: "Hedge ratio" },
  { value: "spread", label: "Spread" },
  { value: "zscore", label: "Z-score" },
  { value: "adfwin", label: "Rolling ADF" },
  { value: "dist", label: "Distribution" },
  { value: "bertram", label: "Bertram bands" },
];

const tone = (tag: PairSpec["tag"]): "good" | "info" | "neutral" | "bad" | "accent" => {
  switch (tag) {
    case "Strong": return "good";
    case "Moderate": return "info";
    case "Weak": return "accent";
    case "Volatile": return "accent";
    case "Slow": return "neutral";
    case "Broken": return "bad";
    case "Independent": return "neutral";
  }
};

export function PairLab() {
  const universe = useMemo(() => buildUniverse({ seed: "pair-lab-1" }), []);
  const [pairId, setPairId] = useState<string>(universe.pairs[0].spec.id);
  const [tab, setTab] = useState<ChartTab>("zscore");
  const [zWindow, setZWindow] = useState(60);
  const [hedgeWindow, setHedgeWindow] = useState(60);

  const pair = universe.pairs.find((p) => p.spec.id === pairId) ?? universe.pairs[0];

  const computed = useMemo(() => {
    const lpA = pair.a.prices.map(Math.log);
    const lpB = pair.b.prices.map(Math.log);

    const eg = engleGranger(lpA, lpB, 1);
    const fullOls = ols(lpA, lpB);
    const roll = rollingOls(lpA, lpB, hedgeWindow);
    const kal = kalmanHedge(lpA, lpB, { delta: 1e-4 });
    const spread = lpA.map((v, i) => v - fullOls.beta * lpB[i]);
    const z = rollingZScore(spread, zWindow).z;
    const ouFit = fitOu(spread);
    const rollAdf = rollingAdf(spread, 252, 1);

    // Normalised price levels for the price chart (start=100).
    const norm = (p: number[]) => p.map((v) => (v / p[0]) * 100);
    const aN = norm(pair.a.prices);
    const bN = norm(pair.b.prices);

    // Histogram of z-score
    const zClean = z.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const minZ = Math.min(-4, ...zClean);
    const maxZ = Math.max(4, ...zClean);
    const bins = 40;
    const binW = (maxZ - minZ) / bins;
    const histogram: { z: number; count: number }[] = [];
    for (let i = 0; i < bins; i++) histogram.push({ z: minZ + (i + 0.5) * binW, count: 0 });
    for (const v of zClean) {
      const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - minZ) / binW)));
      histogram[idx].count++;
    }

    // Build a unified row data structure for each chart, downsampled.
    const dates = pair.a.dates;
    const rows = dates.map((d, i) => ({
      date: d,
      i,
      a: aN[i],
      b: bN[i],
      olsBeta: fullOls.beta,
      rollBeta: roll.beta[i],
      kalBeta: kal.beta[i],
      spread: spread[i],
      z: z[i],
      adfP: rollAdf.pVal[i],
    }));

    const corr = correlation(pair.a.logReturns, pair.b.logReturns);
    const amihud = pairAmihud(pair);

    const bertSurface = bertramSurface(ouFit.theta, ouFit.sigmaOu, 0.0008);
    const bertOpt = bertramOptimal(ouFit.theta, ouFit.sigmaOu, 0.0008);
    return {
      eg, fullOls, ouFit, rows: downsample(rows, 480), histogram, corr, amihud,
      bertSurface, bertOpt,
    };
  }, [pair, zWindow, hedgeWindow]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-5 py-10">
      <header className="space-y-2">
        <Badge tone="accent">pair lab</Badge>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Pair Lab — every fit, every test, every spread.
        </h1>
        <p className="max-w-3xl text-(--color-fg-muted)">
          Pick a pair from the deck below. The Lab recomputes the cointegration
          test, hedge ratios from three estimators, the rolling spread, the
          z-score signal, the OU half-life and an Amihud illiquidity score —
          all client-side, on every change. For KPSS, VR, Hurst, CUSUM and
          Johansen on the same pair, see{" "}
          <Link href="/methods" className="text-(--color-accent) underline-offset-2 hover:underline">/methods</Link>.
        </p>
      </header>

      {/* Pair selector */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        {listPairSpecs().map((s) => {
          const active = s.id === pairId;
          return (
            <button
              key={s.id}
              onClick={() => setPairId(s.id)}
              className={`rounded-md border p-3 text-left transition-colors ${
                active
                  ? "border-(--color-accent) bg-(--color-accent-soft)"
                  : "border-(--color-border) bg-(--color-card) hover:border-(--color-border-strong)"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-(--color-fg)">
                  {s.symbolA}<span className="text-(--color-fg-faint)">/</span>{s.symbolB}
                </span>
                <Badge tone={tone(s.tag)}>{s.tag}</Badge>
              </div>
              <div className="mt-1 text-[11px] text-(--color-fg-muted)">{s.sector}</div>
            </button>
          );
        })}
      </div>

      {/* Stats strip */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{pair.spec.id} · {pair.spec.sector}</CardTitle>
            <p className="mt-2 max-w-3xl text-sm text-(--color-fg-muted)">{pair.spec.description}</p>
          </div>
          <div className="hidden items-center gap-3 font-mono text-[11px] text-(--color-fg-muted) md:flex">
            <span>seed&nbsp;<span className="text-(--color-fg)">pair-lab-1</span></span>
            <span>n&nbsp;<span className="text-(--color-fg)">{universe.nBars}</span></span>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 lg:grid-cols-7">
            <Stat
              label="OLS β"
              value={num(computed.fullOls.beta, 3)}
              hint={`R² ${num(computed.fullOls.rSquared, 3)}`}
            />
            <Stat
              label="ADF τ"
              value={num(computed.eg.adf.tStat, 2)}
              hint={`CV5% ${num(computed.eg.cointCriticalValues["5%"], 2)}`}
              tone={computed.eg.isCointegrated5 ? "good" : "bad"}
            />
            <Stat
              label="Cointegrated"
              value={computed.eg.isCointegrated5 ? "yes" : "no"}
              hint={`p≈${num(computed.eg.cointPValueApprox, 3)}`}
              tone={computed.eg.isCointegrated5 ? "good" : "bad"}
            />
            <Stat
              label="Half-life"
              value={computed.ouFit.halfLife ? `${num(computed.ouFit.halfLife, 1)}` : "—"}
              hint="bars"
            />
            <Stat
              label="OU θ"
              value={num(computed.ouFit.theta, 3)}
              hint="per period"
            />
            <Stat
              label="Returns ρ"
              value={num(computed.corr, 3)}
              hint="daily log-returns"
            />
            <Stat
              label="Amihud"
              value={num(computed.amihud, 2)}
              hint="worse-leg ×1e6"
            />
          </div>
        </CardBody>
      </Card>

      {/* Chart area */}
      <Card>
        <CardHeader className="flex-wrap">
          <div className="flex items-center gap-3">
            <CardTitle>Charts</CardTitle>
            <Tabs value={tab} options={TAB_OPTIONS} onChange={setTab} />
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px] text-(--color-fg-muted)">
            <label className="flex items-center gap-2">
              z-window
              <input
                type="range"
                min={20}
                max={120}
                step={5}
                value={zWindow}
                onChange={(e) => setZWindow(parseInt(e.target.value))}
                className="h-1 w-24 cursor-pointer accent-(--color-accent)"
              />
              <span className="text-(--color-fg)">{zWindow}</span>
            </label>
            <label className="flex items-center gap-2">
              hedge-window
              <input
                type="range"
                min={20}
                max={252}
                step={10}
                value={hedgeWindow}
                onChange={(e) => setHedgeWindow(parseInt(e.target.value))}
                className="h-1 w-24 cursor-pointer accent-(--color-accent)"
              />
              <span className="text-(--color-fg)">{hedgeWindow}</span>
            </label>
          </div>
        </CardHeader>
        <CardBody>
          <div style={{ width: "100%", height: 380 }}>
            <ResponsiveContainer>
              {tab === "prices" ? (
                <LineChart data={computed.rows} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                  <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="a" name={pair.spec.symbolA}
                    stroke="var(--color-accent)" strokeWidth={1.4} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="b" name={pair.spec.symbolB}
                    stroke="var(--color-info)" strokeWidth={1.4} dot={false} isAnimationActive={false} />
                </LineChart>
              ) : tab === "beta" ? (
                <LineChart data={computed.rows} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                  <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                  <Tooltip />
                  <ReferenceLine y={computed.fullOls.beta} stroke="var(--color-accent)" strokeDasharray="3 3"
                    label={{ value: `static OLS β = ${num(computed.fullOls.beta, 3)}`, position: "right", fill: "var(--color-accent)", fontSize: 10 }} />
                  <Line type="monotone" dataKey="rollBeta" name={`rolling OLS (w=${hedgeWindow})`}
                    stroke="var(--color-info)" strokeWidth={1.3} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="kalBeta" name="Kalman"
                    stroke="var(--color-good)" strokeWidth={1.3} dot={false} isAnimationActive={false} />
                </LineChart>
              ) : tab === "spread" ? (
                <ComposedChart data={computed.rows} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                  <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                  <Tooltip />
                  {(() => {
                    const sVals = computed.rows.map((r) => r.spread).filter(Number.isFinite) as number[];
                    const m = sVals.reduce((s, v) => s + v, 0) / sVals.length;
                    const sd = Math.sqrt(sVals.reduce((s, v) => s + (v - m) * (v - m), 0) / Math.max(1, sVals.length - 1));
                    return (
                      <>
                        <ReferenceLine y={m} stroke="var(--color-fg-faint)" strokeDasharray="3 3" />
                        <ReferenceArea y1={m - 2 * sd} y2={m + 2 * sd} fill="var(--color-accent)" fillOpacity={0.05} />
                      </>
                    );
                  })()}
                  <Line type="monotone" dataKey="spread" name="log-spread"
                    stroke="var(--color-accent)" strokeWidth={1.4} dot={false} isAnimationActive={false} />
                </ComposedChart>
              ) : tab === "zscore" ? (
                <ComposedChart data={computed.rows} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="zfill2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                  <YAxis tick={{ fontSize: 10 }} domain={[-5, 5]} />
                  <Tooltip />
                  <ReferenceArea y1={-2} y2={2} fill="var(--color-accent)" fillOpacity={0.06} />
                  <ReferenceLine y={2} stroke="var(--color-accent)" strokeDasharray="3 3" />
                  <ReferenceLine y={-2} stroke="var(--color-accent)" strokeDasharray="3 3" />
                  <ReferenceLine y={4} stroke="var(--color-bad)" strokeDasharray="2 4" />
                  <ReferenceLine y={-4} stroke="var(--color-bad)" strokeDasharray="2 4" />
                  <ReferenceLine y={0} stroke="var(--color-fg-faint)" />
                  <Area type="monotone" dataKey="z" stroke="none" fill="url(#zfill2)" isAnimationActive={false} />
                  <Line type="monotone" dataKey="z" name="z-score"
                    stroke="var(--color-accent)" strokeWidth={1.4} dot={false} isAnimationActive={false} />
                </ComposedChart>
              ) : tab === "adfwin" ? (
                <LineChart data={computed.rows} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 1]} />
                  <Tooltip />
                  <ReferenceLine y={0.05} stroke="var(--color-good)" strokeDasharray="3 3"
                    label={{ value: "p = 0.05", position: "right", fill: "var(--color-good)", fontSize: 10 }} />
                  <Line type="monotone" dataKey="adfP" name="rolling ADF p (252-bar)"
                    stroke="var(--color-info)" strokeWidth={1.3} dot={false} isAnimationActive={false} />
                </LineChart>
              ) : tab === "dist" ? (
                <BarChart data={computed.histogram} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="z" tick={{ fontSize: 10 }} tickFormatter={(v: number) => v.toFixed(1)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--color-accent)" />
                </BarChart>
              ) : (
                <LineChart data={computed.bertSurface} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="a" tick={{ fontSize: 10 }} tickFormatter={(v: number) => v.toFixed(1)}
                    label={{ value: "entry threshold a (σ_OU units)", position: "insideBottom", offset: -2, fill: "var(--color-fg-muted)", fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <ReferenceLine x={computed.bertOpt.entry} stroke="var(--color-accent)" strokeDasharray="3 3"
                    label={{ value: `a* = ${computed.bertOpt.entry.toFixed(2)}σ`, position: "top", fill: "var(--color-accent)", fontSize: 10 }} />
                  <Line type="monotone" dataKey="profit" stroke="var(--color-info)" strokeWidth={1.4} dot={false} isAnimationActive={false}
                    name="expected return / unit time" />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 text-xs text-(--color-fg-muted) sm:grid-cols-2">
            <div>
              <span className="font-mono text-(--color-fg-faint)">how to read it:</span>{" "}
              {tab === "prices" && "Both legs normalised to start at 100. Visually, cointegration looks like 'walking the dog on a leash'."}
              {tab === "beta" && "Static OLS is one number; rolling OLS adapts each window; Kalman adapts every bar via a state-space model with random-walk β."}
              {tab === "spread" && "log-spread S = log A − β log B. Mean and ±2σ band drawn from the full sample."}
              {tab === "zscore" && "Standardised spread. Bands at ±2σ and ±4σ — typical entry and stop-loss thresholds."}
              {tab === "adfwin" && "Rolling 252-bar ADF p-value on the residual. A spike above 0.05 is a regime warning."}
              {tab === "dist" && "Empirical distribution of the z-score. Heavy tails imply your z-stop matters."}
              {tab === "bertram" && `Bertram (2010) closed-form expected return per unit time as a function of entry threshold, given the fitted OU and a fixed cost. Optimum a* ≈ ${computed.bertOpt.entry.toFixed(2)}σ_OU.`}
            </div>
            <div>
              <span className="font-mono text-(--color-fg-faint)">truth:</span>{" "}
              constructed with α = {pair.spec.truth.alpha}, OU θ = {pair.spec.truth.ouTheta},
              σ = {pair.spec.truth.ouSigma}{" "}
              {pair.spec.truth.regimeBreak ? `with a regime break at ${pct(pair.spec.truth.regimeBreak, 0)} of the sample` : ""}.
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
