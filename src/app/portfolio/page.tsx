import type { Metadata } from "next";
import { Portfolio } from "@/components/Portfolio";

export const metadata: Metadata = {
  title: "Portfolio · Pairs Trading Lab",
  description: "Risk-parity sizing across pairs, β-to-market exposure, Amihud screens, correlation-of-pairs heatmap.",
};

export default function PortfolioPage() {
  return <Portfolio />;
}
