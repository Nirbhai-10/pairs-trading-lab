// Half-life sensitivity to the rolling window length, used in /pair-lab.
// Re-fits OU on a rolling window and reports the implied half-life — useful
// because half-life is supposed to be a property of the pair, not of the
// window. Large variation across windows means the assumption is wobbly.

import { fitOu } from "./ou";

export function halfLifeAcrossWindows(
  spread: number[],
  windows = [60, 90, 126, 189, 252, 504],
): { window: number; halfLife: number | null }[] {
  const out: { window: number; halfLife: number | null }[] = [];
  for (const w of windows) {
    if (spread.length < w + 5) continue;
    const slice = spread.slice(spread.length - w);
    try {
      const fit = fitOu(slice);
      out.push({ window: w, halfLife: fit.halfLife });
    } catch {
      out.push({ window: w, halfLife: null });
    }
  }
  return out;
}
