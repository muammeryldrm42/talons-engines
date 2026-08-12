"use client";

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import type { EngineDecision } from "@/lib/engine/types";

const SHORT: Record<string, string> = {
  "Momentum": "Mom", "Mean-reversion": "MeanRev", "Relative strength": "RelStr",
  "Exchange flow": "Flow", "Funding": "Funding", "ETF divergence": "ETF", "Sentiment divergence": "Sent",
};

export default function SignalRadar({ d }: { d: EngineDecision }) {
  const p = d.market.playbook;
  const data = p.weights.map((w) => ({ axis: SHORT[w.signal] ?? w.signal, weight: Math.round(w.weight * 100) }));

  return (
    <section className="panel">
      <div className="panel-title">Signal Weighting · {d.market.regimeLabel}</div>
      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="#2b3a47" />
            <PolarAngleAxis dataKey="axis" tick={{ fill: "#8a9aa8", fontSize: 11 }} />
            <Radar dataKey="weight" stroke="#34e0a1" fill="#34e0a1" fillOpacity={0.28} strokeWidth={2} isAnimationActive={false} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--ink-dim)" }}>{p.directionBias}</div>
    </section>
  );
}
