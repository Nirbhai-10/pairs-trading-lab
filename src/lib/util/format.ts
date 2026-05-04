// Display formatters used across the UI.

export function pct(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

export function num(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(digits);
}

export function compactNum(x: number): string {
  if (!Number.isFinite(x)) return "—";
  const abs = Math.abs(x);
  if (abs >= 1e9) return (x / 1e9).toFixed(1) + "B";
  if (abs >= 1e6) return (x / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return (x / 1e3).toFixed(1) + "K";
  return x.toFixed(0);
}

export function signed(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return "—";
  const s = x.toFixed(digits);
  return x >= 0 ? `+${s}` : s;
}

export function signedPct(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return "—";
  const s = (x * 100).toFixed(digits);
  return x >= 0 ? `+${s}%` : `${s}%`;
}
