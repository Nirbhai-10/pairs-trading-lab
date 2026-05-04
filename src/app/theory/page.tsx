import type { Metadata } from "next";
import { Tex } from "@/components/ui/Tex";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "Theory · Pairs Trading Lab",
  description:
    "Cointegration, ADF/MacKinnon, OLS and Kalman hedge ratios, OU half-life, Bertram bands, risk parity, Amihud illiquidity, walk-forward — derived end to end.",
};

function Section({
  num,
  title,
  blurb,
  children,
}: {
  num: string;
  title: string;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-(--color-border) py-14">
      <div className="mb-6 flex items-baseline gap-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-(--color-fg-faint)">
          {num}
        </span>
        <h2 className="text-2xl font-semibold tracking-tight text-(--color-fg)">{title}</h2>
      </div>
      {blurb ? <p className="mb-6 max-w-3xl text-(--color-fg-muted)">{blurb}</p> : null}
      <div className="prose-invert max-w-3xl space-y-5 text-[15px] leading-7 text-(--color-fg)">
        {children}
      </div>
    </section>
  );
}

function Eq({ children }: { children: string }) {
  return (
    <div className="my-2 overflow-x-auto rounded-md border border-(--color-border) bg-(--color-card)/60 px-4 py-3">
      <Tex display>{children}</Tex>
    </div>
  );
}

function Cite({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-(--color-fg-muted)">{children}</span>;
}

export default function TheoryPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 pb-24 pt-12">
      <header className="mb-8 max-w-3xl">
        <Badge tone="accent">theory</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
          The math behind every screen.
        </h1>
        <p className="mt-4 text-(--color-fg-muted)">
          A self-contained derivation of every model used in this Lab. Equations
          are rendered in KaTeX and link directly to the modules where they run
          live. Read top-to-bottom or skip — the sections are independent.
        </p>
      </header>

      <Section
        num="01"
        title="Why a pairs trade has a chance"
        blurb="The premise: two assets driven by a shared stochastic factor will, in equilibrium, walk together. If we can identify a stable linear combination that mean-reverts, we can fade short-term divergences and earn a small return that does not require a directional view."
      >
        <p>
          A single asset price is, to a first approximation, a martingale. The
          right thing to bet on is not its level but a deviation from a relationship.
          Engle and Granger {""}<Cite>(1987)</Cite> formalised the idea: two
          processes <Tex>{`x_t, y_t`}</Tex> that are individually <Tex>{`I(1)`}</Tex>
          {" "}(integrated of order 1) can have a linear combination
          {" "}<Tex>{`y_t - \\beta x_t`}</Tex> that is <Tex>{`I(0)`}</Tex>
          {" "}(stationary). The vector <Tex>{`(1, -\\beta)`}</Tex> is then
          called the <em>cointegration vector</em> and the residual{" "}
          <Tex>{`u_t = y_t - \\alpha - \\beta x_t`}</Tex> is the spread we trade.
        </p>
        <p>
          Sector neutrality is the practitioner&apos;s lever for keeping the relationship
          stable: if we pick A and B from inside the same industry, both prices share
          a sector factor and most macroeconomic shocks cancel. What is left to bet
          on is the idiosyncratic disagreement between A and B — usually a small,
          mean-reverting process.
        </p>
      </Section>

      <Section
        num="02"
        title="Cointegration via the Engle-Granger two-step"
        blurb="Estimate the long-run coefficient by OLS, then test the residuals for a unit root using ADF — but compare the test statistic to cointegration-specific critical values, not standard Dickey-Fuller."
      >
        <p>Step 1 — OLS regression in levels:</p>
        <Eq>{`y_t = \\alpha + \\beta\\, x_t + u_t.`}</Eq>
        <p>
          Under cointegration the OLS estimator <Tex>{`\\hat\\beta`}</Tex> is{" "}
          <em>super-consistent</em>: it converges to the true long-run coefficient
          at rate <Tex>{`T`}</Tex> rather than the usual <Tex>{`\\sqrt{T}`}</Tex>,
          even when the regressors are I(1). That is what makes a simple
          rolling regression a viable real-time estimator.
        </p>
        <p>Step 2 — ADF on the residuals:</p>
        <Eq>{`\\Delta \\hat u_t = \\mu + \\gamma\\, \\hat u_{t-1} + \\sum_{i=1}^{p} \\phi_i\\, \\Delta \\hat u_{t-i} + \\varepsilon_t.`}</Eq>
        <p>
          Under <Tex>{`H_0: \\gamma = 0`}</Tex> the residual has a unit root and
          A and B are <em>not</em> cointegrated. The test statistic is the
          t-ratio on <Tex>{`\\hat\\gamma`}</Tex>. Critical values come from
          MacKinnon{" "}<Cite>(2010)</Cite>{" "}response surfaces — different from the standard
          Dickey-Fuller table because <Tex>{`\\hat u`}</Tex> is estimated, not
          observed:
        </p>
        <Eq>{`\\tau_q(T) = \\beta_\\infty + \\beta_1 / T + \\beta_2 / T^{2} + \\beta_3 / T^{3}.`}</Eq>
        <p>
          For two variables with a constant (case &quot;c&quot;):
          {" "}<Tex>{`\\tau_{0.05}(\\infty) = -3.336`}</Tex> versus the plain ADF{" "}
          <Tex>{`\\tau_{0.05}(\\infty) = -2.862`}</Tex>. The shift is real and
          ignoring it inflates false-positive cointegration calls. The Lab uses
          the cointegration CVs in <code>cointegration.ts</code> and the standard
          ADF CVs in <code>adf.ts</code>.
        </p>
      </Section>

      <Section
        num="03"
        title="ADF, intuition first"
        blurb="The Augmented Dickey-Fuller test asks one question: when the spread drifts away from its mean, does it pull itself back?"
      >
        <p>
          Consider an AR(1) process <Tex>{`u_t = \\rho u_{t-1} + \\varepsilon_t`}</Tex>.
          Subtract <Tex>{`u_{t-1}`}</Tex> from both sides:
        </p>
        <Eq>{`\\Delta u_t = (\\rho - 1)\\, u_{t-1} + \\varepsilon_t = \\gamma\\, u_{t-1} + \\varepsilon_t.`}</Eq>
        <p>
          If <Tex>{`|\\rho| < 1`}</Tex> then <Tex>{`\\gamma < 0`}</Tex>: a high
          {" "}<Tex>{`u_{t-1}`}</Tex> implies a negative expected change next bar
          — the spring pulls. If <Tex>{`\\rho = 1`}</Tex> then{" "}
          <Tex>{`\\gamma = 0`}</Tex>: no pull, random walk. The augmented form
          adds lagged differences to soak up serial correlation in the noise:
        </p>
        <Eq>{`\\Delta u_t = \\mu + \\gamma\\, u_{t-1} + \\sum_{i=1}^{p}\\phi_i\\, \\Delta u_{t-i} + \\varepsilon_t.`}</Eq>
        <p>
          The Lab uses MacKinnon&apos;s <Cite>(1996)</Cite> sample-size adjusted
          critical values, so a 60-bar window and a 1200-bar window are not
          held to the same threshold.
        </p>
      </Section>

      <Section
        num="04"
        title="Hedge ratio: OLS, rolling, Kalman"
        blurb="Three estimators for the same β, each with a different view of how stable the relationship is over time."
      >
        <p>
          <strong>Static OLS.</strong> The all-sample point estimate. Useful as
          a baseline, but assumes the cointegration coefficient is constant
          — which is rarely true once you cross months of data:
        </p>
        <Eq>{`\\hat\\beta = \\frac{\\sum_{t=1}^{T}(x_t - \\bar x)(y_t - \\bar y)}{\\sum_{t=1}^{T}(x_t - \\bar x)^{2}}.`}</Eq>
        <p>
          <strong>Rolling OLS.</strong> A window of length <Tex>{`w`}</Tex>{" "}
          slides forward; we recompute <Tex>{`\\hat\\beta_t`}</Tex> using only
          observations in the window <Tex>{`(t-w+1, t)`}</Tex>. Easy to reason
          about, breaks gracefully when the relationship shifts, and is what the
          Lab uses by default.
        </p>
        <p>
          <strong>Kalman filter.</strong> Treat the hedge ratio itself as a
          state that evolves slowly. Let{" "}
          <Tex>{`\\theta_t = \\begin{pmatrix}\\alpha_t \\\\ \\beta_t\\end{pmatrix}`}</Tex>
          {" "}with state and observation equations:
        </p>
        <Eq>{`\\theta_t = \\theta_{t-1} + w_t,\\quad w_t \\sim \\mathcal{N}(0, Q),`}</Eq>
        <Eq>{`y_t = F_t\\, \\theta_t + v_t,\\quad F_t = (1, x_t),\\quad v_t \\sim \\mathcal{N}(0, R).`}</Eq>
        <p>
          The standard recursion produces a posterior mean and covariance for
          the state at every bar. The process-noise scale <Tex>{`Q = \\delta I`}</Tex>{" "}
          controls adaptivity: a small <Tex>{`\\delta`}</Tex> keeps β nearly
          constant; a larger <Tex>{`\\delta`}</Tex> lets it follow regime shifts
          but at the cost of estimation noise. Predict-then-update:
        </p>
        <Eq>{`P_{t|t-1} = P_{t-1|t-1} + Q,\\quad S_t = F_t P_{t|t-1} F_t^\\top + R,`}</Eq>
        <Eq>{`K_t = P_{t|t-1} F_t^\\top / S_t,\\quad \\theta_{t|t} = \\theta_{t|t-1} + K_t(y_t - F_t \\theta_{t|t-1}).`}</Eq>
        <p>
          Elliott, van der Hoek & Malcolm{" "}<Cite>(2005)</Cite>{" "}is the
          textbook starting point for a state-space approach to mean-reverting
          spreads; Chan{" "}<Cite>(Algorithmic Trading, 2013)</Cite>{" "}gives the
          implementation that this Lab follows.
        </p>
      </Section>

      <Section
        num="05"
        title="The z-score signal"
        blurb="A single-line trading rule: enter when the spread is far from its rolling mean in standard-deviation units, exit when it returns."
      >
        <Eq>{`z_t = \\frac{S_t - \\mu_w(S_{t-w+1:t})}{\\sigma_w(S_{t-w+1:t})}.`}</Eq>
        <p>
          A long-spread entry triggers when <Tex>{`z_t \\le -z_{\\text{entry}}`}</Tex>{" "}
          and unwinds when <Tex>{`z_t \\ge -z_{\\text{exit}}`}</Tex>; the short-spread
          rule is the mirror image. Hard stops cap the worst case: a stop-loss
          when <Tex>{`|z_t| \\ge z_{\\text{stop}}`}</Tex> (the relationship has
          probably broken) and a time-stop after <Tex>{`H`}</Tex> bars (the
          mean reversion was supposed to have happened by now). The Backtest
          Studio surfaces all four levers as sliders.
        </p>
      </Section>

      <Section
        num="06"
        title="Ornstein-Uhlenbeck, half-life, and 'fast enough to trade'"
        blurb="Why some cointegrated pairs are still useless: their spread mean-reverts on a timescale that exceeds your patience."
      >
        <p>
          The continuous-time OU process is the canonical mean-reverting SDE:
        </p>
        <Eq>{`dS_t = \\theta(\\mu - S_t)\\, dt + \\sigma\\, dW_t.`}</Eq>
        <p>
          Discretise at unit step and run an AR(1) regression on the spread:
          {" "}<Tex>{`\\Delta S_t = a + b\\, S_{t-1} + \\varepsilon_t`}</Tex>.
          Then <Tex>{`b = -\\theta`}</Tex> and the half-life of mean reversion is
        </p>
        <Eq>{`t_{1/2} = \\frac{\\ln 2}{\\theta} = -\\frac{\\ln 2}{b}.`}</Eq>
        <p>
          A spread with <Tex>{`t_{1/2} = 5`}</Tex> bars closes half its gap in
          a week and is highly tradable; a spread with{" "}
          <Tex>{`t_{1/2} = 200`}</Tex> bars takes nearly a year and dies on costs.
          The Pair Lab plots the half-life and the Portfolio module screens out
          pairs whose half-life exceeds a user threshold.
        </p>
      </Section>

      <Section
        num="07"
        title="Optimal entry/exit: Bertram bands"
        blurb="Given the OU parameters and a fixed cost, what entry threshold maximises expected profit per unit time?"
      >
        <p>
          Bertram <Cite>(2010)</Cite> derives a closed-form expression for
          expected return per unit time as a function of the entry level{" "}
          <Tex>{`a`}</Tex> for a symmetric OU strategy:
        </p>
        <Eq>{`\\mu_R(a, c) = \\frac{2 a \\sigma_{\\rm OU} - c}{E[T(a)]}.`}</Eq>
        <p>
          The expected first-passage time <Tex>{`E[T(a)]`}</Tex> involves
          imaginary error functions, but the qualitative result is
          intuitive: if costs are small, the optimum is a tight band of about{" "}
          <Tex>{`\\pm 0.75\\,\\sigma`}</Tex>; as costs rise the optimum widens
          toward <Tex>{`\\pm 2\\sigma`}</Tex> and beyond. The Lab plots a
          numerical scan instead of the special-function form so the
          intuition is preserved without machinery.
        </p>
      </Section>

      <Section
        num="08"
        title="Risk parity sizing across pairs"
        blurb="Each pair contributes the same fraction of total portfolio variance. Sizing pairs by capital almost always overweights the noisiest one."
      >
        <p>
          Maillard, Roncalli & Teiletche{" "}<Cite>(2010)</Cite>{" "}define the
          equal-risk-contribution (ERC) portfolio as the <Tex>{`w \\succeq 0`}</Tex>{" "}
          with <Tex>{`\\sum w_i = 1`}</Tex> satisfying:
        </p>
        <Eq>{`w_i \\cdot (\\Sigma w)_i = w_j \\cdot (\\Sigma w)_j \\quad \\forall i,j.`}</Eq>
        <p>
          For uncorrelated strategies this collapses to inverse-volatility
          weighting <Tex>{`w_i \\propto 1/\\sigma_i`}</Tex>; for correlated
          strategies the iterative solver in <code>risk/sizing.ts</code> finds
          the fixed point. The Lab reports both.
        </p>
      </Section>

      <Section
        num="09"
        title="β-hedging vs dollar-neutrality"
        blurb="Two notions of 'neutral'. They are not the same and the difference matters during a sell-off."
      >
        <p>
          <strong>Dollar-neutral:</strong> equal dollar long, equal dollar short.
          Gross exposure is 100%, net dollar exposure is zero. Simple and
          symmetric, but the residual is exposed to whatever β-loading the
          two legs have to the broader market.
        </p>
        <p>
          <strong>β-hedged:</strong> for every $1 long in A, short $β in B,
          where β is the cointegration coefficient (often ≈ 1 for sector
          pairs but not always). Net <em>market</em> exposure is approximately
          zero, even if dollar exposure is asymmetric. Preferable when the
          two legs have different market betas.
        </p>
        <p>
          Both modes are available in the Backtest Studio. The Portfolio page
          reports residual β-to-market for the full book of pairs and flags
          drift away from sector neutrality.
        </p>
      </Section>

      <Section
        num="10"
        title="Amihud illiquidity"
        blurb="Even a perfect signal is worthless if the market cannot absorb your order. Amihud (2002) gives the cleanest single-number proxy."
      >
        <Eq>{`\\text{ILLIQ}_t = \\frac{|r_t|}{V_t},\\quad V_t = \\text{dollar volume traded on day } t.`}</Eq>
        <p>
          Higher ILLIQ means a one-dollar trade moves the price more — i.e.,
          a thinner book. The Portfolio module screens out pairs whose worse
          leg sits above a percentile threshold, on the principle that any
          edge gets eaten by impact and slippage in illiquid names.
        </p>
      </Section>

      <Section
        num="11"
        title="Walk-forward methodology"
        blurb="The minimum acceptable backtest discipline: parameters chosen on data the strategy never sees during execution."
      >
        <p>
          Pure in-sample testing is worthless because every parameter — the
          z-entry, the lookback, the stop-loss — is implicitly chosen with
          knowledge of the future. Walk-forward fixes this by splitting the
          sample into a sequence of (training, test) windows. Models are
          fit on training only; performance is recorded on test only; the
          window rolls forward.
        </p>
        <p>
          A second-best, lighter alternative — and the default in the Lab —
          is rolling estimation: the hedge ratio and z-score moments are
          re-estimated on every bar using only data up to that bar. This
          produces an honest equity curve at the cost of some statistical
          inefficiency in the early part of the sample.
        </p>
        <p>
          Do & Faff{" "}<Cite>(2010, 2012)</Cite>{" "}showed that pairs strategies
          identified by Gatev et al. delivered shrinking returns post-2002 once
          realistic costs and walk-forward selection were imposed. The Lab
          enforces both by default.
        </p>
      </Section>

      <Section
        num="12"
        title="References"
        blurb="The papers and books cited above, in alphabetical order."
      >
        <ul className="list-none space-y-2 pl-0 text-sm text-(--color-fg-muted)">
          <li>Amihud, Y. (2002). <em>Illiquidity and stock returns: cross-section and time-series effects.</em> Journal of Financial Markets 5, 31–56.</li>
          <li>Avellaneda, M. & Lee, J.-H. (2010). <em>Statistical arbitrage in the U.S. equities market.</em> Quantitative Finance 10, 761–782.</li>
          <li>Bertram, W. K. (2010). <em>Analytic solutions for optimal statistical arbitrage trading.</em> Physica A 389, 2234–2243.</li>
          <li>Chan, E. (2013). <em>Algorithmic Trading: Winning Strategies and Their Rationale.</em> Wiley.</li>
          <li>Do, B. & Faff, R. (2010). <em>Does simple pairs trading still work?</em> Financial Analysts Journal 66, 83–95.</li>
          <li>Do, B. & Faff, R. (2012). <em>Are pairs trading profits robust to trading costs?</em> Journal of Financial Research 35, 261–287.</li>
          <li>Elliott, R., van der Hoek, J. & Malcolm, W. (2005). <em>Pairs trading.</em> Quantitative Finance 5, 271–276.</li>
          <li>Engle, R. & Granger, C. (1987). <em>Co-integration and error correction: representation, estimation, and testing.</em> Econometrica 55, 251–276.</li>
          <li>Gatev, E., Goetzmann, W. & Rouwenhorst, G. (2006). <em>Pairs trading: performance of a relative-value arbitrage rule.</em> Review of Financial Studies 19, 797–827.</li>
          <li>MacKinnon, J. (1996). <em>Numerical distribution functions for unit root and cointegration tests.</em> Journal of Applied Econometrics 11, 601–618.</li>
          <li>MacKinnon, J. (2010). <em>Critical values for cointegration tests.</em> Queen&apos;s Economics Working Paper 1227.</li>
          <li>Maillard, S., Roncalli, T. & Teiletche, J. (2010). <em>The properties of equally weighted risk contribution portfolios.</em> Journal of Portfolio Management 36, 60–70.</li>
          <li>Vidyamurthy, G. (2004). <em>Pairs Trading: Quantitative Methods and Analysis.</em> Wiley.</li>
        </ul>
      </Section>
    </div>
  );
}
