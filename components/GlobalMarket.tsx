"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { Globals } from "@/lib/cmc/signals";

function usd(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const COLORS = ["#f7931a", "#5cc8ff", "#54636f"]; // BTC orange, ETH blue, others grey

export default function GlobalMarket({ g }: { g: Globals }) {
  const pie = [
    { name: "BTC", value: +g.btcDominance.toFixed(1) },
    { name: "ETH", value: +g.ethDominance.toFixed(1) },
    { name: "Others", value: +g.othersDominance.toFixed(1) },
  ];
  const stableShare = g.stablecoinMarketCap ? (g.stablecoinMarketCap / g.totalMarketCap) * 100 : null;

  return (
    <section className="panel">
      <div className="panel-title">Global Market · CoinMarketCap</div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ width: 180, height: 180, position: "relative" }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={pie} dataKey="value" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none">
                {pie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#11161c", border: "1px solid #2b3a47", borderRadius: 8, fontSize: 12 }} formatter={(v: number, n) => [`${v}%`, n]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: 1 }}>BTC dom</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#f7931a" }}>{g.btcDominance.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="rt-legend" style={{ marginBottom: 14 }}>
            {pie.map((p, i) => (
              <span key={p.name} className="rt-leg-item"><i style={{ background: COLORS[i] }} />{p.name} {p.value}%</span>
            ))}
          </div>
          <div className="metrics" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            <div className="metric"><div className="k">Total Market Cap</div><div className="v" style={{ fontSize: 17 }}>{usd(g.totalMarketCap)}</div>
              {g.marketCapChange24h != null && <div style={{ fontSize: 11, color: g.marketCapChange24h >= 0 ? "var(--green)" : "var(--red)" }}>{g.marketCapChange24h >= 0 ? "+" : ""}{g.marketCapChange24h.toFixed(2)}% 24h</div>}
            </div>
            <div className="metric"><div className="k">24h Volume</div><div className="v" style={{ fontSize: 17 }}>{usd(g.totalVolume24h)}</div></div>
            {g.altcoinMarketCap != null && <div className="metric"><div className="k">Altcoin Cap</div><div className="v" style={{ fontSize: 17 }}>{usd(g.altcoinMarketCap)}</div></div>}
            {stableShare != null && <div className="metric"><div className="k">Stablecoin Share</div><div className="v" style={{ fontSize: 17 }}>{stableShare.toFixed(1)}%</div></div>}
          </div>
        </div>
      </div>
    </section>
  );
}
