import type { Metadata } from "next";
import { StrategiesCompare } from "@/components/StrategiesCompare";

export const metadata: Metadata = {
  title: "Strategies · Pairs Trading Lab",
  description:
    "Side-by-side comparison of cointegration, distance method (Gatev-Goetzmann-Rouwenhorst) and OU s-score (Avellaneda-Lee).",
};

export default function StrategiesPage() {
  return <StrategiesCompare />;
}
