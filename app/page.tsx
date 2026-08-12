"use client";

import { useEffect, useState } from "react";
import type { EngineDecision } from "@/lib/engine/types";
import type { Globals } from "@/lib/cmc/signals";
import TodaysCall from "@/components/TodaysCall";
import AboutSkill from "@/components/AboutSkill";
import RegimeBanner from "@/components/RegimeBanner";
import RegimeMap from "@/components/RegimeMap";
import SignalDashboard from "@/components/SignalDashboard";
import SignalRadar from "@/components/SignalRadar";
import Playbook from "@/components/Playbook";
import FearGreedGauge from "@/components/FearGreedGauge";
import BtcVitals from "@/components/BtcVitals";
import GlobalMarket from "@/components/GlobalMarket";
import MarketMap from "@/components/MarketMap";
import BubbleMap from "@/components/BubbleMap";
import Dominance from "@/components/Dominance";
import MarketInternals from "@/components/MarketInternals";
import MarketTilts from "@/components/MarketTilts";
import PriceTrajectory from "@/components/PriceTrajectory";
import SectorLeaders from "@/components/SectorLeaders";
import SectorMap from "@/components/SectorMap";
import BacktestPanel, { type BacktestData } from "@/components/BacktestPanel";
import MonteCarloPanel from "@/components/MonteCarloPanel";
import SkillsLibrary from "@/components/SkillsLibrary";
import SkillBacktestBoard from "@/components/SkillBacktestBoard";
import AltcoinBacktestBoard from "@/components/AltcoinBacktestBoard";
import AltcoinSkillsLibrary from "@/components/AltcoinSkillsLibrary";
import SkillConsensus from "@/components/SkillConsensus";
import CoinLookup from "@/components/CoinLookup";
import NarrativeRotation from "@/components/NarrativeRotation";
import MacroEvents from "@/components/MacroEvents";
import NewsFeed from "@/components/NewsFeed";
import Cmc100Board from "@/components/Cmc100Board";

type Decision = EngineDecision & { source?: "cmc" | "mock"; globals?: Globals | null; hubEnriched?: boolean };
type Tab = "overview" | "backtest" | "cmc100" | "skills" | "altskills";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "backtest", label: "Backtest" },
  { id: "cmc100", label: "CMC 100 Index" },
  { id: "skills", label: "ETH BTC Skills" },
  { id: "altskills", label: "Altcoin Skills" },
];

export default function Page() {
  const [tab, setTab] = useState<Tab>("overview");
  const [d, setD] = useState<Decision | null>(null);
  const [bt, setBt] = useState<BacktestData | null>(null);
  const [btLive, setBtLive] = useState<BacktestData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/regime").then((r) => r.json()).then(setD).catch((e) => setErr(String(e)));
    fetch("/api/backtest?days=1460&synthetic=1").then((r) => r.json()).then(setBt).catch(() => {});
    fetch("/api/backtest?days=90").then((r) => r.json()).then(setBtLive).catch(() => {});
  }, []);

  const exportJson = () => {
    if (!d) return;
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `regime-${d.asOf?.slice(0, 10)}.json`;
    a.click();
  };

  return (
    <main className="wrap">
      <header className="masthead">
        <div>
          <div className="brand">TALONS <b>REGIME ENGINE</b></div>
          <div className="tag">Read the room · pick the play · rank the names</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {d?.source && <span className={`src ${d.source === "cmc" ? "live" : ""}`}>{d.source === "cmc" ? "● CMC live" : "○ mock data"}</span>}
          <button className="btn" onClick={exportJson}>↓ export</button>
        </div>
      </header>

      <nav className="secnav">
        {TABS.map((t) => (
          <button key={t.id} className={`secbtn ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>

      {err && <div className="panel" style={{ color: "var(--red)" }}>Error: {err}</div>}
      {!d && !err && <div className="loading">querying CoinMarketCap…</div>}

      {d && tab === "overview" && (
        <>
          <TodaysCall d={d} />
          <AboutSkill />
          <RegimeBanner d={d} />
          <SkillConsensus />
          <BacktestPanel data={bt} kind="synthetic" />
          <BacktestPanel data={btLive} kind="live" />
          <MonteCarloPanel />
          <FearGreedGauge value={d.market.fearGreed} />
          <PriceTrajectory />
          {d.globals && <BtcVitals g={d.globals} />}
          {d.globals && <GlobalMarket g={d.globals} />}
          <Dominance d={d} />
          <SignalDashboard d={d} />
          <SignalRadar d={d} />
          <Playbook d={d} />
          <MarketTilts tilts={d.market.tilts} />
          <RegimeMap d={d} />
          {d.rationale && (
            <section className="panel">
              <div className="panel-title">Why · plain-English rationale</div>
              <div className="rationale">{d.rationale}</div>
            </section>
          )}
        </>
      )}

      {tab === "cmc100" && (
        <>
          <Cmc100Board />
          {d?.globals && <MarketInternals g={d.globals} altseasonIndex={d.market.altseasonIndex} />}
          <MarketMap />
          <BubbleMap />
          <SectorLeaders />
          <SectorMap />
          <NarrativeRotation />
          <MacroEvents />
          <NewsFeed />
        </>
      )}
      {tab === "backtest" && (
        <>
          <SkillBacktestBoard />
          <AltcoinBacktestBoard />
        </>
      )}
      {d && tab === "skills" && <SkillsLibrary />}
      {tab === "altskills" && (
        <>
          <CoinLookup />
          <AltcoinSkillsLibrary />
        </>
      )}

      <div className="foot">Strategy skill · data provided by CoinMarketCap</div>
    </main>
  );
}
