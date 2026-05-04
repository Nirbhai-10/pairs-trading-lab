import { cn } from "@/lib/util/cn";

interface StatProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "neutral" | "good" | "bad" | "accent";
  className?: string;
}

export function Stat({ label, value, hint, tone = "neutral", className }: StatProps) {
  const toneClass = {
    neutral: "text-(--color-fg)",
    good: "text-(--color-good)",
    bad: "text-(--color-bad)",
    accent: "text-(--color-accent)",
  }[tone];
  return (
    <div className={cn("flex flex-col", className)}>
      <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-(--color-fg-faint)">
        {label}
      </span>
      <span className={cn("mt-1 tabular text-2xl font-semibold leading-tight", toneClass)}>
        {value}
      </span>
      {hint ? (
        <span className="mt-1 text-xs text-(--color-fg-muted)">{hint}</span>
      ) : null}
    </div>
  );
}
