export const REGIME_COLOR: Record<string, string> = {
  ALT_SEASON_RISK_ON: "#34e0a1",
  BTC_LED_RISK_ON: "#5cc8ff",
  CHOP: "#ffb454",
  RISK_OFF: "#ff8a5c",
  CAPITULATION: "#ff5d6c",
};
const LABEL: Record<string, string> = {
  ALT_SEASON_RISK_ON: "Alt Risk-On",
  BTC_LED_RISK_ON: "BTC Risk-On",
  CHOP: "Chop",
  RISK_OFF: "Risk-Off",
  CAPITULATION: "Capitulation",
};

export default function RegimeTimeline({
  points,
  caption,
}: {
  points: { date: string; regime: string }[];
  caption?: string;
}) {
  if (!points.length) return null;
  const present = Array.from(new Set(points.map((p) => p.regime)));
  const first = points[0]?.date;
  const last = points[points.length - 1]?.date;

  return (
    <div style={{ marginTop: 8 }}>
      {caption && <div className="k" style={{ marginBottom: 6 }}>{caption}</div>}
      <div className="rt-strip">
        {points.map((p, i) => (
          <div
            key={i}
            className="rt-seg"
            style={{ background: REGIME_COLOR[p.regime] ?? "var(--border-bright)" }}
            title={`${p.date} · ${LABEL[p.regime] ?? p.regime}`}
          />
        ))}
      </div>
      <div className="rt-axis">
        <span>{first}</span>
        <span>{last}</span>
      </div>
      <div className="rt-legend">
        {present.map((r) => (
          <span key={r} className="rt-leg-item">
            <i style={{ background: REGIME_COLOR[r] ?? "var(--border-bright)" }} />
            {LABEL[r] ?? r}
          </span>
        ))}
      </div>
    </div>
  );
}
