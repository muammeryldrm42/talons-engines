import type { EngineDecision } from "@/lib/engine/types";

export default function RegimeBanner({ d }: { d: EngineDecision }) {
  const m = d.market;
  return (
    <section className="panel">
      <div className="panel-title">Market Regime</div>
      <div className="regime-head">
        <div className={`regime-name ${m.regime}`}>{m.regimeLabel}</div>
        <div className="conf">confidence <b>{(m.regimeConfidence * 100).toFixed(0)}%</b></div>
        {m.regimeShift && (
          <span className="flag" style={{ color: "var(--blue)", borderColor: "rgba(92,200,255,0.4)", background: "rgba(92,200,255,0.08)" }}>
            🔀 shift from {m.prevRegime}
          </span>
        )}
      </div>
      {m.regimeReasons?.length > 0 && <div className="reasons">{m.regimeReasons.join(" · ")}</div>}
      {m.riskFlags.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {m.riskFlags.map((f) => <span className="flag" key={f}>⚠ {f}</span>)}
        </div>
      )}
    </section>
  );
}
