"use client";

import { cn } from "@/lib/util/cn";

interface Tab<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface TabsProps<T extends string> {
  value: T;
  options: ReadonlyArray<Tab<T>>;
  onChange: (v: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ value, options, onChange, className }: TabsProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-md border border-(--color-border) bg-(--color-card-soft) p-1",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-(--color-bg) text-(--color-fg) shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset]"
                : "text-(--color-fg-muted) hover:text-(--color-fg)"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
