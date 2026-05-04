import { cn } from "@/lib/util/cn";

type Tone = "neutral" | "good" | "bad" | "accent" | "info";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = "neutral", children, ...props }: BadgeProps) {
  const toneClass = {
    neutral: "border-(--color-border) text-(--color-fg-muted) bg-(--color-card-soft)",
    good: "border-(--color-good)/40 text-(--color-good) bg-[color:var(--color-good)]/10",
    bad: "border-(--color-bad)/40 text-(--color-bad) bg-[color:var(--color-bad)]/10",
    accent: "border-(--color-accent)/40 text-(--color-accent) bg-(--color-accent-soft)",
    info: "border-(--color-info)/40 text-(--color-info) bg-[color:var(--color-info)]/10",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em]",
        toneClass,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
