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
        title="Johansen and the VECM — when two assets is not enough"
        blurb="Engle-Granger asks 'is there a single cointegration vector, given a fixed regressor?' Johansen asks 'how many cointegration vectors exist among k variables?' For k = 2 they should agree; for k ≥ 3 only Johansen is correct."
      >
        <p>
          Stack the levels into <Tex>{`Y_t \\in \\mathbb{R}^k`}</Tex> and write the
          vector autoregression in error-correction form (VECM):
        </p>
        <Eq>{`\\Delta Y_t = \\Pi\\, Y_{t-1} + \\sum_{i=1}^{p-1} \\Gamma_i\\, \\Delta Y_{t-i} + \\mu + \\varepsilon_t.`}</Eq>
        <p>
          The rank of <Tex>{`\\Pi`}</Tex> equals the number of cointegration relations.
          Decomposing <Tex>{`\\Pi = \\alpha\\beta'`}</Tex>, the columns of{" "}
          <Tex>{`\\beta`}</Tex> are cointegration vectors; the rows of{" "}
          <Tex>{`\\alpha`}</Tex> are <em>loadings</em>: how fast each variable adjusts
          back toward equilibrium. The latter is the practical pay-off — Johansen tells
          you which leg leads and which leg lags.
        </p>
        <p>Johansen&apos;s trace test compares</p>
        <Eq>{`\\lambda_{\\rm trace}(r) = -T \\sum_{i=r+1}^{k} \\ln(1 - \\hat\\lambda_i)`}</Eq>
        <p>
          to Osterwald-Lenum (1992) critical values. The eigenvalues come from a
          generalised eigenvalue problem on residual second-moment matrices; the Lab
          implements the 2-variable case in <code>johansen.ts</code> and reports both the
          trace and max-eigenvalue statistics on the <a className="text-(--color-accent) underline" href="/methods">Methods</a> page.
        </p>
      </Section>

      <Section
        num="13"
        title="KPSS — the test with the opposite null"
        blurb="A pair that 'fails to reject the unit-root null' under ADF is consistent with stationarity but does not prove it. KPSS reverses the null and asks for direct evidence of stationarity."
      >
        <p>
          Kwiatkowski, Phillips, Schmidt & Shin (1992) construct a Lagrange-multiplier
          statistic
        </p>
        <Eq>{`\\eta_\\mu = T^{-2} \\sum_{t=1}^{T} S_t^2 \\,/\\, \\hat\\sigma_\\infty^2,\\quad S_t = \\sum_{j=1}^{t} \\hat e_j,`}</Eq>
        <p>
          where <Tex>{`\\hat\\sigma_\\infty^2`}</Tex> is the long-run variance estimated
          with a Newey-West kernel. Under the null of stationarity, <Tex>{`\\eta_\\mu`}</Tex>{" "}
          is bounded; under a unit-root alternative, the cumulative sum drifts and the
          statistic explodes. Critical values: <Tex>{`\\eta_{\\mu, 5\\%} = 0.463`}</Tex>.
          The cleanest pair-trading workflow uses ADF and KPSS together: a pair worth
          trading both rejects the unit-root null (ADF) and fails to reject the
          stationarity null (KPSS).
        </p>
      </Section>

      <Section
        num="14"
        title="Variance ratio — Lo & MacKinlay"
        blurb="A different angle on the same question: do increments compound like a random walk, or do they cancel?"
      >
        <p>
          Lo & MacKinlay (1988) propose
        </p>
        <Eq>{`\\mathrm{VR}(q) = \\frac{\\mathrm{Var}( r_t + r_{t-1} + \\ldots + r_{t-q+1} )}{q \\cdot \\mathrm{Var}(r_t)}.`}</Eq>
        <p>
          Under a random walk, <Tex>{`\\mathrm{VR}(q) \\to 1`}</Tex>. A value below 1 implies
          negative serial correlation — what we want from a tradable spread. The Lab
          reports the heteroskedasticity-robust z-statistic across multiple horizons{" "}
          <Tex>{`q \\in \\{2, 4, 8, 16, 32, 64\\}`}</Tex>, because a single horizon can be
          misleading when the spread mean-reverts at a specific timescale.
        </p>
      </Section>

      <Section
        num="15"
        title="Hurst exponent — the self-similarity slope"
        blurb="A geometric view of persistence. R/S plots are simple, robust, and intuitive."
      >
        <p>
          Take the spread, split it into non-overlapping chunks of length{" "}
          <Tex>{`n`}</Tex>, compute the rescaled range{" "}
          <Tex>{`R(n)/S(n)`}</Tex> for each. Then{" "}
          <Tex>{`E[R(n)/S(n)] \\sim c \\cdot n^H`}</Tex>, and{" "}
          <Tex>{`H`}</Tex> is the slope of <Tex>{`\\log(R/S)`}</Tex> on{" "}
          <Tex>{`\\log n`}</Tex>:
        </p>
        <ul className="ml-4 list-disc space-y-1 text-sm text-(--color-fg-muted)">
          <li><Tex>{`H = 0.5`}</Tex>: random walk.</li>
          <li><Tex>{`H < 0.5`}</Tex>: anti-persistent / mean-reverting (what we want).</li>
          <li><Tex>{`H > 0.5`}</Tex>: trending — bad news for a pairs strategy.</li>
        </ul>
        <p>
          Hurst is best used as a sanity check: tradable spreads almost always show{" "}
          <Tex>{`H \\in [0.30, 0.45]`}</Tex>; if your &quot;cointegrated&quot; pair returns
          0.55, something is wrong.
        </p>
      </Section>

      <Section
        num="16"
        title="CUSUM — when the relationship breaks"
        blurb="Brown, Durbin & Evans (1975) — the simplest tool for catching a regime change before the strategy bleeds out."
      >
        <p>
          Compute the standardised cumulative sum of recursive residuals,{" "}
          <Tex>{`W_t = \\sigma^{-1} \\sum_{j} w_j`}</Tex>. Under the null of stable parameters,{" "}
          <Tex>{`W_t`}</Tex> is approximately Brownian motion; bands{" "}
          <Tex>{`\\pm a \\sqrt{T}`}</Tex> grow linearly. An excursion outside the bands
          means the parameter you assumed was constant has shifted. The Lab plots the
          CUSUM with bands at the 5% level on the <a className="text-(--color-accent) underline" href="/methods">Methods</a> page —
          the &quot;Broken&quot; pair (PYRE-VALE) is constructed specifically so the bands
          are crossed at the regime break.
        </p>
      </Section>

      <Section
        num="17"
        title="Distance method — the original empirical recipe"
        blurb="Gatev, Goetzmann & Rouwenhorst (2006) — no parametric assumptions, no β, no ADF. Just normalise prices and trade divergences."
      >
        <p>
          Take a 12-month formation window, normalise both prices to start at 1, compute
          the sum of squared distances{" "}
          <Tex>{`\\mathrm{SSD} = \\sum_t (\\hat A_t - \\hat B_t)^2`}</Tex>. Pick the
          minimum-SSD pair (or use a ranked list) and trade in the next 6-month window.
          Open when the normalised spread diverges by{" "}
          <Tex>{`\\pm 2 \\sigma_{\\rm formation}`}</Tex> and close when it returns to zero.
        </p>
        <p>
          The strength of the method is robustness — there are no estimated parameters
          to over-fit. Its weakness, traced cleanly by Do & Faff (2010, 2012), is that
          it implicitly assumes <Tex>{`\\beta = 1`}</Tex>; it under-performs when α ≠ 1
          and is sensitive to the choice of normalisation reference point. The Lab runs
          it head-to-head with the cointegration approach on the{" "}
          <a className="text-(--color-accent) underline" href="/strategies">Strategies</a> page.
        </p>
      </Section>

      <Section
        num="18"
        title="Avellaneda-Lee s-score — the equilibrium standardisation"
        blurb="Where the rolling z-score asks 'is the spread far from its recent mean?', the s-score asks 'is the spread far from its OU equilibrium?'"
      >
        <p>
          Fit an Ornstein-Uhlenbeck process to the spread, recover{" "}
          <Tex>{`(\\mu_{\\rm OU}, \\sigma_{\\rm OU})`}</Tex>, and define
        </p>
        <Eq>{`s_t = \\frac{S_t - \\mu_{\\rm OU}}{\\sigma_{\\rm OU}}.`}</Eq>
        <p>
          Avellaneda & Lee (2010) propose <Tex>{`s_{\\rm open} = 1.25`}</Tex> and{" "}
          <Tex>{`s_{\\rm close} = 0.5`}</Tex>. The big advantage: signals are calibrated to
          the SDE, not to short-window noise. The big disadvantage: when{" "}
          <Tex>{`(\\mu_{\\rm OU}, \\sigma_{\\rm OU})`}</Tex> drift, the s-score keeps using
          stale parameters and either over- or under-trades. The Strategies page runs
          this side-by-side with the rolling z-score on the same pair.
        </p>
      </Section>

      <Section
        num="19"
        title="Risk metrics past Sharpe — VaR, CVaR, Ulcer, Pain, Sterling"
        blurb="Sharpe assumes Gaussian returns, equal sensitivity to upside and downside, and ignores path. Each of the metrics below relaxes a different assumption."
      >
        <p>
          <strong>VaR / CVaR.</strong>{" "}
          <Tex>{`\\mathrm{VaR}_\\alpha`}</Tex> is the α-quantile of the return
          distribution; <Tex>{`\\mathrm{CVaR}_\\alpha = E[r \\,|\\, r \\le \\mathrm{VaR}_\\alpha]`}</Tex>{" "}
          (Rockafellar-Uryasev, 2002) is the average loss in the tail beyond it. CVaR is a
          coherent risk measure; VaR is not.
        </p>
        <p>
          <strong>Ulcer Index</strong> (Martin & McCann 1989) measures depth and duration
          of drawdowns:
        </p>
        <Eq>{`\\mathrm{UI} = \\sqrt{\\frac{1}{T}\\sum_t \\mathrm{DD}_t^2}.`}</Eq>
        <p>
          <strong>Pain ratio</strong> = annual return / Ulcer Index.{" "}
          <strong>Sterling ratio</strong> = annual return divided by the average annual
          maximum drawdown — smoother than Calmar, which depends on a single worst-DD
          point.
        </p>
        <p>
          The Risk Lab computes all of these alongside the standard Sharpe / Sortino /
          Calmar trio and a stationary-bootstrap CI on the Sharpe.
        </p>
      </Section>

      <Section
        num="20"
        title="Stationary bootstrap — honest standard errors for serially-correlated returns"
        blurb="Naive bootstrap on serially-correlated returns under-estimates standard errors. The block bootstrap fixes this; the stationary bootstrap goes further by randomising block lengths."
      >
        <p>
          Politis & Romano (1994) draw block lengths from a geometric distribution with
          mean <Tex>{`1/p`}</Tex>, paste blocks together to length <Tex>{`T`}</Tex>, and
          re-compute the statistic of interest on each resample. Random block lengths
          preserve the strong-mixing property of the original series so the implied
          distribution of the Sharpe is asymptotically valid even when returns are not iid.
        </p>
        <p>
          A 95% bootstrap CI on the Sharpe is the simplest, most under-used antidote to
          data-mined backtests. A &quot;Sharpe of 1.2&quot; with a 95% CI of
          [−0.4, +2.5] is not what it looks like.
        </p>
      </Section>

      <Section
        num="21"
        title="Capacity and execution — the cost curve nobody puts in their backtest"
        blurb="Almgren-Chriss style square-root impact: doubling the order doesn't double the cost — it multiplies it by ~1.4."
      >
        <p>
          Real execution costs scale as{" "}
          <Tex>{`\\Delta P / P \\sim \\eta \\sigma \\sqrt{X / V_t}`}</Tex>, where{" "}
          <Tex>{`X`}</Tex> is the order size, <Tex>{`V_t`}</Tex> is daily volume,{" "}
          <Tex>{`\\sigma`}</Tex> is daily volatility and <Tex>{`\\eta`}</Tex> is a market
          constant near 1 (Almgren et al. 2005). The Lab&apos;s default flat-bps cost is a
          first approximation; the Portfolio page surfaces a per-pair capacity proxy of
          1% of mean dollar volume on the worse leg, and the Theory page recommends
          imposing a square-root impact term once the strategy is sized to a real book.
        </p>
        <p>
          Half-life and capacity interact: a fast-mean-reverting pair lets you turn over
          inventory inside the impact-decay window, so realised costs converge toward
          the spread crossing rather than the full impact curve.
        </p>
      </Section>

      <Section
        num="22"
        title="Where this Lab sits — and what it deliberately does not do"
        blurb="An honest map of scope."
      >
        <p>The Lab covers, end to end:</p>
        <ul className="ml-4 list-disc space-y-1 text-sm text-(--color-fg-muted)">
          <li>Single-pair cointegration via Engle-Granger, ADF and Johansen.</li>
          <li>Three hedge-ratio estimators (static OLS, rolling OLS, Kalman).</li>
          <li>Two complementary stationarity tests (KPSS) and two persistence diagnostics (VR, Hurst).</li>
          <li>Two regime-stability tools (rolling ADF p-value, Brown-Durbin-Evans CUSUM).</li>
          <li>Three trading recipes (cointegration z-score, distance method, OU s-score).</li>
          <li>Walk-forward backtesting with realistic costs, drawdown halt, time-stops.</li>
          <li>Risk-parity, β-hedged, dollar-neutral sizing.</li>
          <li>Full extended-risk panel + stationary-bootstrap CIs on Sharpe.</li>
        </ul>
        <p className="mt-4">It explicitly does not yet cover:</p>
        <ul className="ml-4 list-disc space-y-1 text-sm text-(--color-fg-muted)">
          <li>Copula-based pair dependence (Liew & Wu 2013, Krauss & Stübinger 2017).</li>
          <li>Hidden Markov / regime-switching models for breakdown detection.</li>
          <li>Cross-sectional PCA on a real equity universe (Avellaneda-Lee in full).</li>
          <li>Multi-leg baskets via Johansen with k ≥ 3 (the trace test scales, the rest needs UI).</li>
          <li>EM-based Kalman tuning for δ.</li>
          <li>Live Almgren-Chriss execution scheduling.</li>
        </ul>
        <p>
          Each of these is a natural next module — the Lab&apos;s structure separates
          math, data and UI cleanly so a pull request adding e.g. copula pair-trading
          is local to two files.
        </p>
      </Section>

      <Section
        num="23"
        title="References"
        blurb="The papers and books cited above, in alphabetical order."
      >
        <ul className="list-none space-y-2 pl-0 text-sm text-(--color-fg-muted)">
          <li>Almgren, R., Thum, C., Hauptmann, E. & Li, H. (2005). <em>Direct estimation of equity market impact.</em> Risk 18, 57–62.</li>
          <li>Amihud, Y. (2002). <em>Illiquidity and stock returns: cross-section and time-series effects.</em> Journal of Financial Markets 5, 31–56.</li>
          <li>Avellaneda, M. & Lee, J.-H. (2010). <em>Statistical arbitrage in the U.S. equities market.</em> Quantitative Finance 10, 761–782.</li>
          <li>Bertram, W. K. (2010). <em>Analytic solutions for optimal statistical arbitrage trading.</em> Physica A 389, 2234–2243.</li>
          <li>Brown, R. L., Durbin, J. & Evans, J. M. (1975). <em>Techniques for testing the constancy of regression relationships over time.</em> JRSS-B 37, 149–192.</li>
          <li>Chan, E. (2013). <em>Algorithmic Trading: Winning Strategies and Their Rationale.</em> Wiley.</li>
          <li>Do, B. & Faff, R. (2010). <em>Does simple pairs trading still work?</em> Financial Analysts Journal 66, 83–95.</li>
          <li>Do, B. & Faff, R. (2012). <em>Are pairs trading profits robust to trading costs?</em> Journal of Financial Research 35, 261–287.</li>
          <li>Elliott, R., van der Hoek, J. & Malcolm, W. (2005). <em>Pairs trading.</em> Quantitative Finance 5, 271–276.</li>
          <li>Engle, R. & Granger, C. (1987). <em>Co-integration and error correction: representation, estimation, and testing.</em> Econometrica 55, 251–276.</li>
          <li>Gatev, E., Goetzmann, W. & Rouwenhorst, G. (2006). <em>Pairs trading: performance of a relative-value arbitrage rule.</em> Review of Financial Studies 19, 797–827.</li>
          <li>Hurst, H. E. (1951). <em>Long-term storage capacity of reservoirs.</em> Trans. ASCE 116, 770–808.</li>
          <li>Johansen, S. (1988). <em>Statistical analysis of cointegration vectors.</em> Journal of Economic Dynamics and Control 12, 231–254.</li>
          <li>Johansen, S. (1991). <em>Estimation and hypothesis testing of cointegration vectors in Gaussian VAR models.</em> Econometrica 59, 1551–1580.</li>
          <li>Krauss, C. (2017). <em>Statistical arbitrage pairs trading strategies: Review and outlook.</em> Journal of Economic Surveys 31, 513–545.</li>
          <li>Kwiatkowski, D., Phillips, P. C. B., Schmidt, P. & Shin, Y. (1992). <em>Testing the null hypothesis of stationarity against the alternative of a unit root.</em> Journal of Econometrics 54, 159–178.</li>
          <li>Liew, R. Q. & Wu, Y. (2013). <em>Pairs trading: a copula approach.</em> Journal of Derivatives & Hedge Funds 19, 12–30.</li>
          <li>Lo, A. W. & MacKinlay, A. C. (1988). <em>Stock market prices do not follow random walks.</em> RFS 1, 41–66.</li>
          <li>MacKinnon, J. (1996). <em>Numerical distribution functions for unit root and cointegration tests.</em> Journal of Applied Econometrics 11, 601–618.</li>
          <li>MacKinnon, J. (2010). <em>Critical values for cointegration tests.</em> Queen&apos;s Economics Working Paper 1227.</li>
          <li>Maillard, S., Roncalli, T. & Teiletche, J. (2010). <em>The properties of equally weighted risk contribution portfolios.</em> Journal of Portfolio Management 36, 60–70.</li>
          <li>Martin, P. G. & McCann, B. B. (1989). <em>The Investor&apos;s Guide to Fidelity Funds.</em> Wiley.</li>
          <li>Osterwald-Lenum, M. (1992). <em>A note with quantiles of the asymptotic distribution of the maximum likelihood cointegration rank test statistics.</em> Oxford Bulletin of Economics and Statistics 54, 461–472.</li>
          <li>Politis, D. N. & Romano, J. P. (1994). <em>The stationary bootstrap.</em> JASA 89, 1303–1313.</li>
          <li>Rockafellar, R. T. & Uryasev, S. (2002). <em>Conditional value-at-risk for general loss distributions.</em> Journal of Banking & Finance 26, 1443–1471.</li>
          <li>Stübinger, J. & Endres, S. (2018). <em>Pairs trading with a mean-reverting jump-diffusion model on high-frequency data.</em> Quantitative Finance 18, 1735–1751.</li>
          <li>Vidyamurthy, G. (2004). <em>Pairs Trading: Quantitative Methods and Analysis.</em> Wiley.</li>
        </ul>
      </Section>
    </div>
  );
}
