"use client";
import { useEffect, useState } from "react";
interface E { event: string; date?: string; detail?: string }
interface Data { ok: boolean; items: E[]; text?: string }
export default function MacroEvents() {
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/macro").then((r) => r.json()).then(setD).catch(() => setD(null)).finally(() => setLoading(false)); }, []);
  if (loading || !d || !d.ok) return null;
  return (
    <section className="panel">
      <div className="panel-title">Upcoming Macro Events<span className="src" style={{ marginLeft: 8, fontSize: 10, color: "var(--green)" }}>● live from Agent Hub</span></div>
      {d.items.length > 0 ? (
        <div className="macro-list">{d.items.map((e, i) => (<div className="macro-row" key={i}><span className="macro-date">{e.date ?? "-"}</span><span className="macro-event">{e.event}</span>{e.detail && <span className="macro-detail">{e.detail}</span>}</div>))}</div>
      ) : (<div className="coin-why" style={{ display: "block" }}>{d.text}</div>)}
      <div className="px-note">Scheduled macro catalysts (CPI, FOMC, jobs, etc.) that can shift risk appetite - the engine treats these as risk windows.</div>
    </section>
  );
}
