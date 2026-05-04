// Rolling z-score on a spread series. NaN-safe leading window.

import { rollingMean, rollingStd } from "./stats";

export function rollingZScore(spread: number[], window: number): { mean: (number | null)[]; std: (number | null)[]; z: (number | null)[] } {
  const m = rollingMean(spread, window);
  const s = rollingStd(spread, window);
  const z: (number | null)[] = new Array(spread.length).fill(null);
  for (let i = 0; i < spread.length; i++) {
    const mi = m[i], si = s[i];
    if (mi == null || si == null || si === 0) continue;
    z[i] = (spread[i] - mi) / si;
  }
  return { mean: m, std: s, z };
}
