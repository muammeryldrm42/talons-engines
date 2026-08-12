"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

interface MC {
  paths: number; days: number;
  strategy: { medianReturn: number; p5Return: number; p95Return: number; medianSharpe: number; p5Sharpe: number; p95Sharpe: number; worstDrawdown: number; medianDrawdown: number };
  hold: { medianReturn: number; worstDrawdown: number };
  beatHoldPct: number; profitablePct: number;
  histogram: { bucket: string; count: number }[];
}

const pc = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(0)}%`;

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="mc-stat">
      <div className="mc-stat-label">{label}</div>
      <div className="mc-stat-value" style={{ color: accent ?? "var(--ink)" }}>{value}</div>
      {sub && <div className="mc-stat-sub">{sub}</div>}
    </div>
  );
}

export default function MonteCarloPanel() {
  const [mc, setMc] = useState<MC | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { fetch("/api/montecarlo").then((r) => r.json()).then(setMc).catch(() => setErr(true)); }, []);

  return (
    <section className="panel">
      <div className="panel-title">
        Monte Carlo backtest · robustness across simulated market paths
        {mc && <span className="src" style={{ marginLeft: 8, fontSize: 10, color: "var(--ink-faint)" }}>● {mc.paths} paths × {mc.days}d · logic stress test</span>}
      </div>
      <p className="rationale" style={{ marginBottom: 14 }}>
        A single backtest is one path — easy to get lucky on. Here the engine is run on{" "}
        {mc ? mc.paths : 500} independent, randomly generated regime-switching markets (bull, bear and
        chop legs that switch stochastically). We report the <b>distribution</b> of outcomes, not one
        number: median return and Sharpe, the 5th–95th percentile range, and the worst drawdown across
        every path. The point isn&apos;t a headline return — it&apos;s that the engine&apos;s edge
        (downside control) holds across hundreds of scenarios, not just one lucky run. Synthetic by
        design; this is a stress test of the strategy logic, not a live track record.
      </p>

      {err && <div className="px-note">Monte Carlo unavailable right now.</div>}
      {!mc && !err && <div className="px-note">Running {500} simulated paths…</div>}

      {mc && (
        <>
          <div className="mc-grid">
            <Stat label="Median return" value={pc(mc.strategy.medianReturn)} sub={`vs buy & hold ${pc(mc.hold.medianReturn)}`} accent="var(--green)" />
            <Stat label="5th–95th pct return" value={`${pc(mc.strategy.p5Return)} … ${pc(mc.strategy.p95Return)}`} sub="middle 90% of paths" />
            <Stat label="Median Sharpe" value={mc.strategy.medianSharpe.toFixed(2)} sub={`p5 ${mc.strategy.p5Sharpe.toFixed(2)} · p95 ${mc.strategy.p95Sharpe.toFixed(2)}`} />
            <Stat label="Worst-case drawdown" value={pc(mc.strategy.worstDrawdown)} sub={`buy & hold worst ${pc(mc.hold.worstDrawdown)}`} accent="var(--red)" />
            <Stat label="Profitable paths" value={`${mc.profitablePct}%`} sub={`${mc.paths} total paths`} accent="var(--green)" />
            <Stat label="Beats buy & hold" value={`${mc.beatHoldPct}%`} sub="of paths, on raw return" />
          </div>

          <div className="panel-title" style={{ marginTop: 18, marginBottom: 6 }}>Return distribution</div>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={mc.histogram} margin={{ top: 4, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="#1d2630" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fill: "#54636f", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#1d2630" }} />
                <YAxis tick={{ fill: "#54636f", fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--panel-solid)", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "var(--mono)", fontSize: 12 }} cursor={{ fill: "#ffffff08" }} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {mc.histogram.map((h, i) => <Cell key={i} fill={h.bucket.includes("-") && !h.bucket.includes("0–") ? "#e0556b" : "#34e0a1"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="px-note">
            Read it as: across {mc.paths} random markets the engine was profitable {mc.profitablePct}% of
            the time and held its worst drawdown to {pc(mc.strategy.worstDrawdown)} while passive holding
            could lose {pc(mc.hold.worstDrawdown)}. It gives up some upside (beats hold {mc.beatHoldPct}% of
            paths) in exchange for that downside control — the trade-off is the design.
          </div>
        </>
      )}
    </section>
  );
}
