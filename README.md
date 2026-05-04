# Pairs Trading Lab

> Sector-neutral mean reversion, end to end — an interactive lab for cointegration-based pairs trading.

Open the deployed Lab: **[pairs-trading-lab.vercel.app](https://pairs-trading-lab.vercel.app)** *(set after first deploy)*

## What it is

A self-contained, browser-only lab that walks through the full pipeline of a sector-neutral pairs strategy:

1. **Cointegration screening** via the Engle-Granger two-step, with MacKinnon (2010) finite-sample critical values.
2. **Hedge-ratio estimation** through three estimators: static OLS, rolling OLS, and a 2-state Kalman filter that lets β drift over time.
3. **Signal generation** with a rolling z-score of the spread, configurable entry / exit / stop-loss thresholds and a time-stop.
4. **Walk-forward backtesting** with realistic frictions: one-way commissions, slippage, exposure caps, drawdown halt, dollar-neutral or β-hedged sizing.
5. **Portfolio construction** with risk-parity weights (Maillard-Roncalli-Teiletche), Amihud (2002) illiquidity screens, half-life filters and a correlation-of-pairs heatmap.
6. **A 12-section theory page** with KaTeX-rendered derivations and a glossary, both linking back to the modules.

Every number is computed live in the browser from a deterministic synthetic universe — six pairs across six sectors, deliberately mixing strong, weak, structurally-broken and uncorrelated cases so the math behaves the way the textbooks promise.

## Pages

| Route | What it does |
| --- | --- |
| `/` | Hero, animated pipeline infographic, module index, paper citations. |
| `/theory` | 23 sections: Engle-Granger, ADF + MacKinnon, Johansen + VECM, KPSS, Variance Ratio, Hurst, CUSUM, OLS / rolling / Kalman, OU half-life, Bertram, distance method, Avellaneda-Lee s-score, risk parity, β-hedging, Amihud, walk-forward, extended risk metrics, stationary bootstrap, capacity. |
| `/pair-lab` | Pick a pair and explore prices, hedge ratios (3 estimators), spread, z-score, rolling-window ADF p-value, z-score distribution and Bertram-band optimisation surface. |
| `/methods` | One-screen diagnostics: ADF + Engle-Granger + Johansen + KPSS + Variance Ratio + Hurst + CUSUM + half-life sensitivity. |
| `/strategies` | Side-by-side: cointegration, distance method (Gatev-Goetzmann-Rouwenhorst), OU s-score (Avellaneda-Lee). Same pair, three rules, one chart. |
| `/backtest` | Sliders for every parameter; equity vs buy-and-hold and equal-weight, drawdown panel, z-with-positions overlay, trade ledger, **bootstrap CI on Sharpe**, **trade-PnL heatmap by entry-z × holding period**. |
| `/risk-lab` | VaR / CVaR (95 %, 99 %), Ulcer Index, Pain Ratio, Sterling, Information Ratio, return-distribution moments, stationary-bootstrap Sharpe distribution. |
| `/portfolio` | 12-pair book with risk-parity sizing, β-to-market exposure, KPSS + Amihud + half-life screens, capacity proxy, correlation-of-pairs heatmap. |
| `/glossary` | Plain-English definitions for every term used elsewhere in the Lab. |

## Architecture

```
src/
├── app/                      # Next.js App Router pages
├── components/               # UI shell + page-specific clients
│   └── ui/                   # Card, Stat, Slider, Button, Tabs, Tex (KaTeX), …
└── lib/
    ├── math/                 # ols, kalman, adf, cointegration, ou, zscore, linalg, stats
    ├── backtest/             # engine.ts (walk-forward + costs)
    ├── risk/                 # sizing.ts (risk parity, β, Amihud, correlation)
    ├── data/                 # synthetic.ts (deterministic 6-pair universe)
    └── util/
```

All math runs client-side; there are no server routes, no databases, no external API calls. The page set prerenders to static HTML at build time.

### Math implementations
- `ols.ts` — simple OLS, multiple OLS via `(XᵀX)⁻¹Xᵀy`, fast online rolling OLS.
- `adf.ts` — augmented Dickey-Fuller with intercept, MacKinnon (1996) finite-sample CVs and approximate p-values; rolling-window variant for breakdown filters.
- `cointegration.ts` — Engle-Granger two-step, MacKinnon (2010) cointegration CVs.
- `johansen.ts` — Johansen (1988, 1991) trace + max-eigenvalue, 2-variable form, Osterwald-Lenum (1992) CVs, cointegration vector recovery.
- `kpss.ts` — KPSS (Kwiatkowski-Phillips-Schmidt-Shin 1992) with Newey-West long-run variance and Andrews (1991) bandwidth.
- `varianceratio.ts` — Lo & MacKinlay (1988) with heteroskedasticity-robust z\*.
- `hurst.ts` — Hurst exponent via Mandelbrot-Wallis R/S analysis.
- `cusum.ts` — Brown, Durbin & Evans (1975) CUSUM with Brownian-motion bands.
- `kalman.ts` — 2-state filter for time-varying (α, β); textbook recursive form following Chan (2013).
- `ou.ts` — AR(1) fit on the spread, half-life closed form.
- `bertram.ts` — Bertram (2010) optimal entry/exit threshold via expected-hitting-time series.
- `halflife_window.ts` — half-life sensitivity to window length.
- `linalg.ts` — Gauss-Jordan solve and inverse, 2×2 specialised eigenvalue.
- `stats.ts` — Sharpe, Sortino, max drawdown, CAGR, Calmar, rolling mean / std.

### Strategies
- `backtest/engine.ts` — cointegration + rolling z-score (default).
- `strategies/distance.ts` — Gatev-Goetzmann-Rouwenhorst formation/trading windows.
- `strategies/sscore.ts` — Avellaneda-Lee single-factor s-score.

### Risk
- `risk/sizing.ts` — inverse-vol, risk-parity (ERC), β-to-benchmark, Amihud illiquidity, correlation matrix, portfolio covariance.
- `risk/metrics.ts` — VaR, CVaR/ES, Ulcer Index, Pain Ratio, Sterling, Information Ratio, return moments, max losing streak.
- `risk/bootstrap.ts` — Politis-Romano stationary bootstrap with geometric block lengths.

### Backtest engine
- Cost-aware: every cost is baked into daily returns so equity, Sharpe and the trade ledger agree.
- Walk-forward by default via rolling OLS; static OLS and Kalman are alternatives.
- Drawdown stop forces the book flat after a user-configured equity loss.
- Trade ledger records side, dates, bars held, entry/exit z-scores, β at entry, P&L (fraction) and exit reason (z-exit / stop / time-stop / forced-eod).

## Running locally

```bash
npm install
npm run dev            # http://localhost:3000
```

To re-verify the math:

```bash
npx tsx scripts/smoke.ts
```

## Tech stack

- **Next.js 16** (App Router, Turbopack), **React 19**
- **TypeScript** strict
- **Tailwind CSS 4** with `@theme` tokens
- **Recharts** for charts
- **KaTeX** for math rendering
- **seedrandom** for deterministic demo data
- No backend, no API calls, no telemetry

## References

The Lab is built on the literature; full citations are on the `/` and `/theory` pages. Headline papers:

- Engle, R. F. & Granger, C. W. J. (1987). *Co-integration and error correction.* Econometrica.
- MacKinnon, J. G. (1996). *Numerical distribution functions for unit root and cointegration tests.* J. Applied Econometrics.
- MacKinnon, J. G. (2010). *Critical values for cointegration tests.* Queen's Economics WP 1227.
- Gatev, E., Goetzmann, W. N. & Rouwenhorst, K. G. (2006). *Pairs trading: performance of a relative-value arbitrage rule.* Review of Financial Studies.
- Elliott, R. J., van der Hoek, J. & Malcolm, W. P. (2005). *Pairs trading.* Quantitative Finance.
- Avellaneda, M. & Lee, J.-H. (2010). *Statistical arbitrage in the U.S. equities market.* Quantitative Finance.
- Do, B. & Faff, R. (2010, 2012). *Does simple pairs trading still work?* / *Are pairs trading profits robust to costs?*
- Bertram, W. K. (2010). *Analytic solutions for optimal statistical arbitrage trading.* Physica A.
- Maillard, S., Roncalli, T. & Teiletche, J. (2010). *The properties of equally weighted risk contribution portfolios.* JPM.
- Amihud, Y. (2002). *Illiquidity and stock returns.* J. Financial Markets.
- Chan, E. (2013). *Algorithmic Trading: Winning Strategies and Their Rationale.* Wiley.

## Disclaimer

Built on synthetic data for demonstration. Not investment advice; not validated for live trading.
