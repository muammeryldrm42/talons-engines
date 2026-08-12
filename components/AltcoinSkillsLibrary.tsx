"use client";

import { useEffect, useState } from "react";

interface Pick { symbol: string; signal: "BUY" | "SELL"; score: number; reason: string }
interface AltSkill { id: string; name: string; summary: string; hub: boolean; inputs: string[]; picks: Pick[] }
interface Setup { symbol: string; buy: number; sell: number; net: number; pctChange7d: number; reasons: string[] }
interface Data { source: string; hubEnriched: boolean; coinsScanned: number; coins: string[]; setups: Setup[]; skills: AltSkill[] }

export default function AltcoinSkillsLibrary() {
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/altcoin-skills").then((r) => r.json()).then(setD).catch(() => setD(null)).finally(() => setLoading(false)); }, []);

  if (loading) return <section className="panel"><div className="panel-title">Altcoin Skills</div><div className="px-note">Scanning altcoins via the CMC Agent Hub…</div></section>;
  if (!d || d.source === "unavailable")
    return (
      <section className="panel">
        <div className="panel-title">Altcoin Skills</div>
        <div className="px-note">Altcoin skills run on live CMC listings + the CMC Agent Hub. They populate on a deployment with API access; not reachable right now.</div>
      </section>
    );

  return (
    <>
      <section className="panel">
        <div className="panel-title">
          Altcoin Skills · Agent-Hub-powered
          <span className="src" style={{ marginLeft: 8, fontSize: 10, color: d.hubEnriched ? "var(--green)" : "var(--ink-faint)" }}>
            ● {d.coinsScanned} altcoins scanned · Agent Hub {d.hubEnriched ? "online" : "offline"}
          </span>
        </div>
        <p className="rationale">
          {ALTCOIN_INTRO}
          {d.coins.length > 0 && <> Currently scanning: <b>{d.coins.join(", ")}</b>.</>}
        </p>
      </section>

      {d.setups && d.setups.length > 0 && (
        <section className="panel">
          <div className="panel-title">Top Altcoin Setups · ranked by skill consensus</div>
          <div className="setup-list">
            {d.setups.map((s) => (
              <div className="setup-row" key={s.symbol}>
                <span className="setup-sym">{s.symbol}</span>
                <span className="setup-score"><span style={{ color: "var(--green)" }}>{s.buy} buy</span> · <span style={{ color: "var(--red)" }}>{s.sell} sell</span></span>
                <span className="setup-chg" style={{ color: s.pctChange7d >= 0 ? "var(--green)" : "var(--red)" }}>{s.pctChange7d >= 0 ? "+" : ""}{s.pctChange7d.toFixed(1)}% 7d</span>
                <span className="setup-reasons">{s.reasons.length ? s.reasons.join(" · ") : "no active buy signals"}</span>
              </div>
            ))}
          </div>
          <div className="px-note">Coins where the most altcoin skills currently agree on a BUY - the names that deserve a first look. Consensus across the 14 skills, not a single signal.</div>
        </section>
      )}

      <div className="skill-grid">
        {d.skills.map((s) => (
          <div className="panel skill-card" key={s.id}>
            <div className="panel-title skill-title" style={{ marginBottom: 6 }}>
              <span>{s.name}</span>
              <span className={`skill-hub ${s.hub ? "on" : ""}`}>{s.hub ? "● Agent Hub" : "○ market data"}</span>
            </div>
            <div className="skill-summary">{s.summary}</div>
            <div className="alt-picks">
              {s.picks.length === 0 && <div className="alt-nopick">No active signals across scanned altcoins.</div>}
              {s.picks.slice(0, 5).map((p) => (
                <div className="alt-pick" key={p.symbol}>
                  <span className={`alt-sig ${p.signal.toLowerCase()}`}>{p.signal}</span>
                  <span className="alt-sym">{p.symbol}</span>
                  <span className="alt-reason">{p.reason}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const ALTCOIN_INTRO = "These skills scan the most liquid altcoins live and score each one from CMC listings plus CMC Agent Hub technicals (RSI/MACD/EMA), crypto metrics (whale and holder structure) and trending narratives. Hub-only skills stay quiet when that data isn't available.";
