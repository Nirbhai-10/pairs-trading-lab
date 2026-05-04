import type { Metadata } from "next";
import { BacktestStudio } from "@/components/BacktestStudio";

export const metadata: Metadata = {
  title: "Backtest Studio · Pairs Trading Lab",
  description:
    "Walk-forward backtesting with tunable entry/exit, costs, slippage, exposure caps, drawdown limits and time-stops.",
};

export default function BacktestPage() {
  return <BacktestStudio />;
}
