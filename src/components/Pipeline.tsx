// Animated SVG pipeline showing the full pairs-trading flow.
// Pure presentation — runs client-side only because of the CSS animations.

"use client";

const steps = [
  { id: "universe", title: "Universe", subtitle: "Sector clusters", icon: "U" },
  { id: "cointegration", title: "Cointegration", subtitle: "Engle-Granger / ADF", icon: "𝜏" },
  { id: "hedge", title: "Hedge ratio", subtitle: "OLS · rolling · Kalman", icon: "β" },
  { id: "zscore", title: "Z-score", subtitle: "Rolling std", icon: "z" },
  { id: "execute", title: "Execute", subtitle: "Costs · slippage · stops", icon: "⊕" },
  { id: "size", title: "Size", subtitle: "Risk parity · β-hedge", icon: "Σ" },
] as const;

export function Pipeline() {
  return (
    <div className="relative">
      <style>{`
        @keyframes flow {
          0% { stroke-dashoffset: 14; opacity: 0.65; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes pulseDot {
          0%, 100% { transform: translateX(0%); opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }
        .flow-line {
          stroke-dasharray: 4 6;
          animation: flow 1.4s linear infinite;
        }
      `}</style>
      <svg
        viewBox="0 0 1080 220"
        className="w-full"
        role="img"
        aria-label="Pairs trading pipeline"
      >
        {steps.map((s, i) => {
          const x = 30 + i * 175;
          const y = 80;
          return (
            <g key={s.id}>
              {/* Card */}
              <rect x={x} y={y} width={150} height={84} rx={10}
                fill="var(--color-card)" stroke="var(--color-border)" />
              {/* Icon medallion */}
              <circle cx={x + 22} cy={y + 22} r={12} fill="var(--color-accent-soft)" stroke="var(--color-accent)" />
              <text x={x + 22} y={y + 26} textAnchor="middle" fontSize="13" fontFamily="var(--font-mono)" fill="var(--color-accent)">
                {s.icon}
              </text>
              {/* Title */}
              <text x={x + 42} y={y + 26} fontSize="13" fontWeight={600} fill="var(--color-fg)">
                {s.title}
              </text>
              {/* Subtitle */}
              <text x={x + 14} y={y + 56} fontSize="11" fontFamily="var(--font-mono)" fill="var(--color-fg-muted)">
                {s.subtitle}
              </text>
              {/* Step number */}
              <text x={x + 138} y={y + 78} textAnchor="end" fontSize="9" fontFamily="var(--font-mono)" fill="var(--color-fg-faint)">
                {String(i + 1).padStart(2, "0")}
              </text>
              {/* Connector to next */}
              {i < steps.length - 1 && (
                <line
                  x1={x + 150} y1={y + 42}
                  x2={x + 175} y2={y + 42}
                  stroke="var(--color-accent)"
                  strokeWidth={1.4}
                  className="flow-line"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              )}
            </g>
          );
        })}
        {/* Top label */}
        <text x={540} y={36} textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" fill="var(--color-fg-faint)" letterSpacing={2}>
          THE PIPELINE
        </text>
        {/* Bottom labels: "training" vs "execution" */}
        <line x1={30} y1={190} x2={555} y2={190} stroke="var(--color-border)" strokeDasharray="2 4" />
        <line x1={555} y1={190} x2={1050} y2={190} stroke="var(--color-border)" strokeDasharray="2 4" />
        <text x={290} y={206} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-fg-faint)">
          STATISTICAL EDGE
        </text>
        <text x={800} y={206} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-fg-faint)">
          RISK-MANAGED EXECUTION
        </text>
      </svg>
    </div>
  );
}
