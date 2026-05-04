import type { Metadata } from "next";
import { PairLab } from "@/components/PairLab";

export const metadata: Metadata = {
  title: "Pair Lab · Pairs Trading Lab",
  description:
    "Interactive cointegration explorer. OLS, rolling OLS, Kalman β, spread, z-score, rolling ADF p-value, distribution.",
};

export default function PairLabPage() {
  return <PairLab />;
}
