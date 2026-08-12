"use client";
import { useEffect, useState } from "react";
interface Tally { buy: number; sell: number; neutral: number; total: number; net: number; lean: string }
interface Data { source: string; hubEnriched: boolean; BTC: Tally; ETH: Tally }
const leanCol = (l: string) => (l === "BUY" ? "var(--green)" : l === "SELL" ? "var(--red)" : "var(--amber)");
function Row({ sym, t }: { sym: string; t: Tally }) {
  const buyPct = (t.buy / (t.total || 1)) * 100, sellPct = (t.sell / (t.total || 1)) * 100;
  return (
    <div className="cons-row">
      <div className="cons-sym">{sym}</div>
      <div className="cons-bar">
        <div className="cons-buy" style={{ width: `${buyPct}%` }} />
        <div className="cons-neu" style={{ width: `${100 - buyPct - sellPct}%` }} />
        <div className="cons-sell" style={{ width: `${sellPct}%` }} />
      </div>
      <div className="cons-counts"><span style={{ color: "var(--green)" }}>{t.buy} buy</span> · <span style={{ color: "var(--ink-faint)" }}>{t.neutral} neu</span> · <span style={{ color: "var(--red)" }}>{t.sell} sell</span></div>
      <div className="cons-lean" style={{ color: leanCol(t.lean) }}>{t.lean}</div>
    </div>
  );
}
export default function SkillConsensus() {
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => { fetch("/api/consensus").then((r) => r.json()).then(setD).catch(() => {}); }, []);
  if (!d) return null;
  return (
    <section className="panel">
      <div className="panel-title">Skill consensus · how the 24 ETH/BTC skills line up</div>
      <Row sym="BTC" t={d.BTC} /><Row sym="ETH" t={d.ETH} />
      <div className="px-note">Net lean = (buy − sell) / total skills. A strong one-sided consensus is a higher-conviction read; a split points to chop.</div>
    </section>
  );
}
