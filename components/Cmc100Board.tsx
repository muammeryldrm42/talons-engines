"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface C100 {
  source: string; value: number | null;
  change24h: number | null; change7d: number | null; change30d: number | null;
  trendUp: boolean; series: { date: string; value: number }[]; asOf?: string | null; note?: string;
}

const chg = (n: number | null) => (n == null ? "n/a" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`);
const col = (n: number | null) => (n == null ? "var(--ink-faint)" : n >= 0 ? "var(--green)" : "var(--red)");

function Chip({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="c100-chip">
      <div className="c100-chip-l">{label}</div>
      <div className="c100-chip-v" style={{ color: col(value) }}>{chg(value)}</div>
    </div>
  );
}

export default function Cmc100Board() {
  const [d, setD] = useState<C100 | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { fetch("/api/cmc100").then((r) => r.json()).then(setD).catch(() => setErr(true)); }, []);

  if (err || (d && d.source === "unavailable"))
    return (
      <section className="panel">
        <div className="panel-title">CMC 100 Index</div>
        <div className="px-note">CMC100 isn&apos;t available on this key/endpoint right now. It&apos;s a free CoinMarketCap index — it should populate on a deployment with API access.</div>
      </section>
    );
  if (!d) return <section className="panel"><div className="panel-title">CMC 100 Index</div><div className="px-note">Loading CMC100…</div></section>;

  const broad = d.trendUp ? "Broad market in an uptrend" : "Broad market under pressure";

  return (
    <>
      <section className="panel">
        <div className="panel-title">
          CMC 100 Index · CoinMarketCap&apos;s top-100 benchmark
          <span className="src" style={{ marginLeft: 8, fontSize: 10, color: "var(--ink-faint)" }}>● {d.source === "cmc" ? "live CMC data" : "CMC trial data"}</span>
        </div>
        <div className="c100-hero">
          <div>
            <div className="c100-value">{d.value != null ? d.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "n/a"}</div>
            <div className="c100-broad" style={{ color: d.trendUp ? "var(--green)" : "var(--red)" }}>{broad}</div>
          </div>
          <div className="c100-chips">
            <Chip label="24h" value={d.change24h} />
            <Chip label="7d" value={d.change7d} />
            <Chip label="30d" value={d.change30d} />
          </div>
        </div>
        {d.series.length > 1 && (
          <div style={{ width: "100%", height: 240, marginTop: 14 }}>
            <ResponsiveContainer>
              <LineChart data={d.series} margin={{ top: 8, right: 12, bottom: 0, left: -6 }}>
                <CartesianGrid stroke="#1d2630" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#54636f", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#1d2630" }} minTickGap={40} />
                <YAxis tick={{ fill: "#54636f", fontSize: 10 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ background: "var(--panel-solid)", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "var(--mono)", fontSize: 12 }} />
                <Line type="monotone" dataKey="value" name="CMC100" stroke={d.trendUp ? "#34e0a1" : "#e0556b"} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="px-note">
          The CMC100 tracks the top 100 cryptocurrencies by market cap (stablecoins and pegged tokens
          excluded) — CoinMarketCap&apos;s own broad-market benchmark. The regime engine reads it as a
          breadth confirmation: a rising CMC100 supports risk-on calls, a falling one argues for caution.
          A more honest yardstick than BTC alone.
        </div>
      </section>
    </>
  );
}
