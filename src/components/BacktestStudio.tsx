"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildUniverse, listPairSpecs } from "@/lib/data/synthetic";
import {
  DEFAULT_PARAMS,
  runBacktest,
  type BacktestParams,
  type BacktestResult,
  type HedgeModel,
  type SizingMode,
} from "@/lib/backtest/engine";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Slider } from "@/components/ui/Slider";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { num, pct, signedPct } from "@/lib/util/format";
import { RotateCcw } from "lucide-react";

function downsample<T>(arr: T[], target = 360): T[] {
  if (arr.length <= target) return arr;
  const stride = Math.ceil(arr.length / target);
  const out: T[] = [];
  for (let i = 0; i < arr.length; i += stride) out.push(arr[i]);
  return out;
}

export function BacktestStudio() {
  const universe = useMemo(() => buildUniverse({ seed: "backtest-1" }), []);
  const [pairId, setPairId] = useState<string>(universe.pairs[0].spec.id);
  const [params, setParams] = useState<BacktestParams>(DEFAULT_PARAMS);

  const pair = universe.pairs.find((p) => p.spec.id === pairId) ?? universe.pairs[0];

  const result = useMemo(() => {
    try {
      return runBacktest(pair, params);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [pair, params]);

  const isError = "error" in result;
  const safeResult = isError ? null : (result as BacktestResult);

  const equityRows = useMemo(() => {
    if (!safeResult) return [] as { date: string; equity: number; z: number | null; position: number; peak: number }[];
    return downsample(
      pair.a.dates.map((d, i) => ({
        date: d,
        equity: safeResult.equity[i],
        z: safeResult.zScore[i],
        position: safeResult.position[i],
        peak: 0,
      })),
      480
    );
  }, [pair, safeResult]);

  const drawdownRows = useMemo(() => {
    if (!safeResult) return [] as { date: string; dd: number }[];
    let peak = 1;
    const arr: { date: string; dd: number }[] = [];
    for (let i = 0; i < safeResult.equity.length; i++) {
      if (safeResult.equity[i] > peak) peak = safeResult.equity[i];
      arr.push({ date: pair.a.dates[i], dd: -(peak - safeResult.equity[i]) / peak });
    }
    return downsample(arr, 480);
  }, [pair, safeResult]);

  const tradeHistogram = useMemo(() => {
    if (!safeResult) return [] as { p: number; count: number }[];
    const bins = 24;
    const pnls = safeResult.trades.map((t) => t.pnlFrac);
    if (pnls.length === 0) return [];
    const lo = Math.min(...pnls);
    const hi = Math.max(...pnls);
    const binW = (hi - lo) / bins || 0.01;
    const out: { p: number; count: number }[] = [];
    for (let i = 0; i < bins; i++) out.push({ p: lo + (i + 0.5) * binW, count: 0 });
    for (const p of pnls) {
      const idx = Math.min(bins - 1, Math.max(0, Math.floor((p - lo) / binW)));
      out[idx].count++;
    }
    return out;
  }, [safeResult]);

  const update = <K extends keyof BacktestParams>(k: K, v: BacktestParams[K]) =>
    setParams((p) => ({ ...p, [k]: v }));

  if (!safeResult) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-12">
        <Card>
          <CardBody>
            <div className="text-(--color-bad)">
              Backtest error: {(result as { error: string }).error}
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }
  const finalResult = safeResult;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-5 py-10">
      <header className="space-y-2">
        <Badge tone="accent">backtest studio</Badge>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Backtest Studio — every lever, in one place.
        </h1>
        <p className="max-w-3xl text-(--color-fg-muted)">
          Sliders for entry/exit, costs, slippage, exposure caps, drawdown
          limits, time-stops. Runs entirely in your browser. Costs are baked
          into daily returns so Sharpe and the equity curve agree.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Controls */}
        <Card className="lg:col-span-4">
          <CardHeader className="flex-wrap">
            <CardTitle>Parameters</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setParams(DEFAULT_PARAMS)}>
              <RotateCcw size={12} /> Reset
            </Button>
          </CardHeader>
          <CardBody className="space-y-5">
            <Select
              label="Pair"
              value={pairId}
              onChange={setPairId}
              options={listPairSpecs().map((s) => ({
                value: s.id,
                label: `${s.symbolA}/${s.symbolB} · ${s.sector} (${s.tag})`,
              }))}
            />

            <Select<HedgeModel>
              label="Hedge model"
              value={params.hedgeModel}
              onChange={(v) => update("hedgeModel", v)}
              options={[
                { value: "static", label: "Static OLS" },
                { value: "rolling", label: "Rolling OLS" },
                { value: "kalman", label: "Kalman filter" },
              ]}
            />

            <Select<SizingMode>
              label="Sizing"
              value={params.sizingMode}
              onChange={(v) => update("sizingMode", v)}
              options={[
                { value: "dollar-neutral", label: "Dollar-neutral" },
                { value: "beta-hedged", label: "β-hedged" },
              ]}
            />

            <Slider
              label="Hedge window"
              value={params.hedgeWindow ?? 60}
              min={20}
              max={252}
              step={5}
              digits={0}
              unit=" bars"
              hint={params.hedgeModel !== "rolling" ? "(only used for Rolling OLS)" : undefined}
              onChange={(v) => update("hedgeWindow", v)}
            />
            <Slider
              label="Z-score window"
              value={params.zWindow}
              min={20}
              max={252}
              step={5}
              digits={0}
              unit=" bars"
              onChange={(v) => update("zWindow", v)}
            />

            <div className="h-px bg-(--color-border)" />

            <Slider
              label="Z entry"
              value={params.zEntry}
              min={1}
              max={3.5}
              step={0.05}
              hint="enter long-spread when z ≤ −entry, short-spread when z ≥ +entry"
              onChange={(v) => update("zEntry", v)}
            />
            <Slider
              label="Z exit"
              value={params.zExit}
              min={0}
              max={2}
              step={0.05}
              hint="close when |z| crosses back through this level"
              onChange={(v) => update("zExit", v)}
            />
            <Slider
              label="Z stop-loss"
              value={params.zStop}
              min={2.5}
              max={6}
              step={0.1}
              onChange={(v) => update("zStop", v)}
            />
            <Slider
              label="Time stop"
              value={params.timeStop}
              min={5}
              max={120}
              step={1}
              digits={0}
              unit=" bars"
              onChange={(v) => update("timeStop", v)}
            />

            <div className="h-px bg-(--color-border)" />

            <Slider
              label="One-way cost"
              value={params.oneWayCostBps}
              min={0}
              max={20}
              step={0.5}
              digits={1}
              unit=" bps"
              hint="commissions per leg per fill"
              onChange={(v) => update("oneWayCostBps", v)}
            />
            <Slider
              label="Slippage"
              value={params.slippageBps}
              min={0}
              max={20}
              step={0.5}
              digits={1}
              unit=" bps"
              onChange={(v) => update("slippageBps", v)}
            />
            <Slider
              label="Drawdown stop"
              value={params.drawdownStop}
              min={0.05}
              max={0.6}
              step={0.01}
              digits={2}
              hint="strategy halts if equity drawdown exceeds this fraction"
              onChange={(v) => update("drawdownStop", v)}
            />
            <Slider
              label="Capital at risk"
              value={params.capitalAtRiskFraction}
              min={0.1}
              max={1}
              step={0.05}
              digits={2}
              onChange={(v) => update("capitalAtRiskFraction", v)}
            />
          </CardBody>
        </Card>

        {/* Results */}
        <div className="space-y-6 lg:col-span-8">
          <Card>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
              {finalResult.halted ? (
                <Badge tone="bad">halted by drawdown stop</Badge>
              ) : (
                <Badge tone="neutral">{finalResult.metrics.nTrades} trades</Badge>
              )}
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <Stat
                  label="Total return"
                  value={signedPct(finalResult.metrics.totalReturn, 1)}
                  tone={finalResult.metrics.totalReturn >= 0 ? "good" : "bad"}
                />
                <Stat label="CAGR" value={pct(finalResult.metrics.cagr, 2)}
                  tone={finalResult.metrics.cagr >= 0 ? "good" : "bad"} />
                <Stat label="Sharpe" value={num(finalResult.metrics.sharpe, 2)}
                  tone={finalResult.metrics.sharpe >= 0.5 ? "good" : finalResult.metrics.sharpe >= 0 ? "neutral" : "bad"} />
                <Stat label="Sortino" value={num(finalResult.metrics.sortino, 2)} />
                <Stat label="Max DD" value={pct(finalResult.metrics.maxDrawdown, 1)} tone="bad" />
                <Stat label="Calmar" value={num(finalResult.metrics.calmar, 2)} />
                <Stat label="Hit rate" value={pct(finalResult.metrics.hitRate, 1)} />
                <Stat label="Avg holding" value={num(finalResult.metrics.avgHoldingBars, 1)} hint="bars" />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 text-xs text-(--color-fg-muted) sm:grid-cols-3">
                <span>Vol (annualised) <span className="text-(--color-fg)">{pct(finalResult.metrics.annualVol, 1)}</span></span>
                <span>Costs paid <span className="text-(--color-fg)">{pct(finalResult.costsPaid, 2)}</span></span>
                <span>Total trades <span className="text-(--color-fg)">{finalResult.metrics.nTrades}</span></span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Equity curve</CardTitle>
              <Badge tone="neutral">starting capital = 1.0</Badge>
            </CardHeader>
            <CardBody>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <AreaChart data={equityRows} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="eqfill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                    <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                    <ReferenceLine y={1} stroke="var(--color-fg-faint)" strokeDasharray="3 3" />
                    <Tooltip />
                    <Area type="monotone" dataKey="equity" stroke="var(--color-accent)" strokeWidth={1.5}
                      fill="url(#eqfill)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Drawdown</CardTitle>
              <Badge tone="bad">stop @ {pct(params.drawdownStop, 0)}</Badge>
            </CardHeader>
            <CardBody>
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer>
                  <AreaChart data={drawdownRows} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ddfill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-bad)" stopOpacity={0} />
                        <stop offset="100%" stopColor="var(--color-bad)" stopOpacity={0.45} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                    <YAxis tick={{ fontSize: 10 }} domain={[-0.5, 0]} tickFormatter={(v: number) => pct(v, 0)} />
                    <Tooltip />
                    <ReferenceLine y={-params.drawdownStop} stroke="var(--color-bad)" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="dd" stroke="var(--color-bad)" strokeWidth={1.2}
                      fill="url(#ddfill)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Z-score with positions</CardTitle>
            </CardHeader>
            <CardBody>
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <ComposedChart data={equityRows} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                    <YAxis yAxisId="z" tick={{ fontSize: 10 }} domain={[-5, 5]} />
                    <YAxis yAxisId="pos" orientation="right" tick={{ fontSize: 10 }} domain={[-1.5, 1.5]} ticks={[-1, 0, 1]} />
                    <Tooltip />
                    <ReferenceLine y={params.zEntry} yAxisId="z" stroke="var(--color-accent)" strokeDasharray="3 3" />
                    <ReferenceLine y={-params.zEntry} yAxisId="z" stroke="var(--color-accent)" strokeDasharray="3 3" />
                    <ReferenceLine y={params.zExit} yAxisId="z" stroke="var(--color-good)" strokeDasharray="2 4" />
                    <ReferenceLine y={-params.zExit} yAxisId="z" stroke="var(--color-good)" strokeDasharray="2 4" />
                    <ReferenceLine y={params.zStop} yAxisId="z" stroke="var(--color-bad)" strokeDasharray="1 5" />
                    <ReferenceLine y={-params.zStop} yAxisId="z" stroke="var(--color-bad)" strokeDasharray="1 5" />
                    <Line yAxisId="z" type="monotone" dataKey="z" stroke="var(--color-accent)"
                      strokeWidth={1.2} dot={false} isAnimationActive={false} />
                    <Line yAxisId="pos" type="stepAfter" dataKey="position" stroke="var(--color-info)"
                      strokeWidth={1.2} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[10.5px] text-(--color-fg-muted)">
                <span>solid orange — z-score</span>
                <span>cyan step — position (−1 short / 0 flat / +1 long)</span>
                <span>orange dashed — entry bands ±{params.zEntry}</span>
                <span>green dashed — exit bands ±{params.zExit}</span>
                <span>red — stop-loss bands ±{params.zStop}</span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trade P&amp;L distribution</CardTitle>
            </CardHeader>
            <CardBody>
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer>
                  <BarChart data={tradeHistogram} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="p" tick={{ fontSize: 10 }} tickFormatter={(v: number) => pct(v, 1)} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <ReferenceLine x={0} stroke="var(--color-fg-faint)" />
                    <Bar dataKey="count" fill="var(--color-accent)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trade ledger</CardTitle>
              <Badge tone="neutral">{finalResult.trades.length} trades</Badge>
            </CardHeader>
            <CardBody className="overflow-auto p-0">
              <table className="w-full table-fixed text-xs">
                <thead className="bg-(--color-card-soft) text-left font-mono text-[10.5px] uppercase tracking-[0.14em] text-(--color-fg-faint)">
                  <tr>
                    <th className="w-[10%] px-4 py-2.5">Side</th>
                    <th className="w-[16%] px-4 py-2.5">Entry</th>
                    <th className="w-[16%] px-4 py-2.5">Exit</th>
                    <th className="w-[10%] px-4 py-2.5">Bars</th>
                    <th className="w-[10%] px-4 py-2.5">Z entry</th>
                    <th className="w-[10%] px-4 py-2.5">Z exit</th>
                    <th className="w-[12%] px-4 py-2.5 text-right">P&amp;L</th>
                    <th className="w-[16%] px-4 py-2.5">Reason</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {finalResult.trades.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-(--color-fg-muted)">
                        No trades — try lowering the entry threshold or widening windows.
                      </td>
                    </tr>
                  ) : (
                    finalResult.trades.slice(-30).reverse().map((t, i) => (
                      <tr key={i} className="border-t border-(--color-border) text-(--color-fg)">
                        <td className="px-4 py-2 text-(--color-fg-muted)">{t.side === "long-spread" ? "long" : "short"}</td>
                        <td className="px-4 py-2 text-(--color-fg-muted)">{t.entryDate}</td>
                        <td className="px-4 py-2 text-(--color-fg-muted)">{t.exitDate}</td>
                        <td className="px-4 py-2 tabular">{t.bars}</td>
                        <td className="px-4 py-2 tabular">{num(t.entryZ, 2)}</td>
                        <td className="px-4 py-2 tabular">{num(t.exitZ, 2)}</td>
                        <td className={`px-4 py-2 text-right tabular ${t.pnlFrac >= 0 ? "text-(--color-good)" : "text-(--color-bad)"}`}>
                          {signedPct(t.pnlFrac, 2)}
                        </td>
                        <td className="px-4 py-2 text-(--color-fg-muted)">{t.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {finalResult.trades.length > 30 ? (
                <div className="px-4 py-3 font-mono text-[10.5px] text-(--color-fg-faint)">
                  showing the most recent 30 of {finalResult.trades.length} trades
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
