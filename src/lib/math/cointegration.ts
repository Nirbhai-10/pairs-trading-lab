// Engle-Granger two-step cointegration test.
//
// Step 1: OLS y_t = α + β x_t + u_t.
// Step 2: ADF-style unit-root test on residuals û_t. The critical values are
// NOT the standard Dickey-Fuller CVs because û is not observed but estimated,
// which shifts the null distribution. We use MacKinnon (2010) Table 2 response-
// surface coefficients for cointegration with N=2 variables, case "c" (constant).
//
// Reference: J.G. MacKinnon, "Critical Values for Cointegration Tests,"
// Queen's Economics Department Working Paper No. 1227 (2010).

import { ols } from "./ols";
import { adfTest, type AdfResult } from "./adf";

// MacKinnon (2010) cointegration CVs, N=2 (one regressor), case "c".
const COINT_C = {
  "0.01":  { binf: -3.90001, b1: -10.534, b2: -30.03, b3: 0 },
  "0.05":  { binf: -3.33613, b1:  -5.967, b2:  -8.98, b3: 0 },
  "0.10":  { binf: -3.04445, b1:  -4.069, b2:  -5.73, b3: 0 },
} as const;

function cointCV(level: keyof typeof COINT_C, T: number): number {
  const c = COINT_C[level];
  return c.binf + c.b1 / T + c.b2 / (T * T) + c.b3 / (T * T * T);
}

export interface CointegrationResult {
  hedgeRatio: number;        // β from step 1
  intercept: number;         // α from step 1
  residuals: number[];
  rSquared: number;
  adf: AdfResult;            // ADF statistic on residuals (uses Dickey-Fuller CVs internally)
  cointCriticalValues: { "1%": number; "5%": number; "10%": number };
  cointPValueApprox: number; // re-approximated using cointegration CVs
  isCointegrated5: boolean;
  isCointegrated1: boolean;
}

export function engleGranger(y: number[], x: number[], lag = 1): CointegrationResult {
  const fit = ols(y, x);
  const adf = adfTest(fit.residuals, lag);
  const T = adf.nUsed;
  const cv1 = cointCV("0.01", T);
  const cv5 = cointCV("0.05", T);
  const cv10 = cointCV("0.10", T);

  let p: number;
  if (adf.tStat <= cv1) p = 0.005;
  else if (adf.tStat <= cv5) p = 0.01 + ((adf.tStat - cv1) / (cv5 - cv1)) * (0.05 - 0.01);
  else if (adf.tStat <= cv10) p = 0.05 + ((adf.tStat - cv5) / (cv10 - cv5)) * (0.10 - 0.05);
  else p = Math.min(0.99, 0.10 + (adf.tStat - cv10) * 0.10);
  if (!Number.isFinite(p)) p = 1;

  return {
    hedgeRatio: fit.beta,
    intercept: fit.alpha,
    residuals: fit.residuals,
    rSquared: fit.rSquared,
    adf,
    cointCriticalValues: { "1%": cv1, "5%": cv5, "10%": cv10 },
    cointPValueApprox: p,
    isCointegrated5: adf.tStat < cv5,
    isCointegrated1: adf.tStat < cv1,
  };
}
