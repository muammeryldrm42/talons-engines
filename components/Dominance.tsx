"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { EngineDecision } from "@/lib/engine/types";
import type { Globals } from "@/lib/cmc/signals";

const COLORS: Record<string, string> = {
  BTC: "#f7931a", ETH: "#8aa0ff", Stablecoins: "#26a17b", Others: "#8b8f98",
};

export default function Dominance({ d }: { d: EngineDecision & { globals?: Globals | null } }) {
  const g = d.globals;
  if (!g) return null;
  const stable = g.stablecoinMarketCap && g.totalMarketCap ? (g.stablecoinMarketCap / g.totalMarketCap) * 100 : 0;
  const btc = g.btcDominance;
  const eth = g.ethDominance;
  const others = Math.max(0, 100 - btc - eth - stable);
  const slices = [
    { name: "BTC", value: +btc.toFixed(1) },
    { name: "ETH", value: +eth.toFixed(1) },
    { name: "Stablecoins", value: +stable.toFixed(1) },
    { name: "Others", value: +others.toFixed(1) },
  ].filter((s) => s.value > 0);

  return (
    <section className="panel">
      <div className="panel-title">Market Dominance · BTC · ETH · Stablecoins · Others</div>
      <div className="dom-wrap">
        <div style={{ width: 200, height: 200, flex: "0 0 auto" }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={slices} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={88} paddingAngle={2} stroke="var(--bg)" strokeWidth={2}>
                {slices.map((s) => <Cell key={s.name} fill={COLORS[s.name] ?? "#666"} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--panel-solid)", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "var(--mono)", fontSize: 12 }} formatter={(v: number, n: string) => [`${v}%`, n]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="dom-side">
          <div className="dom-bar">
            {slices.map((s) => (
              <div key={s.name} className="dom-seg" style={{ width: `${s.value}%`, background: COLORS[s.name] ?? "#666" }} title={`${s.name} ${s.value}%`} />
            ))}
          </div>
          <div className="dom-legend">
            {slices.map((s) => (
              <div key={s.name} className="dom-li">
                <span className="dom-dot" style={{ background: COLORS[s.name] ?? "#666" }} />
                <span className="dom-name">{s.name}</span>
                <span className="dom-val">{s.value}%</span>
              </div>
            ))}
          </div>
          <div className="px-note" style={{ marginTop: 6 }}>
            BTC dominance is the engine&apos;s key rotation signal: rising favors BTC over alts, falling favors ETH and the long tail. Stablecoin share is sidelined dry powder.
          </div>
        </div>
      </div>
    </section>
  );
}
