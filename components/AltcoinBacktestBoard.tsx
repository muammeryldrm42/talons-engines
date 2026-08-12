"use client";
import { useEffect, useState } from "react";
interface AltBT { id: string; name: string; hub: boolean; totalReturn: number; sharpe: number; maxDrawdown: number; winRate: number; exposureDays: number }
interface Result { source: string; days: number; universe: string[]; hold: { totalReturn: number; sharpe: number; maxDrawdown: number }; skills: AltBT[]; note: string }
const pc = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(0)}%`;
const col = (n: number) => (n >= 0 ? "var(--green)" : "var(--red)");
export default function AltcoinBacktestBoard() {
  const [mode, setMode] = useState<"live" | "synthetic">("live");
  const [d, setD] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); fetch(`/api/altcoin-backtest${mode === "synthetic" ? "?synthetic=1" : "?days=90"}`).then((r) => r.json()).then(setD).catch(() => setD(null)).finally(() => setLoading(false)); }, [mode]);
  return (
    <section className="panel">
      <div className="panel-title">
        Altcoin strategy backtest · 14 Agent-Hub skills as long-only spot
        {d && <span className="src" style={{ marginLeft: 8, fontSize: 10, color: "var(--ink-faint)" }}>● {d.source === "cmc" ? "live CMC OHLCV" : "synthetic universe"} · {d.universe.length} coins · {d.days}d</span>}
      </div>
      <p className="rationale" style={{ marginBottom: 12 }}>Each altcoin skill applied long-only across the altcoin universe (BUY = hold spot, else cash), returns pooled across coins and ranked by Sharpe. RSI/MACD/EMA are computed from price history; whale/holder/narrative skills have no historical feed and stay flat.</p>
      <div className="lab-actions" style={{ marginBottom: 14 }}>
        <button className={`lab-chip ${mode === "live" ? "on" : ""}`} onClick={() => setMode("live")}>Live CMC data (~90d)</button>
        <button className={`lab-chip ${mode === "synthetic" ? "on" : ""}`} onClick={() => setMode("synthetic")}>Synthetic universe</button>
      </div>
      {loading && <div className="px-note">Running altcoin backtests…</div>}
      {d && !loading && (
        <>
          <div className="sbt-hold">Benchmark · altcoin buy &amp; hold: <b style={{ color: col(d.hold.totalReturn) }}>{pc(d.hold.totalReturn)}</b> · Sharpe {d.hold.sharpe.toFixed(2)} · Max DD <b style={{ color: "var(--red)" }}>{pc(d.hold.maxDrawdown)}</b></div>
          <div className="sbt-wrap">
            <table className="sbt">
              <thead><tr><th>#</th><th>Skill</th><th>Src</th><th>Return</th><th>Sharpe</th><th>Max DD</th><th>Win</th><th>Days in</th></tr></thead>
              <tbody>
                {d.skills.map((s, i) => (
                  <tr key={s.id}>
                    <td className="sbt-rank">{i + 1}</td>
                    <td className="sbt-name">{s.name}</td>
                    <td className="sbt-dim">{s.hub ? "Hub" : "px"}</td>
                    <td style={{ color: col(s.totalReturn) }}>{pc(s.totalReturn)}</td>
                    <td><b>{s.sharpe.toFixed(2)}</b></td>
                    <td style={{ color: "var(--red)" }}>{pc(s.maxDrawdown)}</td>
                    <td>{Math.round(s.winRate * 100)}%</td>
                    <td className="sbt-dim">{s.exposureDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-note">{d.note}</div>
        </>
      )}
    </section>
  );
}
