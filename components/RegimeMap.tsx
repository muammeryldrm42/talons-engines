import type { EngineDecision } from "@/lib/engine/types";

// Map signal space to the 0..100 plane: x = leadership (BTC-led → alt-led via
// altseason), y = risk appetite (fear → greed via Fear & Greed).
const ZONES: { key: string; label: string; x: number; y: number }[] = [
  { key: "CAPITULATION", label: "Capitulation", x: 30, y: 12 },
  { key: "RISK_OFF", label: "Risk-Off", x: 28, y: 35 },
  { key: "CHOP", label: "Chop", x: 50, y: 52 },
  { key: "BTC_LED_RISK_ON", label: "BTC Risk-On", x: 26, y: 80 },
  { key: "ALT_SEASON_RISK_ON", label: "Alt Risk-On", x: 78, y: 84 },
];

const W = 300, H = 165, PAD = 26;
const sx = (x: number) => PAD + (x / 100) * (W - 2 * PAD);
const sy = (y: number) => H - PAD - (y / 100) * (H - 2 * PAD);

export default function RegimeMap({ d }: { d: EngineDecision }) {
  const m = d.market;
  // current position
  const px = m.altseasonIndex;
  const py = m.fearGreed;

  return (
    <section className="panel">
      <div className="panel-title">Regime Map · live position</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 440, height: "auto", display: "block", margin: "0 auto" }}>
        {/* grid */}
        <line x1={sx(0)} y1={sy(0)} x2={sx(100)} y2={sy(0)} stroke="var(--border)" />
        <line x1={sx(0)} y1={sy(0)} x2={sx(0)} y2={sy(100)} stroke="var(--border)" />
        <line x1={sx(50)} y1={sy(0)} x2={sx(50)} y2={sy(100)} stroke="var(--border)" strokeDasharray="2 4" />
        <line x1={sx(0)} y1={sy(50)} x2={sx(100)} y2={sy(50)} stroke="var(--border)" strokeDasharray="2 4" />

        {/* axis labels */}
        <text x={sx(50)} y={H - 6} textAnchor="middle" fill="var(--ink-faint)" fontSize="9">
          ◄ BTC-led        leadership        alt-led ►
        </text>
        <text x={10} y={sy(50)} textAnchor="middle" fill="var(--ink-faint)" fontSize="9"
          transform={`rotate(-90 10 ${sy(50)})`}>
          ◄ fear        risk appetite        greed ►
        </text>

        {/* zones */}
        {ZONES.map((z) => {
          const active = z.key === m.regime;
          return (
            <g key={z.key}>
              <circle cx={sx(z.x)} cy={sy(z.y)} r={active ? 7 : 4}
                fill={active ? "var(--green)" : "var(--border-bright)"}
                opacity={active ? 0.9 : 0.6} />
              <text x={sx(z.x)} y={sy(z.y) - 11} textAnchor="middle"
                fill={active ? "var(--green)" : "var(--ink-faint)"}
                fontSize={active ? "11" : "9.5"} fontWeight={active ? 700 : 400}>
                {z.label}
              </text>
            </g>
          );
        })}

        {/* current market position */}
        <circle cx={sx(px)} cy={sy(py)} r="9" fill="none" stroke="var(--blue)" strokeWidth="1.5" opacity="0.5">
          <animate attributeName="r" values="9;14;9" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0.1;0.5" dur="2.5s" repeatCount="indefinite" />
        </circle>
        <circle cx={sx(px)} cy={sy(py)} r="4.5" fill="var(--blue)" />
        <text x={sx(px)} y={sy(py) + 18} textAnchor="middle" fill="var(--blue)" fontSize="9">you are here</text>
      </svg>
    </section>
  );
}
