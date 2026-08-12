"use client";
import { useEffect, useState } from "react";
interface Item { title: string; url?: string; source?: string }
interface Data { ok: boolean; items: Item[] }
export default function NewsFeed() {
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/news?id=1").then((r) => r.json()).then(setD).catch(() => setD(null)).finally(() => setLoading(false)); }, []);
  if (loading || !d || !d.ok || d.items.length === 0) return null;
  return (
    <section className="panel">
      <div className="panel-title">Latest BTC News<span className="src" style={{ marginLeft: 8, fontSize: 10, color: "var(--green)" }}>● live from Agent Hub</span></div>
      <div className="news-list">
        {d.items.map((n, i) => (
          <div className="news-row" key={i}>
            {n.url ? <a className="news-title" href={n.url} target="_blank" rel="noreferrer">{n.title}</a> : <span className="news-title">{n.title}</span>}
            {n.source && <span className="news-src">{n.source}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
