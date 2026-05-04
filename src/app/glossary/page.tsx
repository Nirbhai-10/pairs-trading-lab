import type { Metadata } from "next";
import { Tex } from "@/components/ui/Tex";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "Glossary · Pairs Trading Lab",
  description: "Quick definitions: cointegration, hedge ratio, z-score, half-life, Sharpe, Calmar, Amihud, slippage and more.",
};

interface Term {
  t: string;
  short: string;
  body: React.ReactNode;
  cat: "stats" | "model" | "risk" | "execution";
}

const TERMS: Term[] = [
  {
    t: "Cointegration",
    short: "Two non-stationary series whose linear combination is stationary.",
    cat: "stats",
    body: (
      <>
        If <Tex>{`x_t, y_t`}</Tex> are both <Tex>{`I(1)`}</Tex> but{" "}
        <Tex>{`y_t - \\beta x_t \\sim I(0)`}</Tex>, the pair is cointegrated.
        That stationary spread is what we trade.
      </>
    ),
  },
  {
    t: "Hedge ratio",
    short: "The β that defines the spread.",
    cat: "model",
    body: (
      <>
        <Tex>{`\\hat\\beta`}</Tex> minimises the variance of{" "}
        <Tex>{`y_t - \\hat\\beta x_t`}</Tex>. Estimated via static OLS, rolling
        OLS, or a Kalman filter that lets β drift over time.
      </>
    ),
  },
  {
    t: "Z-score",
    short: "Standardised spread.",
    cat: "model",
    body: <Tex display>{`z_t = (S_t - \\mu_w) / \\sigma_w`}</Tex>,
  },
  {
    t: "Half-life",
    short: "Time for the spread to close half the gap.",
    cat: "model",
    body: (
      <>
        For an OU process with mean reversion speed <Tex>{`\\theta`}</Tex>:{" "}
        <Tex>{`t_{1/2} = \\ln 2 / \\theta`}</Tex>. Long half-lives die on
        transaction costs.
      </>
    ),
  },
  {
    t: "ADF test",
    short: "Tests whether a series has a unit root.",
    cat: "stats",
    body: (
      <>
        Reject the unit-root null when the t-statistic on{" "}
        <Tex>{`y_{t-1}`}</Tex> in the augmented regression is more negative
        than the MacKinnon critical value at the chosen level.
      </>
    ),
  },
  {
    t: "Engle-Granger",
    short: "Two-step cointegration test.",
    cat: "stats",
    body: (
      <>
        Estimate <Tex>{`y = \\alpha + \\beta x + u`}</Tex> by OLS, then run an
        ADF test on the residuals using cointegration-specific MacKinnon CVs.
      </>
    ),
  },
  {
    t: "Sharpe ratio",
    short: "Risk-adjusted return per unit of total volatility.",
    cat: "risk",
    body: <Tex display>{`\\text{Sharpe} = \\sqrt{252}\\, \\frac{\\bar r - r_f}{\\sigma_r}`}</Tex>,
  },
  {
    t: "Sortino ratio",
    short: "Like Sharpe but only penalises downside vol.",
    cat: "risk",
    body: <Tex display>{`\\text{Sortino} = \\sqrt{252}\\, \\frac{\\bar r - r_f}{\\sigma_{r_-}}`}</Tex>,
  },
  {
    t: "Maximum drawdown",
    short: "Worst peak-to-trough loss in the equity curve.",
    cat: "risk",
    body: <Tex display>{`\\text{MDD} = \\max_t \\frac{\\text{peak}_t - \\text{equity}_t}{\\text{peak}_t}`}</Tex>,
  },
  {
    t: "Calmar ratio",
    short: "CAGR ÷ max drawdown.",
    cat: "risk",
    body: (
      <>A complementary view to Sharpe: how much CAGR you got per unit of pain.</>
    ),
  },
  {
    t: "Risk parity",
    short: "Each strategy contributes equal risk to total variance.",
    cat: "risk",
    body: (
      <>
        Solves <Tex>{`w_i (\\Sigma w)_i = c\\;\\forall i`}</Tex>. Reduces to
        inverse-vol when strategies are uncorrelated.
      </>
    ),
  },
  {
    t: "Dollar-neutral",
    short: "Equal long and short dollar exposure.",
    cat: "execution",
    body: <>Simple, but does not hedge market β if the legs have different market exposures.</>,
  },
  {
    t: "β-hedged",
    short: "Net market β ≈ 0.",
    cat: "execution",
    body: (
      <>
        Size short leg as <Tex>{`\\beta`}</Tex> dollars per dollar long. Dollar
        exposure may be asymmetric, but the book is market-neutral in expectation.
      </>
    ),
  },
  {
    t: "Amihud illiquidity",
    short: "Daily price impact per dollar of volume.",
    cat: "execution",
    body: <Tex display>{`\\text{ILLIQ}_t = |r_t| / V_t`}</Tex>,
  },
  {
    t: "Slippage",
    short: "Difference between expected and realised fill price.",
    cat: "execution",
    body: <>Bigger orders, thinner books, faster moves all increase slippage. The Backtest Studio measures it in bps.</>,
  },
  {
    t: "Time stop",
    short: "Force-close a position after H bars.",
    cat: "execution",
    body: <>If mean reversion has not happened by your model&apos;s expected timeline, the relationship has likely shifted; cap the lossy tail.</>,
  },
  {
    t: "Walk-forward",
    short: "Out-of-sample testing methodology.",
    cat: "stats",
    body: <>Fit on training window; record performance on held-out test window; roll forward. The Lab uses rolling estimation as a lighter equivalent.</>,
  },
];

const CATS = {
  stats: "Statistics",
  model: "Modelling",
  risk: "Risk",
  execution: "Execution",
} as const;

export default function GlossaryPage() {
  const grouped: Record<keyof typeof CATS, Term[]> = {
    stats: [], model: [], risk: [], execution: [],
  };
  for (const t of TERMS) grouped[t.cat].push(t);

  return (
    <div className="mx-auto w-full max-w-7xl px-5 pb-24 pt-12">
      <header className="mb-10 max-w-3xl">
        <Badge tone="accent">glossary</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
          Quick definitions you can scan.
        </h1>
        <p className="mt-4 text-(--color-fg-muted)">
          Every term used elsewhere in the Lab, in plain English plus the formula
          where one exists.
        </p>
      </header>

      {(Object.keys(CATS) as (keyof typeof CATS)[]).map((c) => (
        <section key={c} className="mb-12">
          <div className="mb-4 flex items-baseline gap-3">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-(--color-fg-faint)">
              {CATS[c]}
            </span>
            <span className="font-mono text-[10.5px] text-(--color-fg-faint)">
              · {grouped[c].length} terms
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {grouped[c].map((term) => (
              <article
                key={term.t}
                className="rounded-[var(--radius-lg)] border border-(--color-border) bg-(--color-card) p-5"
              >
                <h3 className="text-base font-semibold text-(--color-fg)">{term.t}</h3>
                <p className="mt-1 text-sm text-(--color-fg-muted)">{term.short}</p>
                <div className="mt-3 text-sm text-(--color-fg)">{term.body}</div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
