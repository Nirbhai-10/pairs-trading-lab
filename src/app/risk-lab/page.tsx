import type { Metadata } from "next";
import { RiskLab } from "@/components/RiskLab";

export const metadata: Metadata = {
  title: "Risk Lab · Pairs Trading Lab",
  description:
    "VaR/CVaR, Ulcer Index, Pain Ratio, Sterling, Information Ratio, return-distribution moments, stationary-bootstrap Sharpe CI.",
};

export default function RiskLabPage() {
  return <RiskLab />;
}
