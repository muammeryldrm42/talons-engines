"use client";

import { useEffect, useState } from "react";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";

interface Sector { name: string; change24h: number; marketCap: number; tokens?: number }
interface Data { source: string; map?: Sector[] }

function colorFor(ch: number): string {
  const x = Math.max(-6, Math.min(6, ch)) / 6;
  if (x >= 0) return `rgb(${Math.round(30 - x * 10)}, ${Math.round(60 + x * 120)}, ${Math.round(45 + x * 20)})`;
  return `rgb(${Math.round(70 + -x * 130)}, ${Math.round(35 + x * 8)}, ${Math.round(40 + x * 8)})`;
}
function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
}

export default function SectorMap() {
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => { fetch("/api/sectors").then((r) => r.json()).then(setD).catch(() => setD(null)); }, []);

  if (!d) return <section className="panel"><div className="panel-title">Sector Map</div><div className="loading">building the sector map…</div></section>;
  if (!d.map?.length) return null;

  const lookup = new Map(d.map.map((s) => [s.name, s]));
  const data = d.map.map((s) => ({ name: s.name, size: s.marketCap }));

  const Cell = (props: any) => {
    const { x, y, width, height, name } = props;
    const s = lookup.get(name);
    if (!s || width <= 0 || height <= 0) return null;
    const showText = width > 56 && height > 26;
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill={colorFor(s.change24h)} stroke="var(--bg)" strokeWidth={1.5} rx={3} />
        {showText && <text x={x + 6} y={y + 16} fill="#fff" fontSize={11} fontFamily="var(--mono)" fontWeight={700}>{name.length > 18 ? name.slice(0, 17) + "…" : name}</text>}
        {showText && height > 38 && <text x={x + 6} y={y + 31} fill="rgba(255,255,255,.85)" fontSize={10} fontFamily="var(--mono)">{s.change24h >= 0 ? "+" : ""}{s.change24h.toFixed(1)}%</text>}
      </g>
    );
  };
  const TT = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const s = lookup.get(payload[0].payload.name); if (!s) return null;
    return (
      <div style={{ background: "var(--panel-solid)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontFamily: "var(--mono)", fontSize: 12 }}>
        <div style={{ fontWeight: 700, color: "var(--ink)" }}>{s.name}</div>
        <div style={{ color: "var(--ink-dim)" }}>cap {compact(s.marketCap)}</div>
        <div style={{ color: s.change24h >= 0 ? "var(--green)" : "var(--red)" }}>24h {s.change24h >= 0 ? "+" : ""}{s.change24h.toFixed(2)}%</div>
      </div>
    );
  };

  return (
    <section className="panel">
      <div className="panel-title">Sector Map · CMC categories by market cap
        <span className={`src ${d.source === "cmc" ? "live" : ""}`} style={{ marginLeft: 8, fontSize: 10 }}>{d.source === "cmc" ? "● CMC live" : "○ mock"}</span>
      </div>
      <div style={{ width: "100%", height: 340 }}>
        <ResponsiveContainer>
          <Treemap data={data} dataKey="size" stroke="var(--bg)" content={<Cell />} isAnimationActive={false}>
            <Tooltip content={<TT />} />
          </Treemap>
        </ResponsiveContainer>
      </div>
      <div className="px-note">Each tile is a CoinMarketCap sector (DeFi, AI, L2, memes…), sized by total market cap and shaded by 24h average change — a quick read on which narratives are leading or lagging.</div>
    </section>
  );
}
