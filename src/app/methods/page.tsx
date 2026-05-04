import type { Metadata } from "next";
import { Diagnostics } from "@/components/Diagnostics";

export const metadata: Metadata = {
  title: "Methods · Pairs Trading Lab",
  description:
    "ADF, KPSS, Variance Ratio, Hurst, CUSUM, Johansen — every test a desk runs before trusting a pair, side-by-side.",
};

export default function MethodsPage() {
  return <Diagnostics />;
}
