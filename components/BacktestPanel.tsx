"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import RegimeTimeline from "./RegimeTimeline";

interface Metrics { totalReturn: number; sharpe: number; maxDrawdown: number; winRate: number; }
interface BTPoint { date: string; strategy: number; btcHold: number; regimeOff: number; cmc100?: number; regime: string; }
interface Attribution { regime: string; days: number; contribution: number; }
export interface BacktestData {
  source: "cmc" | "mock";
  days: number;
  curve: BTPoint[];
  strategy: Metrics;
  btcHold: Metrics;
  regimeOff: Metrics;
  cmc100?: Metrics;
  costs?: { feeBps: number; slippageBps: number; dragPct: number };
  attribution: Attribution[];
  split: { date: string; inSample: Metrics; outOfSample: Metrics };
  note: string;
}

const pct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
const REGIME_LABEL: Record<string, string> = {
  ALT_SEASON_RISK_ON: "Alt Risk-On", BTC_LED_RISK_ON: "BTC Risk-On",
  CHOP: "Chop", RISK_OFF: "Risk-Off", CAPITULATION: "Capitulation",
};

function MetricRow({ label, m, accent }: { label: string; m: Metrics; accent?: string }) {
  return (
    <tr>
      <td style={{ color: accent ?? "var(--ink)" }}>{label}</td>
      <td style={{ textAlign: "right", color: m.totalReturn >= 0 ? "var(--green)" : "var(--red)" }}>{pct(m.totalReturn)}</td>
      <td style={{ textAlign: "right" }}>{m.sharpe.toFixed(2)}</td>
      <td style={{ textAlign: "right", color: "var(--red)" }}>{pct(m.maxDrawdown)}</td>
      <td style={{ textAlign: "right", color: "var(--ink-dim)" }}>{(m.winRate * 100).toFixed(0)}%</td>
    </tr>
  );
}

export default function BacktestPanel({ data, kind }: { data: BacktestData | null; kind?: "live" | "synthetic" }) {
  if (!data) return null;
  const isLive = kind === "live";
  const isSynthetic = kind === "synthetic";
  const liveReal = isLive && data.source === "cmc";
  const hasCmc100 = data.curve.some((p) => p.cmc100 != null);
  const transitions: { date: string; from: string; to: string }[] = [];
  for (let i = 1; i < data.curve.length; i++) {
    if (data.curve[i].regime !== data.curve[i - 1].regime)
      transitions.push({ date: data.curve[i].date, from: data.curve[i - 1].regime, to: data.curve[i].regime });
  }
  const title = isLive
    ? `Real ${data.days}-day backtest · live CMC data · regime strategy vs buy & hold vs no-regime baseline`
    : isSynthetic
    ? `Synthetic backtest · ~4-year baseline (${data.days}d) · regime strategy vs buy & hold vs no-regime baseline`
    : `Backtest · regime strategy vs buy & hold vs no-regime baseline (${data.days}d)`;
  return (
    <section className="panel">
      <div className="panel-title">
        {title}
        {isLive && (
          <span className="src" style={{ marginLeft: 8, fontSize: 10 }}>
            {liveReal ? "● live CMC data" : "○ live history unavailable on this plan — synthetic fallback shown"}
          </span>
        )}
        {isSynthetic && (
          <span className="src" style={{ marginLeft: 8, fontSize: 10, color: "var(--ink-faint)" }}>● synthetic series (logic proof, not a live track record)</span>
        )}
      </div>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={data.curve} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
            <CartesianGrid stroke="#1d2630" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: "#54636f", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#1d2630" }} minTickGap={40} />
            <YAxis tick={{ fill: "#54636f", fontSize: 10 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "#11161c", border: "1px solid #2b3a47", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#8a9aa8" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="strategy" name="Regime Engine" stroke="#34e0a1" strokeWidth={2.4} dot={false} />
            <Line type="monotone" dataKey="btcHold" name="BTC Buy & Hold" stroke="#5cc8ff" strokeWidth={1.6} dot={false} />
            <Line type="monotone" dataKey="regimeOff" name="No-regime (always long)" stroke="#aab6c2" strokeWidth={1.6} strokeOpacity={0.9} strokeDasharray="6 4" dot={false} />
            {hasCmc100 && <Line type="monotone" dataKey="cmc100" name="CMC100 index" stroke="#c08bff" strokeWidth={1.6} dot={false} />}
            {data.split?.date && (
              <ReferenceLine x={data.split.date} stroke="#54636f" strokeDasharray="2 3"
                label={{ value: "OOS →", fill: "#8a9aa8", fontSize: 10, position: "insideTopRight" }} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <RegimeTimeline points={data.curve} caption="Regime path over the backtest" />

      <table style={{ marginTop: 14 }}>
        <thead>
          <tr>
            <th>Strategy</th>
            <th style={{ textAlign: "right" }}>Return</th>
            <th style={{ textAlign: "right" }}>Sharpe</th>
            <th style={{ textAlign: "right" }}>Max DD</th>
            <th style={{ textAlign: "right" }}>Win rate</th>
          </tr>
        </thead>
        <tbody>
          <MetricRow label="● Regime Engine" m={data.strategy} accent="var(--green)" />
          <MetricRow label="● BTC Buy & Hold" m={data.btcHold} accent="var(--blue)" />
          <MetricRow label="● No-regime (always long)" m={data.regimeOff} accent="#aab6c2" />
          {data.cmc100 && <MetricRow label="● CMC100 index" m={data.cmc100} accent="#c08bff" />}
        </tbody>
      </table>

      {data.split && (
        <>
          <div className="panel-title" style={{ marginTop: 20 }}>Walk-forward · strategy (split {data.split.date})</div>
          <table>
            <thead>
              <tr>
                <th>Window</th>
                <th style={{ textAlign: "right" }}>Return</th>
                <th style={{ textAlign: "right" }}>Sharpe</th>
                <th style={{ textAlign: "right" }}>Max DD</th>
                <th style={{ textAlign: "right" }}>Win rate</th>
              </tr>
            </thead>
            <tbody>
              <MetricRow label="In-sample (design)" m={data.split.inSample} accent="var(--ink-dim)" />
              <MetricRow label="Out-of-sample (held out)" m={data.split.outOfSample} accent="var(--green)" />
            </tbody>
          </table>
        </>
      )}

      {data.attribution?.length > 0 && (
        <>
          <div className="panel-title" style={{ marginTop: 20 }}>Regime attribution · return contribution</div>
          <table>
            <thead>
              <tr><th>Regime</th><th style={{ textAlign: "right" }}>Days</th><th style={{ textAlign: "right" }}>Contribution</th></tr>
            </thead>
            <tbody>
              {data.attribution.map((a) => (
                <tr key={a.regime}>
                  <td>{REGIME_LABEL[a.regime] ?? a.regime}</td>
                  <td style={{ textAlign: "right", color: "var(--ink-dim)" }}>{a.days}</td>
                  <td style={{ textAlign: "right", color: a.contribution >= 0 ? "var(--green)" : "var(--red)" }}>{pct(a.contribution)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {data.costs && (
        <div className="px-note" style={{ marginTop: 10 }}>
          Net of transaction costs: every rebalance is charged <b>{data.costs.feeBps} bps fee + {data.costs.slippageBps} bps slippage</b> on turnover.
          Total cost drag over this run: <b>{(data.costs.dragPct * 100).toFixed(1)}%</b>. The returns above are already net of these costs.
        </div>
      )}

      {transitions.length > 0 && (
        <>
          <div className="panel-title" style={{ marginTop: 20 }}>Regime transitions · {transitions.length} regime shifts over the run</div>
          <div className="bt-transitions">
            {transitions.slice(-12).map((t, i) => (
              <div className="bt-trans" key={i}>
                <span className="bt-trans-date">{t.date}</span>
                <span style={{ color: "var(--ink-faint)" }}>{REGIME_LABEL[t.from] ?? t.from}</span>
                <span className="bt-trans-arrow">→</span>
                <span style={{ color: "var(--ink)" }}>{REGIME_LABEL[t.to] ?? t.to}</span>
              </div>
            ))}
          </div>
          {transitions.length > 12 && <div className="px-note">Showing the 12 most recent of {transitions.length} transitions.</div>}
        </>
      )}

      <div className="coin-why" style={{ marginTop: 12, display: "block" }}>{data.note}</div>

      <div className="bt-explainer">
        <div className="bt-explainer-title">How to read this backtest</div>
        <p>
          This replays the <b>same engine you see live</b>, rebalancing daily. The chart compares the{" "}
          <b>regime strategy</b> (it switches its playbook as the market regime changes), a plain{" "}
          <b>BTC buy &amp; hold</b>, a <b>no-regime always-long</b> baseline, and — on the live run —{" "}
          <b>CoinMarketCap&apos;s CMC100 index</b> as a broad-market benchmark. The gap between the regime line
          and the baselines is the value the regime-switching actually adds. All returns are <b>net of costs</b>
          {" "}(fee + slippage on every rebalance).
        </p>
        <p>
          The point isn&apos;t the biggest raw return, it&apos;s the <b>risk-adjusted</b> one: the engine aims for a
          higher Sharpe and a much smaller max drawdown by stepping aside in chop and capitulation instead of riding
          every drop. The <b>regime attribution</b> table shows which regimes did the heavy lifting and which cost money.
        </p>
        <p className="bt-explainer-note">
          Past performance never guarantees future results, and this is a strategy specification rather than financial advice.
        </p>
      </div>
    </section>
  );
}
