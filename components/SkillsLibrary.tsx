"use client";

import { useEffect, useState } from "react";
import { cmcUrl } from "@/lib/cmcLink";

type Signal = "BUY" | "SELL" | "NEUTRAL";
interface Verdict { symbol: string; slug?: string; signal: Signal; score: number; reason: string; }
interface SkillCard { id: string; name: string; summary: string; entry: string; exit: string; inputs: string[]; verdicts: Verdict[]; }

const sigColor: Record<Signal, string> = { BUY: "var(--green)", SELL: "var(--red)", NEUTRAL: "var(--amber)" };

interface Tech { rsi: number | null; macd: number | null }

export default function SkillsLibrary() {
  const [skills, setSkills] = useState<SkillCard[] | null>(null);
  const [hub, setHub] = useState(false);
  const [tech, setTech] = useState<{ BTC: Tech; ETH: Tech } | null>(null);
  const [funding, setFunding] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/skills").then((r) => r.json()).then((j) => {
      setSkills(j.skills ?? []);
      setHub(!!j.hubEnriched);
      setTech(j.technicals ?? null);
      setFunding(typeof j.funding === "number" ? j.funding : null);
    }).catch(() => setSkills([]));
  }, []);

  if (!skills) return <div className="loading">running the skill library on live BTC &amp; ETH data…</div>;

  const rsiTone = (r: number | null) => (r == null ? "" : r >= 70 ? "down" : r <= 30 ? "up" : "");
  const hasTech = hub && tech && (tech.BTC.rsi != null || tech.ETH.rsi != null || funding != null);

  return (
    <>
      <section className="panel">
        <div className="panel-title">Strategy Skill Library · {skills.length} skills · BTC &amp; ETH
          {hub && <span className="src live" style={{ marginLeft: 8, fontSize: 10 }}>● RSI/MACD live from Agent Hub</span>}</div>
        <p className="rationale">
          Each skill is a pure, independently-callable function (<code>evaluate(snapshot) → verdicts</code>),
          listed in the manifest and runnable on its own. Every skill is evaluated live on BTC and ETH and
          returns a clear <b style={{ color: "var(--green)" }}>BUY</b> / <b style={{ color: "var(--red)" }}>SELL</b> /
          <b style={{ color: "var(--amber)" }}> NEUTRAL</b> call with the reasoning behind it. The Regime Engine
          composes them into the single decision on the Overview tab.
        </p>
        {hasTech && tech && (
          <div className="hub-tech">
            <div className="hub-tech-label">● Live inputs from CMC Agent Hub (feeding the 24 skills):</div>
            <div className="hub-tech-row">
              {(["BTC", "ETH"] as const).map((sym) => (
                <div className="hub-tech-coin" key={sym}>
                  <span className="htc-sym">{sym}</span>
                  {tech[sym].rsi != null && <span>RSI <b className={rsiTone(tech[sym].rsi)}>{tech[sym].rsi!.toFixed(1)}</b></span>}
                  {tech[sym].macd != null && <span>MACD <b className={tech[sym].macd! >= 0 ? "up" : "down"}>{tech[sym].macd! >= 0 ? "+" : ""}{tech[sym].macd!.toFixed(3)}</b></span>}
                  {tech[sym].rsi == null && tech[sym].macd == null && <span className="htc-na">technicals n/a</span>}
                </div>
              ))}
              {funding != null && (
                <div className="hub-tech-coin"><span className="htc-sym">FUNDING</span><b className={funding >= 0 ? "up" : "down"}>{funding >= 0 ? "+" : ""}{funding.toFixed(4)}</b></div>
              )}
            </div>
          </div>
        )}
      </section>

      {skills.map((s) => (
        <section className="panel" key={s.id}>
          <div className="panel-title skill-title" style={{ marginBottom: 8 }}>
            <span>{s.name}</span>
            <span className={`skill-hub ${hub ? "on" : ""}`}>{hub ? "● Agent Hub online" : "○ Agent Hub offline"}</span>
          </div>
          <div className="skill-summary">{s.summary}</div>

          <div className="skill-rules">
            <div><span className="rk">ENTRY</span> {s.entry}</div>
            <div><span className="rk">EXIT</span> {s.exit}</div>
          </div>

          <div className="verdicts">
            {s.verdicts.length === 0 && <div className="empty">No data for BTC/ETH right now.</div>}
            {s.verdicts.map((v) => (
              <div className="verdict" key={v.symbol}>
                <a className="v-sym" href={cmcUrl(v.symbol, v.slug)} target="_blank" rel="noopener noreferrer" title={`${v.symbol} on CoinMarketCap`}>{v.symbol}</a>
                <span className="v-sig" style={{ color: sigColor[v.signal], borderColor: sigColor[v.signal] }}>{v.signal}</span>
                <span className="v-reason">{v.reason}</span>
              </div>
            ))}
          </div>

          <div className="skill-inputs">CMC inputs: {s.inputs.join(" · ")}</div>
        </section>
      ))}
    </>
  );
}
