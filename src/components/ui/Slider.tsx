"use client";

import { cn } from "@/lib/util/cn";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  digits?: number;
  hint?: string;
  onChange: (v: number) => void;
  className?: string;
}

export function Slider({ label, value, min, max, step, unit, digits = 2, hint, onChange, className }: SliderProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-(--color-fg-faint)">{label}</span>
        <span className="tabular text-sm font-medium text-(--color-fg)">
          {value.toFixed(digits)}
          {unit ? <span className="ml-0.5 text-(--color-fg-muted)">{unit}</span> : null}
        </span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-(--color-card-soft) accent-(--color-accent)
        [&::-webkit-slider-thumb]:appearance-none
        [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5
        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-(--color-accent)
        [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(245,165,36,0.18)]
        [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:border-0
        [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-(--color-accent)"
      />
      {hint ? (
        <span className="text-xs text-(--color-fg-muted)">{hint}</span>
      ) : null}
    </div>
  );
}
