"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
  ComposedChart,
} from "recharts";
import { buildUniverse, listPairSpecs } from "@/lib/data/synthetic";
import { ols } from "@/lib/math/ols";
import { adfTest } from "@/lib/math/adf";
import { engleGranger } from "@/lib/math/cointegration";
import { kpssTest } from "@/lib/math/kpss";
import { varianceRatio, varianceRatioProfile } from "@/lib/math/varianceratio";
import { hurstExponent } from "@/lib/math/hurst";
import { cusumOfMeans } from "@/lib/math/cusum";
import { johansen2 } from "@/lib/math/johansen";
import { fitOu } from "@/lib/math/ou";
import { halfLifeAcrossWindows } from "@/lib/math/halflife_window";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Stat } from "@/components/ui/Stat";
import { Select } from "@/components/ui/Select";
import { num } from "@/lib/util/format";

function downsample<T>(arr: T[], target = 480): T[] {
  if (arr.length <= target) return arr;
  const stride = Math.ceil(arr.length / target);
  const out: T[] = [];
  for (let i = 0; i < arr.length; i += stride) out.push(arr[i]);
  return out;
}

export function Diagnostics() {
  const universe = useMemo(() => buildUniverse({ seed: "diagnostics-1" }), []);
  const [pairId, setPairId] = useState<string>(universe.pairs[0].spec.id);
  const pair = universe.pairs.find((p) => p.spec.id === pairId) ?? universe.pairs[0];

  const computed = useMemo(() => {
    const lpA = pair.a.prices.map(Math.log);
    const lpB = pair.b.prices.map(Math.log);
    const fit = ols(lpA, lpB);
    const spread = lpA.map((v, i) => v - fit.beta * lpB[i]);
    const eg = engleGranger(lpA, lpB, 1);
    const adf = adfTest(spread, 1);
    const kpssRes = kpssTest(spread, "level");
    const vrSingle = varianceRatio(spread, 5);
    const vrProfile = varianceRatioProfile(spread, [2, 4, 8, 16, 32, 64]);
    const hurst = hurstExponent(spread);
    const cusum = cusumOfMeans(spread);
    const joh = johansen2(lpA, lpB);
    const ouFit = fitOu(spread);
    const halfWin = halfLifeAcrossWindows(spread);

    const cusumRows = downsample(
      pair.a.dates.map((d, i) => ({
        date: d,
        cusum: cusum.cusum[i],
        upper: cusum.upperBand[i],
        lower: cusum.lowerBand[i],
      })),
      480,
    );

    return {
      fit, eg, adf, kpssRes, vrSingle, vrProfile, hurst, cusum, joh, ouFit, halfWin, cusumRows,
    };
  }, [pair]);

  const c = computed;
  const cvKpss = 0.463; // 5%

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-5 py-10">
      <header className="space-y-2">
        <Badge tone="accent">methods · diagnostics</Badge>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Methods — five tests, one verdict.
        </h1>
        <p className="max-w-3xl text-(--color-fg-muted)">
          Most papers use ADF in isolation. Real desks stack tests with
          opposing nulls and complementary power. This page runs ADF +
          Engle-Granger, KPSS (opposite null), Variance Ratio (Lo-MacKinlay),
          Hurst (R/S), CUSUM (Brown-Durbin-Evans), and Johansen (full system)
          on the same spread, then summarises the verdict.
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

      {/* Verdict strip */}
      <Card>
        <CardHeader>
          <CardTitle>Verdict</CardTitle>
          <Badge tone="neutral">{pair.spec.id}</Badge>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 lg:grid-cols-7">
            <Stat
              label="ADF τ"
              value={num(c.adf.tStat, 2)}
              hint={`reject UR? ${c.adf.isStationary5 ? "yes" : "no"}`}
              tone={c.adf.isStationary5 ? "good" : "bad"}
            />
            <Stat
              label="Engle-Granger"
              value={c.eg.isCointegrated5 ? "✔" : "✘"}
              hint={`p≈${num(c.eg.cointPValueApprox, 3)}`}
              tone={c.eg.isCointegrated5 ? "good" : "bad"}
            />
            <Stat
              label="KPSS η"
              value={num(c.kpssRes.stat, 3)}
              hint={`stationary? ${!c.kpssRes.reject5 ? "yes" : "no"} (cv ${cvKpss})`}
              tone={!c.kpssRes.reject5 ? "good" : "bad"}
            />
            <Stat
              label="VR(5) z"
              value={num(c.vrSingle.z, 2)}
              hint={c.vrSingle.vr < 1 ? "mean-reverting" : "trending"}
              tone={c.vrSingle.vr < 1 ? "good" : "bad"}
            />
            <Stat
              label="Hurst H"
              value={num(c.hurst.hurst, 2)}
              hint={c.hurst.hurst < 0.5 ? "mean-reverting" : c.hurst.hurst > 0.5 ? "trending" : "random"}
              tone={c.hurst.hurst < 0.5 ? "good" : "bad"}
            />
            <Stat
              label="CUSUM"
              value={c.cusum.breached ? "break" : "stable"}
              hint={c.cusum.firstBreach != null ? `first @ ${pair.a.dates[c.cusum.firstBreach]}` : "no excursion"}
              tone={c.cusum.breached ? "bad" : "good"}
            />
            <Stat
              label="Johansen trace r=0"
              value={num(c.joh.traceR0, 1)}
              hint={`cv5% ${c.joh.cv5Trace.r0}`}
              tone={c.joh.rejectR0_5pct ? "good" : "bad"}
            />
          </div>
          <p className="mt-4 text-xs text-(--color-fg-muted)">
            Strong evidence: ADF rejects (small τ), Engle-Granger cointegrated, KPSS does
            <em> not</em> reject (η below cv), VR(5) below 1 with negative z, Hurst &lt; 0.5,
            CUSUM stable, Johansen trace rejects r=0. A pair that passes 6 of 7 is robust;
            anything below 4 is noise.
          </p>
        </CardBody>
      </Card>

      {/* Variance ratio profile */}
      <Card>
        <CardHeader>
          <CardTitle>Variance Ratio profile (Lo-MacKinlay)</CardTitle>
          <Badge tone="neutral">VR(q) at multiple horizons</Badge>
        </CardHeader>
        <CardBody>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <ComposedChart data={c.vrProfile} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="q" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="vr" domain={[0.4, 1.6]} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="z" orientation="right" tick={{ fontSize: 10 }} />
                <ReferenceLine yAxisId="vr" y={1} stroke="var(--color-fg-faint)" strokeDasharray="3 3" />
                <Tooltip />
                <Bar yAxisId="vr" dataKey="vr" name="VR(q)" fill="var(--color-accent)" />
                <Line yAxisId="z" type="monotone" dataKey="z" name="z*" stroke="var(--color-info)" strokeWidth={1.4} dot={{ r: 3 }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs text-(--color-fg-muted)">
            VR(q) &lt; 1 across multiple horizons is strong evidence of mean reversion;
            negative z-statistic at the same horizons makes it statistically reliable.
          </p>
        </CardBody>
      </Card>

      {/* CUSUM */}
      <Card>
        <CardHeader>
          <CardTitle>CUSUM of mean-shifts (Brown-Durbin-Evans 1975)</CardTitle>
          <Badge tone={c.cusum.breached ? "bad" : "good"}>
            {c.cusum.breached ? "structural break detected" : "no break"}
          </Badge>
        </CardHeader>
        <CardBody>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={c.cusumRows} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                <Tooltip />
                <ReferenceArea
                  y1={-Math.max(...c.cusumRows.map((r) => r.upper)) * 1.02}
                  y2={-1}
                  fill="var(--color-bad)"
                  fillOpacity={0.04}
                />
                <Line dataKey="upper" stroke="var(--color-bad)" strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} name="5% bound" />
                <Line dataKey="lower" stroke="var(--color-bad)" strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
                <Line dataKey="cusum" stroke="var(--color-accent)" strokeWidth={1.6} dot={false} isAnimationActive={false} name="CUSUM" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs text-(--color-fg-muted)">
            Brownian-motion-like envelope under H0 (constant β). The CUSUM crossing a
            band ⇒ the relationship has shifted and the spread is no longer the same statistical object.
          </p>
        </CardBody>
      </Card>

      {/* Hurst R/S plot */}
      <Card>
        <CardHeader>
          <CardTitle>Hurst exponent — R/S regression</CardTitle>
          <Badge tone="neutral">slope = H = {num(c.hurst.hurst, 3)}, R² = {num(c.hurst.rSquared, 3)}</Badge>
        </CardHeader>
        <CardBody>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={c.hurst.points.map((p) => ({ logN: Math.log(p.n).toFixed(2), logRS: Math.log(p.rs).toFixed(3) }))}
                margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="logN" tick={{ fontSize: 10 }} />
                <YAxis dataKey="logRS" tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                <Tooltip />
                <Line dataKey="logRS" stroke="var(--color-accent)" strokeWidth={1.6} dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs text-(--color-fg-muted)">
            log(R/S) on log(n). A 45° slope means H = 0.5 (random walk). H &lt; 0.5 is mean reversion
            — the property we want for a tradable spread.
          </p>
        </CardBody>
      </Card>

      {/* Half-life across windows */}
      <Card>
        <CardHeader>
          <CardTitle>Half-life sensitivity to window length</CardTitle>
          <Badge tone="neutral">OU fit on trailing windows</Badge>
        </CardHeader>
        <CardBody>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={c.halfWin} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="window" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="halfLife" name="half-life (bars)" fill="var(--color-info)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs text-(--color-fg-muted)">
            A robust pair shows similar half-life across windows. Wide variance ⇒ the
            mean-reversion speed is itself drifting (regime-shifting), and the OU model
            is being asked to do too much.
          </p>
        </CardBody>
      </Card>

      {/* Johansen panel */}
      <Card>
        <CardHeader>
          <CardTitle>Johansen — the multivariate sibling of Engle-Granger</CardTitle>
          <Badge tone="neutral">2-variable trace + max-eigenvalue</Badge>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-md border border-(--color-border) bg-(--color-card-soft) p-4">
              <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-(--color-fg-faint)">
                Trace test
              </div>
              <div className="space-y-1 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-(--color-fg-muted)">r ≤ 0</span>
                  <span className="text-(--color-fg)">{num(c.joh.traceR0, 2)} {c.joh.rejectR0_5pct ? <span className="text-(--color-good)">✔ reject</span> : <span className="text-(--color-bad)">fail</span>}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-(--color-fg-muted)">r ≤ 1</span>
                  <span className="text-(--color-fg)">{num(c.joh.traceR1, 2)} {c.joh.rejectR1_5pct ? <span className="text-(--color-good)">✔ reject</span> : <span className="text-(--color-fg-muted)">fail</span>}</span>
                </div>
                <div className="text-[10px] text-(--color-fg-faint)">cv5% r=0 = {c.joh.cv5Trace.r0}, r=1 = {c.joh.cv5Trace.r1}</div>
              </div>
            </div>
            <div className="rounded-md border border-(--color-border) bg-(--color-card-soft) p-4">
              <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-(--color-fg-faint)">
                Max-eigenvalue test
              </div>
              <div className="space-y-1 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-(--color-fg-muted)">r = 0 vs r = 1</span>
                  <span className="text-(--color-fg)">{num(c.joh.maxR0, 2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-(--color-fg-muted)">eigenvalues</span>
                  <span className="text-(--color-fg)">{c.joh.eigenvalues.map((l) => l.toFixed(3)).join(", ")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-(--color-fg-muted)">cointegration vector</span>
                  <span className="text-(--color-fg)">({c.joh.cointegrationVector[0].toFixed(2)}, {c.joh.cointegrationVector[1].toFixed(2)})</span>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-(--color-fg-muted)">
            Johansen estimates all cointegration vectors at once (no &quot;regress y on x&quot;
            asymmetry) and is the right tool when you have ≥ 3 assets. With 2 assets it
            should agree with Engle-Granger; with broken pairs it&apos;s typically the more
            forgiving test.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
