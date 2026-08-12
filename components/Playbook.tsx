import type { EngineDecision } from "@/lib/engine/types";

export default function Playbook({ d }: { d: EngineDecision }) {
  const p = d.market.playbook;

  return (
    <section className="panel">
      <div className="panel-title">Active Playbook · {d.market.regimeLabel}</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <div className="pb-cell">
          <div className="k">Risk budget</div>
          <div className="v">{(p.riskBudget * 100).toFixed(0)}%</div>
        </div>
        <div className="pb-cell">
          <div className="k">Universe</div>
          <div className="v" style={{ fontSize: 14 }}>{p.universe}</div>
        </div>
        <div className="pb-cell">
          <div className="k">Exposure now</div>
          <div className="v">{(d.totalTargetExposure * 100).toFixed(0)}%</div>
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: "var(--ink-dim)" }}>{p.directionBias}</div>
    </section>
  );
}
