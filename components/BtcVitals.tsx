"use client";

import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, ReferenceLine, Tooltip } from "recharts";
import type { Globals } from "@/lib/cmc/signals";

function usd(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${n.toFixed(2)}`;
}
const sign = (v: number) => (v >= 0 ? "var(--green)" : "var(--red)");
const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

export default function BtcVitals({ g }: { g: Globals }) {
  const b = g.btc;
  const tf = [
    { tf: "1h", v: b.change1h }, { tf: "24h", v: b.change24h },
    { tf: "7d", v: b.change7d }, { tf: "30d", v: b.change30d }, { tf: "90d", v: b.change90d },
  ];

  return (
    <section className="panel">
      <div className="panel-title">Bitcoin · vitals</div>
      <div className="metrics" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="metric"><div className="k">Price</div><div className="v" style={{ fontSize: 18 }}>{usd(b.price)}</div></div>
        <div className="metric"><div className="k">Market Cap</div><div className="v" style={{ fontSize: 18 }}>{usd(b.marketCap)}</div></div>
        <div className="metric"><div className="k">24h Volume</div><div className="v" style={{ fontSize: 18 }}>{usd(b.volume24h)}</div></div>
        <div className="metric"><div className="k">Dominance</div><div className="v" style={{ fontSize: 18 }}>{b.dominance.toFixed(1)}%</div></div>
      </div>

      <div className="k" style={{ margin: "16px 0 6px" }}>Return by timeframe</div>
      <div style={{ width: "100%", height: 170 }}>
        <ResponsiveContainer>
          <BarChart data={tf} margin={{ top: 6, right: 8, bottom: 0, left: -16 }}>
            <XAxis dataKey="tf" tick={{ fill: "#8a9aa8", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#1d2630" }} />
            <YAxis tick={{ fill: "#54636f", fontSize: 11 }} tickLine={false} axisLine={false} unit="%" />
            <ReferenceLine y={0} stroke="#2b3a47" />
            <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} contentStyle={{ background: "#11161c", border: "1px solid #2b3a47", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => pct(v)} />
            <Bar dataKey="v" radius={[3, 3, 0, 0]}>
              {tf.map((d, i) => <Cell key={i} fill={d.v >= 0 ? "#34e0a1" : "#ff5d6c"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
