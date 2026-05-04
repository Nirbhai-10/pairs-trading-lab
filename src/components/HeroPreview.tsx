"use client";

import { useMemo } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildUniverse } from "@/lib/data/synthetic";
import { engleGranger } from "@/lib/math/cointegration";
import { rollingZScore } from "@/lib/math/zscore";

interface PreviewProps {
  pairId?: string;
  height?: number;
}

export function HeroPreview({ pairId = "MEGA-WHEN", height = 240 }: PreviewProps) {
  const data = useMemo(() => {
    const u = buildUniverse({ seed: "preview-1" });
    const pair = u.pairs.find((p) => p.spec.id === pairId) ?? u.pairs[0];
    const lpA = pair.a.prices.map(Math.log);
    const lpB = pair.b.prices.map(Math.log);
    const eg = engleGranger(lpA, lpB, 1);
    const spread = lpA.map((v, i) => v - eg.hedgeRatio * lpB[i]);
    const z = rollingZScore(spread, 60).z;
    const stride = Math.max(1, Math.floor(spread.length / 360));
    const rows = pair.a.dates.map((d, i) => ({
      date: d,
      spread: spread[i],
      z: z[i],
    })).filter((_, i) => i % stride === 0);
    return { rows, eg, pair };
  }, [pairId]);

  return (
    <div className="rounded-[var(--radius-lg)] border border-(--color-border) bg-(--color-card)/60 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-(--color-fg-faint)">live preview</div>
          <div className="mt-0.5 text-sm text-(--color-fg)">
            {data.pair.spec.symbolA}
            <span className="mx-1.5 text-(--color-fg-faint)">/</span>
            {data.pair.spec.symbolB}
            <span className="ml-2 text-(--color-fg-muted)">{data.pair.spec.sector}</span>
          </div>
        </div>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-(--color-fg-faint)">
          z-score · spread
        </div>
      </div>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <ComposedChart data={data.rows} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
            <defs>
              <linearGradient id="zfill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 10 }} hide />
            <YAxis yAxisId="z" tick={{ fontSize: 10 }} domain={[-4, 4]} width={28} />
            <ReferenceLine y={2} yAxisId="z" stroke="var(--color-border-strong)" strokeDasharray="3 3" />
            <ReferenceLine y={-2} yAxisId="z" stroke="var(--color-border-strong)" strokeDasharray="3 3" />
            <ReferenceLine y={0} yAxisId="z" stroke="var(--color-border-strong)" />
            <Area
              yAxisId="z"
              type="monotone"
              dataKey="z"
              stroke="var(--color-accent)"
              fill="url(#zfill)"
              strokeWidth={1.4}
              isAnimationActive={false}
            />
            <Line
              yAxisId="z"
              type="monotone"
              dataKey="z"
              stroke="var(--color-accent)"
              strokeWidth={1.4}
              dot={false}
              isAnimationActive={false}
            />
            <Tooltip
              cursor={{ stroke: "var(--color-border-strong)" }}
              contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6 }}
              labelStyle={{ color: "var(--color-fg)" }}
              formatter={(v) => (typeof v === "number" ? v.toFixed(2) : String(v ?? ""))}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-3 font-mono text-[11px] text-(--color-fg-muted)">
        <span>β <span className="text-(--color-fg)">{data.eg.hedgeRatio.toFixed(3)}</span></span>
        <span>ADF τ <span className="text-(--color-fg)">{data.eg.adf.tStat.toFixed(2)}</span></span>
        <span>p≈ <span className="text-(--color-fg)">{data.eg.cointPValueApprox.toFixed(3)}</span></span>
      </div>
    </div>
  );
}
