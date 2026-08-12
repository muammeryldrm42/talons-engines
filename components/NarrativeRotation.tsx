"use client";
import { useEffect, useState } from "react";
interface N { name: string; detail?: string }
interface Data { ok: boolean; items: N[]; text?: string }
export default function NarrativeRotation() {
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/narratives").then((r) => r.json()).then(setD).catch(() => setD(null)).finally(() => setLoading(false)); }, []);
  if (loading) return null;
  if (!d || !d.ok) return null;
  return (
    <section className="panel">
      <div className="panel-title">Narrative Rotation<span className="src" style={{ marginLeft: 8, fontSize: 10, color: "var(--green)" }}>● live from Agent Hub</span></div>
      {d.items.length > 0 ? (
        <div className="narr-grid">
          {d.items.map((n, i) => (<div className="narr" key={i}><div className="narr-name">{n.name}</div>{n.detail && <div className="narr-detail">{n.detail}</div>}</div>))}
        </div>
      ) : (<div className="coin-why" style={{ display: "block" }}>{d.text}</div>)}
      <div className="px-note">Trending crypto narratives from the CMC Agent Hub - where market attention and rotation are concentrated right now.</div>
    </section>
  );
}
