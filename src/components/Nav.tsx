"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/util/cn";
import { Activity } from "lucide-react";

const ROUTES = [
  { href: "/", label: "Home" },
  { href: "/theory", label: "Theory" },
  { href: "/pair-lab", label: "Pair Lab" },
  { href: "/methods", label: "Methods" },
  { href: "/strategies", label: "Strategies" },
  { href: "/backtest", label: "Backtest" },
  { href: "/risk-lab", label: "Risk" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/glossary", label: "Glossary" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-(--color-border) bg-(--color-bg)/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md border border-(--color-border) bg-(--color-card)">
            <Activity size={14} className="text-(--color-accent)" />
          </span>
          <span className="font-mono text-sm tracking-tight">
            <span className="text-(--color-fg)">pairs-trading</span>
            <span className="text-(--color-fg-muted)">-lab</span>
          </span>
        </Link>
        <nav className="hidden gap-1 lg:flex">
          {ROUTES.map((r) => {
            const active =
              r.href === "/" ? pathname === "/" : pathname.startsWith(r.href);
            return (
              <Link
                key={r.href}
                href={r.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                  active
                    ? "bg-(--color-card-soft) text-(--color-fg)"
                    : "text-(--color-fg-muted) hover:text-(--color-fg)"
                )}
              >
                {r.label}
              </Link>
            );
          })}
        </nav>
        <a
          href="https://github.com/Nirbhai-10/pairs-trading-lab"
          target="_blank"
          rel="noreferrer"
          className="hidden font-mono text-xs text-(--color-fg-muted) transition-colors hover:text-(--color-fg) sm:inline"
        >
          source ↗
        </a>
      </div>
    </header>
  );
}
