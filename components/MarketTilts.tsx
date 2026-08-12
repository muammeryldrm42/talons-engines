import type { MarketTilts } from "@/lib/engine/types";

function Bar({ label, v }: { label: string; v: number }) {
  const pct = Math.min(Math.abs(v), 1) * 50; // half-width
  const neg = v < 0;
  const sign = v > 0.05 ? "bullish" : v < -0.05 ? "bearish" : "neutral";
  return (
    <div className="tilt">
      <div className="k">{label}</div>
      <div className="bar">
        <i
          className={neg ? "neg" : ""}
          style={{ width: `${pct}%`, left: neg ? `${50 - pct}%` : "50%" }}
        />
      </div>
      <div className="val">
        {v >= 0 ? "+" : ""}
        {v.toFixed(2)} · <span style={{ color: "var(--ink-faint)" }}>{sign}</span>
      </div>
    </div>
  );
}

export default function MarketTilts({ tilts }: { tilts: MarketTilts }) {
  return (
    <section className="panel">
      <div className="panel-title">Market Tilts</div>
      <div className="tilts">
        <Bar label="ETF Flow Divergence" v={tilts.etfDivergence} />
        <Bar label="Sentiment Divergence" v={tilts.sentimentDivergence} />
      </div>
    </section>
  );
}
