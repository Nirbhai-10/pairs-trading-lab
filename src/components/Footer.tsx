export function Footer() {
  return (
    <footer className="mt-24 border-t border-(--color-border) bg-(--color-bg)">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-5 py-8 text-xs text-(--color-fg-muted) md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono">pairs-trading-lab</span>
          <span className="text-(--color-fg-faint)">•</span>
          <span>Sector-neutral mean reversion, end to end.</span>
        </div>
        <div className="flex items-center gap-4 font-mono">
          <span className="text-(--color-fg-faint)">Built on synthetic data — not investment advice.</span>
          <a
            href="https://github.com/Nirbhai-10/pairs-trading-lab"
            target="_blank"
            rel="noreferrer"
            className="hover:text-(--color-fg)"
          >
            github ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
