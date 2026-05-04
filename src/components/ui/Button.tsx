import { cn } from "@/lib/util/cn";

type Variant = "primary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ className, variant = "outline", size = "md", ...props }: ButtonProps) {
  const variantClass = {
    primary:
      "bg-(--color-accent) text-(--color-bg) border border-(--color-accent) hover:opacity-90",
    ghost:
      "bg-transparent text-(--color-fg-muted) border border-transparent hover:text-(--color-fg) hover:bg-(--color-card-soft)",
    outline:
      "bg-transparent text-(--color-fg) border border-(--color-border) hover:border-(--color-border-strong) hover:bg-(--color-card-soft)",
  }[variant];
  const sizeClass = {
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-4 text-sm",
    lg: "h-11 px-6 text-base",
  }[size];
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variantClass,
        sizeClass,
        className
      )}
      {...props}
    />
  );
}
