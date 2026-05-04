"use client";

import { cn } from "@/lib/util/cn";
import { ChevronDown } from "lucide-react";

interface SelectProps<T extends string> {
  label?: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
  className?: string;
}

export function Select<T extends string>({ label, value, options, onChange, className }: SelectProps<T>) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-(--color-fg-faint)">{label}</span>
      ) : null}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="h-9 w-full appearance-none rounded-[var(--radius)] border border-(--color-border) bg-(--color-card-soft) px-3 pr-9 text-sm text-(--color-fg) hover:border-(--color-border-strong) focus:outline-none focus:border-(--color-accent)"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-(--color-fg-muted)"
          size={14}
        />
      </div>
    </div>
  );
}
