"use client";
import { useState } from "react";
interface Snap { ok: boolean; symbol?: string; name?: string; price?: number; change24h?: number; change7d?: number; rsi?: number; macd?: number; signals?: { skill: string; signal: string; reason: string }[]; news?: { title: string; url?: string; source?: string }[]; note?: string }
const pc = (n?: number) => (n == null ? "n/a" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`);
const col = (n?: number) => (n == null ? "var(--ink-faint)" : n >= 0 ? "var(--green)" : "var(--red)");
export default function CoinLookup() {
  const [q, setQ] = useState("");
  const [snap, setSnap] = useState<Snap | null>(null);
  const [loading, setLoading] = useState(false);
  const go = async () => { if (!q.trim()) return; setLoading(true); try { const r = await fetch(`/api/lookup?q=${encodeURIComponent(q.trim())}`); setSnap(await r.json()); } catch { setSnap({ ok: false, note: "lookup failed" }); } finally { setLoading(false); } };
  return (
    <section className="panel">
      <div className="panel-title">Coin Lookup · any ticker via the Agent Hub</div>
      <div className="lookup-bar">
        <input className="lookup-input" placeholder="e.g. SOL, LINK, PEPE" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} />
        <button className="lab-run" onClick={go} disabled={loading}>{loading ? "…" : "Look up"}</button>
      </div>
      {snap && (snap.ok ? (
        <div className="lookup-snap">
          <div className="lookup-head">{snap.name ?? snap.symbol} <span className="lookup-sym">{snap.symbol}</span></div>
          <div className="lookup-grid">
            <div><span>Price</span><b>{snap.price != null ? `$${snap.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}` : "n/a"}</b></div>
            <div><span>24h</span><b style={{ color: col(snap.change24h) }}>{pc(snap.change24h)}</b></div>
            <div><span>7d</span><b style={{ color: col(snap.change7d) }}>{pc(snap.change7d)}</b></div>
            <div><span>RSI</span><b>{snap.rsi != null ? Math.round(snap.rsi) : "n/a"}</b></div>
            <div><span>MACD</span><b style={{ color: snap.macd == null ? "var(--ink-faint)" : snap.macd >= 0 ? "var(--green)" : "var(--red)" }}>{snap.macd != null ? (snap.macd >= 0 ? "bullish" : "bearish") : "n/a"}</b></div>
          </div>
          {snap.signals && snap.signals.length > 0 && (
            <div className="lookup-sec">
              <div className="lookup-sec-h">Altcoin skills firing</div>
              <div className="alt-picks">
                {snap.signals.slice(0, 8).map((v, i) => (
                  <div className="alt-pick" key={i}><span className={`alt-sig ${v.signal.toLowerCase()}`}>{v.signal}</span><span className="alt-sym">{v.skill}</span><span className="alt-reason">{v.reason}</span></div>
                ))}
              </div>
            </div>
          )}
          {snap.news && snap.news.length > 0 && (
            <div className="lookup-sec">
              <div className="lookup-sec-h">Latest news</div>
              <div className="news-list">
                {snap.news.slice(0, 5).map((n, i) => (
                  <div className="news-row" key={i}>{n.url ? <a className="news-title" href={n.url} target="_blank" rel="noreferrer">{n.title}</a> : <span className="news-title">{n.title}</span>}{n.source && <span className="news-src">{n.source}</span>}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (<div className="px-note">{snap.note ?? "Not found."} Coin lookup needs the CMC Agent Hub; it populates on a deployment with API access.</div>))}
    </section>
  );
}
