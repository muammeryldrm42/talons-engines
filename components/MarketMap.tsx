"use client";

import { useEffect, useState } from "react";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { cmcUrl } from "@/lib/cmcLink";

interface Coin { symbol: string; name: string; slug?: string; marketCap: number; change24h: number; change7d: number }
interface Data { source: string; coins: Coin[] }

// red → neutral → green by % change
function colorFor(ch: number): string {
  const x = Math.max(-8, Math.min(8, ch)) / 8; // -1..1
  if (x >= 0) {
    const g = Math.round(60 + x * 120);
    return `rgb(${Math.round(30 - x * 10)}, ${g}, ${Math.round(45 + x * 20)})`;
  }
  const r = Math.round(70 + -x * 130);
  return `rgb(${r}, ${Math.round(35 + x * 8)}, ${Math.round(40 + x * 8)})`;
}
function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
}

export default function MarketMap() {
  const [d, setD] = useState<Data | null>(null);
  const [tf, setTf] = useState<"change24h" | "change7d">("change24h");

  useEffect(() => {
    fetch("/api/marketmap?n=40").then((r) => r.json()).then(setD).catch(() => setD(null));
  }, []);

  if (!d) return <section className="panel"><div className="panel-title">Market Map</div><div className="loading">building the market map…</div></section>;
  if (!d.coins?.length) return null;

  const lookup = new Map(d.coins.map((c) => [c.symbol, c]));
  const data = d.coins.map((c) => ({ name: c.symbol, size: c.marketCap }));

  const Cell = (props: any) => {
    const { x, y, width, height, name } = props;
    const c = lookup.get(name);
    if (!c || width <= 0 || height <= 0) return null;
    const ch = tf === "change24h" ? c.change24h : c.change7d;
    const showText = width > 42 && height > 26;
    const showPct = width > 60 && height > 40;
    return (
      <g style={{ cursor: "pointer" }} onClick={() => window.open(cmcUrl(c.symbol, c.slug), "_blank", "noopener")}>
        <rect x={x} y={y} width={width} height={height} fill={colorFor(ch)} stroke="var(--bg)" strokeWidth={1.5} rx={3} />
        {showText && (
          <text x={x + 6} y={y + 17} fill="#fff" fontSize={Math.min(15, width / 4)} fontFamily="var(--mono)" fontWeight={700}>{name}</text>
        )}
        {showPct && (
          <text x={x + 6} y={y + 33} fill="rgba(255,255,255,.85)" fontSize={11} fontFamily="var(--mono)">{ch >= 0 ? "+" : ""}{ch.toFixed(1)}%</text>
        )}
      </g>
    );
  };

  const TT = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const c = lookup.get(payload[0].payload.name);
    if (!c) return null;
    return (
      <div style={{ background: "var(--panel-solid)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontFamily: "var(--mono)", fontSize: 12 }}>
        <div style={{ fontWeight: 700, color: "var(--ink)" }}>{c.symbol} · {c.name}</div>
        <div style={{ color: "var(--ink-dim)" }}>cap {compact(c.marketCap)}</div>
        <div style={{ color: c.change24h >= 0 ? "var(--green)" : "var(--red)" }}>24h {c.change24h >= 0 ? "+" : ""}{c.change24h.toFixed(2)}%</div>
        <div style={{ color: c.change7d >= 0 ? "var(--green)" : "var(--red)" }}>7d {c.change7d >= 0 ? "+" : ""}{c.change7d.toFixed(2)}%</div>
      </div>
    );
  };

  return (
    <section className="panel">
      <div className="panel-title">
        Market Map · top {d.coins.length} by market cap
        <span className={`src ${d.source === "cmc" ? "live" : ""}`} style={{ marginLeft: 8, fontSize: 10 }}>{d.source === "cmc" ? "● CMC live" : "○ mock"}</span>
        <span className="mm-tabs">
          <button className={tf === "change24h" ? "on" : ""} onClick={() => setTf("change24h")}>24h</button>
          <button className={tf === "change7d" ? "on" : ""} onClick={() => setTf("change7d")}>7d</button>
        </span>
      </div>
      <div style={{ width: "100%", height: 380 }}>
        <ResponsiveContainer>
          <Treemap data={data} dataKey="size" stroke="var(--bg)" content={<Cell />} isAnimationActive={false}>
            <Tooltip content={<TT />} />
          </Treemap>
        </ResponsiveContainer>
      </div>
      <div className="px-note">Each tile is a top asset, sized by market cap and shaded by {tf === "change24h" ? "24-hour" : "7-day"} price change — green up, red down. Click any tile to open it on CoinMarketCap. Stablecoins and wrapped tokens are excluded.</div>
    </section>
  );
}
