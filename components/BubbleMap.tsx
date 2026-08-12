"use client";

import { useEffect, useState } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { cmcUrl } from "@/lib/cmcLink";

interface Coin { symbol: string; name: string; slug?: string; marketCap: number; change24h: number; change7d: number }
interface Data { source: string; coins: Coin[] }

function colorFor(ch: number): string {
  const x = Math.max(-8, Math.min(8, ch)) / 8;
  if (x >= 0) return `rgb(${Math.round(40 - x * 15)}, ${Math.round(120 + x * 100)}, ${Math.round(70 + x * 20)})`;
  return `rgb(${Math.round(120 + -x * 110)}, ${Math.round(50 + x * 10)}, ${Math.round(55 + x * 10)})`;
}

export default function BubbleMap() {
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => { fetch("/api/marketmap?n=40").then((r) => r.json()).then(setD).catch(() => setD(null)); }, []);

  if (!d) return <section className="panel"><div className="panel-title">Bubble Map</div><div className="loading">plotting the bubble map…</div></section>;
  if (!d.coins?.length) return null;

  const maxCap = Math.max(...d.coins.map((c) => c.marketCap));
  const pts = d.coins.map((c) => ({ x: c.change24h, y: c.change7d, z: c.marketCap, symbol: c.symbol, slug: c.slug, name: c.name }));

  const Dot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    const r = 6 + 34 * Math.sqrt((payload.z || 0) / maxCap);
    return (
      <g style={{ cursor: "pointer" }} onClick={() => window.open(cmcUrl(payload.symbol, payload.slug), "_blank", "noopener")}>
        <circle cx={cx} cy={cy} r={r} fill={colorFor(payload.x)} fillOpacity={0.78} stroke="rgba(255,255,255,.25)" />
        {r > 14 && <text x={cx} y={cy + 3} textAnchor="middle" fill="#fff" fontSize={Math.min(12, r / 2)} fontFamily="var(--mono)" fontWeight={700}>{payload.symbol}</text>}
      </g>
    );
  };
  const TT = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <div style={{ background: "var(--panel-solid)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontFamily: "var(--mono)", fontSize: 12 }}>
        <div style={{ fontWeight: 700, color: "var(--ink)" }}>{p.symbol} · {p.name}</div>
        <div style={{ color: p.x >= 0 ? "var(--green)" : "var(--red)" }}>24h {p.x >= 0 ? "+" : ""}{p.x.toFixed(2)}%</div>
        <div style={{ color: p.y >= 0 ? "var(--green)" : "var(--red)" }}>7d {p.y >= 0 ? "+" : ""}{p.y.toFixed(2)}%</div>
      </div>
    );
  };

  return (
    <section className="panel">
      <div className="panel-title">Bubble Map · momentum quadrants
        <span className={`src ${d.source === "cmc" ? "live" : ""}`} style={{ marginLeft: 8, fontSize: 10 }}>{d.source === "cmc" ? "● CMC live" : "○ mock"}</span>
      </div>
      <div style={{ width: "100%", height: 400 }}>
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 10, right: 16, bottom: 24, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" dataKey="x" name="24h %" tick={{ fill: "var(--ink-faint)", fontSize: 11, fontFamily: "var(--mono)" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} label={{ value: "24h change %", position: "insideBottom", offset: -12, fill: "var(--ink-faint)", fontSize: 11 }} />
            <YAxis type="number" dataKey="y" name="7d %" tick={{ fill: "var(--ink-faint)", fontSize: 11, fontFamily: "var(--mono)" }} tickLine={false} axisLine={false} width={40} label={{ value: "7d %", angle: -90, position: "insideLeft", fill: "var(--ink-faint)", fontSize: 11 }} />
            <ZAxis type="number" dataKey="z" range={[0, 1]} />
            <ReferenceLine x={0} stroke="var(--ink-faint)" strokeDasharray="4 4" />
            <ReferenceLine y={0} stroke="var(--ink-faint)" strokeDasharray="4 4" />
            <Tooltip content={<TT />} cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={pts} shape={<Dot />} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="px-note">Bubble size = market cap, color = 24h move. Top-right = strong on both 24h &amp; 7d; bottom-left = weak on both. Click a bubble to open it on CoinMarketCap.</div>
    </section>
  );
}
