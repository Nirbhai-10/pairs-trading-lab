import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pairs Trading Lab — sector-neutral mean reversion, end to end",
  description:
    "Cointegration tests, OLS and Kalman hedge ratios, walk-forward backtests, risk-parity sizing, β-hedging and Amihud screens — built from research, served as an interactive lab.",
  metadataBase: new URL("https://pairs-trading-lab.vercel.app"),
  openGraph: {
    title: "Pairs Trading Lab",
    description: "Sector-neutral pairs trading: OLS, Kalman, ADF, walk-forward.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
