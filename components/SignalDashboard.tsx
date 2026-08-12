import type { EngineDecision } from "@/lib/engine/types";

function Metric({ k, v, tone, sub }: { k: string; v: string; tone?: string; sub?: string }) {
  return (
    <div className="metric">
      <div className="k">{k}</div>
      <div className="v" style={{ color: tone, fontSize: 18 }}>{v}</div>
      {sub && <div style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function fgTone(v: number) { return v < 40 ? "var(--red)" : v > 60 ? "var(--green)" : "var(--amber)"; }
function signTone(v: number) { return v >= 0 ? "var(--green)" : "var(--red)"; }
const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

export default function SignalDashboard({ d }: { d: EngineDecision }) {
  const m = d.market;
  const s = m.signals;
  const hasDeriv = s.aggFundingRate != null || s.openInterestChange != null;

  return (
    <section className="panel">
      <div className="panel-title">Regime Signals · CoinMarketCap</div>
      <div className="metrics" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <Metric k="Fear & Greed" v={String(m.fearGreed)} tone={fgTone(m.fearGreed)}
          sub={m.fearGreed < 25 ? "extreme fear" : m.fearGreed > 75 ? "extreme greed" : m.fearGreed < 45 ? "fear" : m.fearGreed > 55 ? "greed" : "neutral"} />
        <Metric k="Altcoin Season" v={String(m.altseasonIndex)}
          sub={m.altseasonIndex > 65 ? "alts leading" : m.altseasonIndex < 35 ? "BTC leading" : "mixed"} />
        <Metric k="BTC Dominance" v={`${m.btcDominance.toFixed(1)}%`} tone={signTone(-s.btcDominanceTrend)}
          sub={`trend ${s.btcDominanceTrend >= 0 ? "↑" : "↓"} ${Math.abs(s.btcDominanceTrend).toFixed(2)}pt`} />
        <Metric k="BTC · 7d" v={pct(s.btcReturn7d)} tone={signTone(s.btcReturn7d)} />
        <Metric k="BTC · 30d" v={pct(s.btcReturn30d)} tone={signTone(s.btcReturn30d)} />
        <Metric k="Regime Confidence" v={`${(m.regimeConfidence * 100).toFixed(0)}%`} />
      </div>

      <div className="panel-title" style={{ marginTop: 20 }}>Derivatives Positioning {!hasDeriv && <span style={{ color: "var(--ink-faint)" }}>· live-only</span>}</div>
      {hasDeriv ? (
        <div className="metrics" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <Metric k="Funding (8h)" v={s.aggFundingRate == null ? "—" : `${(s.aggFundingRate * 100).toFixed(3)}%`}
            tone={s.aggFundingRate == null ? undefined : signTone(-s.aggFundingRate)}
            sub={s.aggFundingRate == null ? "" : s.aggFundingRate > 0.0005 ? "crowded longs" : s.aggFundingRate < -0.0002 ? "crowded shorts" : "balanced"} />
          <Metric k="Open Interest 24h" v={s.openInterestChange == null ? "—" : pct(s.openInterestChange)}
            tone={s.openInterestChange == null ? undefined : signTone(s.openInterestChange)} />
          <Metric k="Liquidations" v={s.liquidationCascade ? "CASCADE" : "normal"} tone={s.liquidationCascade ? "var(--red)" : undefined} />
        </div>
      ) : (
        <div className="coin-why" style={{ display: "block" }}>
          Funding / open-interest / liquidation feeds are part of the live derivatives layer
          (CMC Agent Hub). When present they can escalate or cool the regime — e.g. a leverage
          washout (deeply negative funding + collapsing OI in a downtrend) escalates to Capitulation.
        </div>
      )}
    </section>
  );
}
