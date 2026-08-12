// Semicircular Fear & Greed gauge. value 0..100 (0 = extreme fear, 100 = extreme greed).
const W = 260, H = 150, CX = 130, CY = 130, R = 100;

function polar(angleDeg: number, r = R) {
  const a = (Math.PI * angleDeg) / 180;
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
}
// map value 0..100 → angle 180..0 (left → right across the top semicircle)
const valToAngle = (v: number) => 180 - (Math.max(0, Math.min(100, v)) / 100) * 180;

function arc(fromV: number, toV: number) {
  const a = polar(valToAngle(fromV));
  const b = polar(valToAngle(toV));
  const large = Math.abs(valToAngle(toV) - valToAngle(fromV)) > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${R} ${R} 0 ${large} 1 ${b.x} ${b.y}`;
}

const BANDS: [number, number, string][] = [
  [0, 25, "#ff5d6c"], [25, 45, "#ff8a5c"], [45, 55, "#ffb454"], [55, 75, "#9bd45c"], [75, 100, "#34e0a1"],
];

function label(v: number) {
  if (v < 25) return "Extreme Fear";
  if (v < 45) return "Fear";
  if (v <= 55) return "Neutral";
  if (v <= 75) return "Greed";
  return "Extreme Greed";
}

export default function FearGreedGauge({ value }: { value: number }) {
  const needle = polar(valToAngle(value), R - 14);
  const color = BANDS.find(([lo, hi]) => value >= lo && value <= hi)?.[2] ?? "#ffb454";

  return (
    <section className="panel">
      <div className="panel-title">Fear &amp; Greed</div>
      <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: 260, maxWidth: "100%" }}>
          {BANDS.map(([lo, hi, c]) => (
            <path key={lo} d={arc(lo, hi)} fill="none" stroke={c} strokeWidth={14} strokeLinecap="butt" opacity={0.85} />
          ))}
          <line x1={CX} y1={CY} x2={needle.x} y2={needle.y} stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" />
          <circle cx={CX} cy={CY} r={6} fill="var(--ink)" />
          <text x={CX} y={CY - 34} textAnchor="middle" fill={color} fontSize={34} fontWeight={700} fontFamily="var(--mono)">{value}</text>
        </svg>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color }}>{label(value)}</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-dim)", marginTop: 6, maxWidth: 260 }}>
            The contrarian backbone of the regime read — extreme fear feeds capitulation
            accumulation, extreme greed cools risk-on exposure.
          </div>
        </div>
      </div>
    </section>
  );
}
