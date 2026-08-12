"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";

interface Side { symbol: string; price: number; change24h: number; change7d: number; }
interface Data { source: string; series: { label: string; BTC: number; ETH: number }[]; btc?: Side; eth?: Side; }

const fmt = (n: number) => n >= 1000 ? `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `$${n.toFixed(2)}`;
const chip = (v: number) => (
  <span style={{ color: v >= 0 ? "var(--green)" : "var(--red)", fontFamily: "var(--mono)", fontWeight: 700 }}>
    {v >= 0 ? "+" : ""}{v.toFixed(2)}%
  </span>
);

export default function PriceTrajectory() {
  const [d, setD] = useState<Data | null>(null);

  useEffect(() => {
    fetch("/api/prices").then((r) => r.json()).then(setD).catch(() => setD({ source: "error", series: [] }));
  }, []);

  if (!d) return <section className="panel"><div className="panel-title">Price Chart · BTC vs ETH</div><div className="loading">loading BTC &amp; ETH price chart…</div></section>;
  if (!d.series.length) return (
    <section className="panel">
      <div className="panel-title">Price Chart · BTC vs ETH · 90-day trajectory</div>
      <div className="px-note" style={{ marginTop: 4 }}>
        Price data is unavailable right now (the live CMC quotes call returned no data — usually a missing/over-quota
        API key). The chart fills in as soon as <code>/api/prices</code> returns BTC &amp; ETH quotes.
      </div>
    </section>
  );

  return (
    <section className="panel">
      <div className="panel-title">
        Price Chart · BTC vs ETH · 90-day trajectory (indexed to 100)
        <span className={`src ${d.source === "cmc" ? "live" : ""}`} style={{ marginLeft: 8, fontSize: 10 }}>{d.source === "cmc" ? "● CMC live" : "○ mock"}</span>
      </div>

      <div className="px-heads">
        {d.btc && (
          <div className="px-head">
            <span className="px-sym" style={{ color: "#f7931a" }}>● BTC</span>
            <b>{fmt(d.btc.price)}</b>
            <span>24h {chip(d.btc.change24h)} · 7d {chip(d.btc.change7d)}</span>
          </div>
        )}
        {d.eth && (
          <div className="px-head">
            <span className="px-sym" style={{ color: "#8aa0ff" }}>● ETH</span>
            <b>{fmt(d.eth.price)}</b>
            <span>24h {chip(d.eth.change24h)} · 7d {chip(d.eth.change7d)}</span>
          </div>
        )}
      </div>

      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <AreaChart data={d.series} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f7931a" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#f7931a" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8aa0ff" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#8aa0ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "var(--ink-faint)", fontSize: 11, fontFamily: "var(--mono)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
            <YAxis tick={{ fill: "var(--ink-faint)", fontSize: 11, fontFamily: "var(--mono)" }} axisLine={false} tickLine={false} width={42} domain={["auto", "auto"]} />
            <ReferenceLine y={100} stroke="var(--ink-faint)" strokeDasharray="4 4" />
            <Tooltip
              contentStyle={{ background: "var(--panel-solid)", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "var(--mono)", fontSize: 12 }}
              labelStyle={{ color: "var(--ink-dim)" }}
              formatter={(v: number, n: string) => [`${v.toFixed(2)} (base 100)`, n]}
            />
            <Area type="monotone" dataKey="BTC" stroke="#f7931a" strokeWidth={2} fill="url(#gB)" dot={{ r: 2 }} />
            <Area type="monotone" dataKey="ETH" stroke="#8aa0ff" strokeWidth={2} fill="url(#gE)" dot={{ r: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="px-note">
        Reconstructed from CMC %-change anchors (1h / 24h / 7d / 30d / 90d) — the free Basic key has no historical
        OHLCV endpoint, so each past point is derived from the current price and reported change. Both assets are
        rebased to 100 at the 90-day mark, so the higher line is simply the stronger performer over the window.
      </div>
    </section>
  );
}
