"use client";

import { useEffect, useState } from "react";

interface Sector { name: string; change24h: number; marketCap: number; tokens: number; }
interface Data { source: string; hot: Sector[]; cold: Sector[]; total?: number; }

const cap = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : `$${(n / 1e6).toFixed(0)}M`;

function Row({ s }: { s: Sector }) {
  const up = s.change24h >= 0;
  return (
    <div className="sec-row">
      <span className="sec-name" title={`${s.tokens} tokens · ${cap(s.marketCap)}`}>{s.name}</span>
      <span className="sec-chg" style={{ color: up ? "var(--green)" : "var(--red)" }}>{up ? "+" : ""}{s.change24h.toFixed(2)}%</span>
    </div>
  );
}

export default function SectorLeaders() {
  const [d, setD] = useState<Data | null>(null);

  useEffect(() => {
    fetch("/api/sectors").then((r) => r.json()).then(setD).catch(() => setD({ source: "error", hot: [], cold: [] }));
  }, []);

  if (!d) return <section className="panel"><div className="panel-title">Sector Rotation</div><div className="loading">loading sector rotation…</div></section>;
  if (!d.hot.length && !d.cold.length) return (
    <section className="panel">
      <div className="panel-title">Sector Rotation · 24h (CMC categories)</div>
      <div className="px-note" style={{ marginTop: 4 }}>
        Sector data is unavailable right now — the CMC <code>categories</code> endpoint returned nothing (missing key,
        over quota, or not enabled on this plan). The leaders/laggards fill in once <code>/api/sectors</code> responds.
      </div>
    </section>
  );

  return (
    <section className="panel">
      <div className="panel-title">
        Sector Rotation · where money is moving (24h, CMC categories)
        <span className={`src ${d.source === "cmc" ? "live" : ""}`} style={{ marginLeft: 8, fontSize: 10 }}>{d.source === "cmc" ? "● CMC live" : "○ mock"}</span>
      </div>
      <div className="sec-grid">
        <div>
          <div className="sec-head up">▲ Leading sectors</div>
          {d.hot.map((s) => <Row key={s.name} s={s} />)}
        </div>
        <div>
          <div className="sec-head down">▼ Lagging sectors</div>
          {d.cold.map((s) => <Row key={s.name} s={s} />)}
        </div>
      </div>
      <div className="px-note">Average 24h price change per CoinMarketCap category (filtered to sectors above $500M with 5+ tokens). A quick read on whether risk is rotating into majors, alts, AI, memes, L2s, and so on.</div>
    </section>
  );
}
