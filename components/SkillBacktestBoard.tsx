"use client";

import { useEffect, useState } from "react";

interface SkillBT { id: string; name: string; totalReturn: number; sharpe: number; maxDrawdown: number; winRate: number; exposureDays: number; vsHold: number }
interface Result { source: string; days: number; hold: { totalReturn: number; sharpe: number; maxDrawdown: number }; skills: SkillBT[]; note: string }

const pc = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(0)}%`;
const col = (n: number) => (n >= 0 ? "var(--green)" : "var(--red)");

export default function SkillBacktestBoard() {
  const [mode, setMode] = useState<"live" | "synthetic">("live");
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/skill-backtest${mode === "synthetic" ? "?synthetic=1" : "?days=90"}`)
      .then((r) => r.json()).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [mode]);

  return (
    <section className="panel">
      <div className="panel-title">
        Strategy backtest · all 24 skills as long-only BTC spot strategies
        {data && <span className="src" style={{ marginLeft: 8, fontSize: 10, color: "var(--ink-faint)" }}>● {data.source === "cmc" ? "live CMC data" : "synthetic series"} · {data.days}d</span>}
      </div>
      <p className="rationale" style={{ marginBottom: 12 }}>
        Each skill is run on its own as a <b>spot strategy</b>: when the skill flags BUY on BTC, the strategy holds
        spot; otherwise it sits in cash. No leverage, no shorting. Ranked by risk-adjusted return (Sharpe), compared
        to simply holding BTC.
      </p>

      <div className="lab-actions" style={{ marginBottom: 14 }}>
        <button className={`lab-chip ${mode === "live" ? "on" : ""}`} onClick={() => setMode("live")}>Live CMC data (~90d)</button>
        <button className={`lab-chip ${mode === "synthetic" ? "on" : ""}`} onClick={() => setMode("synthetic")}>Synthetic 4-year</button>
      </div>

      {loading && <div className="px-note">Running 24 skill backtests…</div>}

      {data && !loading && (
        <>
          <div className="sbt-hold">Benchmark · BTC buy &amp; hold: <b style={{ color: col(data.hold.totalReturn) }}>{pc(data.hold.totalReturn)}</b> · Sharpe {data.hold.sharpe.toFixed(2)} · Max DD <b style={{ color: "var(--red)" }}>{pc(data.hold.maxDrawdown)}</b></div>
          <div className="sbt-wrap">
            <table className="sbt">
              <thead>
                <tr><th>#</th><th>Skill</th><th>Return</th><th>Sharpe</th><th>Max DD</th><th>Win</th><th>Days in</th><th>vs Hold</th></tr>
              </thead>
              <tbody>
                {data.skills.map((s, i) => (
                  <tr key={s.id}>
                    <td className="sbt-rank">{i + 1}</td>
                    <td className="sbt-name">{s.name}</td>
                    <td style={{ color: col(s.totalReturn) }}>{pc(s.totalReturn)}</td>
                    <td><b>{s.sharpe.toFixed(2)}</b></td>
                    <td style={{ color: "var(--red)" }}>{pc(s.maxDrawdown)}</td>
                    <td>{Math.round(s.winRate * 100)}%</td>
                    <td className="sbt-dim">{s.exposureDays}</td>
                    <td style={{ color: col(s.vsHold) }}>{pc(s.vsHold)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-note">{data.note}</div>
        </>
      )}
    </section>
  );
}
