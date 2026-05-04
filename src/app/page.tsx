import Link from "next/link";
import { Pipeline } from "@/components/Pipeline";
import { HeroPreview } from "@/components/HeroPreview";
import { Tex } from "@/components/ui/Tex";
import { Badge } from "@/components/ui/Badge";
import {
  ArrowRight,
  BarChart3,
  Beaker,
  BookOpen,
  Layers,
  LineChart,
  Sigma,
} from "lucide-react";

const modules = [
  {
    href: "/pair-lab",
    title: "Pair Lab",
    icon: <Beaker size={16} />,
    summary:
      "Pick a pair, watch OLS and Kalman fight over the hedge ratio, see the spread, z-score, rolling-ADF and Bertram-band overlay live.",
    tag: "interactive",
  },
  {
    href: "/methods",
    title: "Methods",
    icon: <Sigma size={16} />,
    summary:
      "ADF + Engle-Granger + Johansen, KPSS (opposite null), Variance Ratio, Hurst, CUSUM — every test a desk runs before trusting a pair, side-by-side.",
    tag: "diagnostics",
  },
  {
    href: "/strategies",
    title: "Strategies",
    icon: <Layers size={16} />,
    summary:
      "Cointegration vs Distance method (Gatev-Goetzmann-Rouwenhorst) vs OU s-score (Avellaneda-Lee). Same pair, three trading rules, one chart.",
    tag: "comparison",
  },
  {
    href: "/backtest",
    title: "Backtest Studio",
    icon: <BarChart3 size={16} />,
    summary:
      "Walk-forward, every parameter tunable, costs baked into Sharpe, bootstrap CI, equity vs buy-and-hold, trade heatmap by entry-z × holding period.",
    tag: "tunable",
  },
  {
    href: "/risk-lab",
    title: "Risk Lab",
    icon: <Beaker size={16} />,
    summary:
      "VaR / CVaR, Ulcer, Pain, Sterling, information ratio, return-distribution moments, stationary-bootstrap Sharpe CI on every pair.",
    tag: "risk",
  },
  {
    href: "/portfolio",
    title: "Portfolio",
    icon: <Layers size={16} />,
    summary:
      "Risk-parity sizing, β-to-market, Amihud liquidity + KPSS screens, capacity proxy and a correlation-of-pairs heatmap.",
    tag: "ensemble",
  },
  {
    href: "/theory",
    title: "Theory",
    icon: <BookOpen size={16} />,
    summary:
      "23 sections: Engle-Granger, Johansen/VECM, ADF, KPSS, VR, Hurst, CUSUM, Kalman, OU half-life, Bertram bands, distance, s-score, risk metrics, bootstrap.",
    tag: "math",
  },
  {
    href: "/glossary",
    title: "Glossary",
    icon: <Sigma size={16} />,
    summary:
      "Plain-English definitions for every term used elsewhere in the Lab.",
    tag: "reference",
  },
  {
    href: "/pair-lab",
    title: "Demo data",
    icon: <LineChart size={16} />,
    summary:
      "Twelve synthetic pairs across twelve sectors — strong, moderate, weak, slow, volatile, structurally broken, independent — each with its own seeded RNG.",
    tag: "deterministic",
  },
] as const;

export default function HomePage() {
  return (
    <div className="bg-grid">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-(--color-border)">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-12 px-5 pb-20 pt-20 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <div className="mb-5 inline-flex items-center gap-2">
              <Badge tone="accent">ongoing research project</Badge>
              <Badge tone="neutral">deterministic synthetic data</Badge>
            </div>
            <h1 className="text-[44px] font-semibold leading-[1.04] tracking-tight md:text-[64px]">
              Sector-neutral
              <br />
              <span className="text-(--color-accent)">pairs trading</span>,
              <br />
              end to end.
            </h1>
            <p className="mt-6 max-w-xl text-base text-(--color-fg-muted)">
              An interactive lab built from the literature: cointegration via
              Engle-Granger, hedge ratios from rolling OLS and a Kalman filter,
              walk-forward backtests with realistic frictions, and risk-parity
              sizing across pairs. Bring no data — six pairs come pre-loaded.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/pair-lab"
                className="inline-flex h-11 items-center gap-2 rounded-md bg-(--color-accent) px-5 text-sm font-semibold text-(--color-bg) transition-opacity hover:opacity-90"
              >
                Open Pair Lab
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/backtest"
                className="inline-flex h-11 items-center gap-2 rounded-md border border-(--color-border) px-5 text-sm font-medium text-(--color-fg) transition-colors hover:border-(--color-border-strong) hover:bg-(--color-card-soft)"
              >
                Run a backtest
              </Link>
              <Link
                href="/theory"
                className="inline-flex h-11 items-center gap-2 px-2 text-sm text-(--color-fg-muted) transition-colors hover:text-(--color-fg)"
              >
                Read the theory →
              </Link>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-3 font-mono text-[12.5px] text-(--color-fg-muted) sm:grid-cols-3">
              <div className="rounded-md border border-(--color-border) bg-(--color-card)/60 px-3 py-3">
                <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-(--color-fg-faint)">
                  cointegration vector
                </div>
                <Tex>{`y_t - \\beta\\, x_t \\sim I(0)`}</Tex>
              </div>
              <div className="rounded-md border border-(--color-border) bg-(--color-card)/60 px-3 py-3">
                <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-(--color-fg-faint)">
                  z-score signal
                </div>
                <Tex>{`z_t = (S_t - \\mu_w)/\\sigma_w`}</Tex>
              </div>
              <div className="rounded-md border border-(--color-border) bg-(--color-card)/60 px-3 py-3">
                <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-(--color-fg-faint)">
                  half-life (OU)
                </div>
                <Tex>{`t_{1/2} = \\ln 2 / \\theta`}</Tex>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <HeroPreview />
            <p className="mt-3 text-xs text-(--color-fg-faint)">
              Live render of the MEGA-WHEN synthetic spread. Bands at ±2σ, hedge
              ratio from full-sample OLS, z-score on a 60-day rolling window.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-(--color-border) bg-(--color-bg-soft)">
        <div className="mx-auto w-full max-w-7xl px-5 py-16">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-(--color-fg-faint)">
                01 / pipeline
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                From a price universe to a risk-managed book.
              </h2>
            </div>
            <p className="hidden max-w-md text-sm text-(--color-fg-muted) md:block">
              Six stages, each with its own page. The Lab walks the same
              pipeline a desk would: filter, fit, forecast, size, execute.
            </p>
          </div>
          <Pipeline />
        </div>
      </section>

      <section className="border-b border-(--color-border)">
        <div className="mx-auto w-full max-w-7xl px-5 py-16">
          <div className="mb-8">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-(--color-fg-faint)">
              02 / what&apos;s inside
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Six modules, one mental model.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((m) => (
              <Link
                key={m.title}
                href={m.href}
                className="group flex h-full flex-col justify-between rounded-[var(--radius-lg)] border border-(--color-border) bg-(--color-card) p-5 transition-colors hover:border-(--color-border-strong)"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="grid h-7 w-7 place-items-center rounded-md border border-(--color-border) bg-(--color-card-soft) text-(--color-accent)">
                      {m.icon}
                    </span>
                    <Badge tone="neutral">{m.tag}</Badge>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{m.title}</h3>
                  <p className="mt-2 text-sm text-(--color-fg-muted)">{m.summary}</p>
                </div>
                <span className="mt-5 inline-flex items-center gap-1.5 font-mono text-xs text-(--color-fg-muted) transition-colors group-hover:text-(--color-accent)">
                  open module <ArrowRight size={12} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-(--color-border) bg-(--color-bg-soft)">
        <div className="mx-auto w-full max-w-7xl px-5 py-16">
          <div className="mb-8">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-(--color-fg-faint)">
              03 / built on the literature
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              The papers behind every module.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                t: "Cointegration",
                a: "Engle & Granger (1987)",
                d: "Two-step procedure: estimate the long-run relationship, then test residuals for a unit root. Foundation of the entire pairs framework.",
              },
              {
                t: "Critical values",
                a: "MacKinnon (1996, 2010)",
                d: "Finite-sample response surfaces for ADF and cointegration test critical values. Used directly to compute T-adjusted thresholds in this app.",
              },
              {
                t: "Distance + cointegration",
                a: "Gatev, Goetzmann & Rouwenhorst (2006)",
                d: "Empirical demonstration that mean-reverting pairs delivered ~11% annualized excess return 1962–2002. The seminal benchmark.",
              },
              {
                t: "Time-varying β",
                a: "Elliott, van der Hoek & Malcolm (2005)",
                d: "Mean-reverting Gaussian state-space model — the textbook motivation for using a Kalman filter to estimate hedge ratios.",
              },
              {
                t: "Statistical arbitrage",
                a: "Avellaneda & Lee (2010)",
                d: "PCA / sector-residual approach with the s-score signal. Maps neatly onto the sector-neutral framing used here.",
              },
              {
                t: "Decline & costs",
                a: "Do & Faff (2010, 2012)",
                d: "Explicit decomposition showing how transaction costs gradually erode pairs profitability post-2002. Why the Backtest Studio takes costs seriously.",
              },
              {
                t: "OU thresholds",
                a: "Bertram (2010)",
                d: "Analytic optimal entry/exit bands for an Ornstein-Uhlenbeck spread under fixed costs. Reference for the band-suggestion overlay.",
              },
              {
                t: "Risk parity",
                a: "Maillard, Roncalli & Teiletche (2010)",
                d: "Equal-risk-contribution portfolio construction. Used in Portfolio to size pairs by risk rather than capital.",
              },
              {
                t: "Liquidity",
                a: "Amihud (2002)",
                d: "Daily price-impact-per-dollar-of-volume measure. Used here to filter out pairs whose worse leg is too thin to trade.",
              },
              {
                t: "Multivariate cointegration",
                a: "Johansen (1988, 1991)",
                d: "Trace and max-eigenvalue tests give the full rank of the cointegration space. The Methods page runs the 2-variable form against Osterwald-Lenum CVs.",
              },
              {
                t: "Stationarity null",
                a: "Kwiatkowski-Phillips-Schmidt-Shin (1992)",
                d: "Reverses the ADF null. A pair worth trading rejects ADF and fails to reject KPSS — the Lab requires both.",
              },
              {
                t: "Random walk null",
                a: "Lo & MacKinlay (1988)",
                d: "Variance ratio test with heteroskedasticity-robust z. The Methods page reports VR(q) at six horizons from 2 to 64.",
              },
              {
                t: "Self-similarity",
                a: "Hurst (1951), Mandelbrot (1969)",
                d: "Rescaled-range slope tells you whether a series is mean-reverting (H<0.5), random (H=0.5), or trending (H>0.5).",
              },
              {
                t: "Structural breaks",
                a: "Brown, Durbin & Evans (1975)",
                d: "CUSUM of recursive residuals with Brownian-motion bands. The Lab's primary breakdown-warning system.",
              },
              {
                t: "Tail risk",
                a: "Rockafellar & Uryasev (2002)",
                d: "Conditional VaR / Expected Shortfall — coherent risk measure used throughout the Risk Lab.",
              },
              {
                t: "Bootstrap",
                a: "Politis & Romano (1994)",
                d: "Stationary bootstrap with geometric block lengths. Honest standard errors on Sharpe under serial correlation.",
              },
            ].map((c) => (
              <div
                key={c.t}
                className="rounded-[var(--radius-lg)] border border-(--color-border) bg-(--color-card) p-5"
              >
                <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-(--color-fg-faint)">
                  {c.t}
                </div>
                <div className="mt-1.5 text-sm font-semibold text-(--color-fg)">{c.a}</div>
                <p className="mt-2 text-sm text-(--color-fg-muted)">{c.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-xs text-(--color-fg-faint)">
            Implementations are educational and audited against textbook
            results; the synthetic universe is constructed so OLS, ADF,
            Engle-Granger, OU and Kalman behave as theory predicts.
          </p>
        </div>
      </section>
    </div>
  );
}
