// Per-skill SPOT backtest. Each of the 24 skills is a standalone long-only spot
// strategy on BTC: when the skill says BUY we hold spot BTC, otherwise we sit in
// cash. We replay the skills daily over real CMC history where available (OHLCV +
// Fear & Greed + dominance), falling back to a synthetic series, and rank them by
// risk-adjusted return. Pure spot — no leverage, no shorting.
import { SKILLS } from "./skills";
import type { MarketSignals, CoinInput } from "./engine/types";
import { rsi as rsiCalc } from "./indicators";
import { getFearGreedHistorical, getGlobalMetricsHistorical, getOhlcvHistorical, hasKey } from "./cmc/client";

const pct = (a: number, b?: number) => (b ? ((a - b) / b) * 100 : 0);
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const day = (ts: string) => ts.slice(0, 10);

export interface SkillBТ {
  id: string; name: string;
  totalReturn: number; sharpe: number; maxDrawdown: number; winRate: number; exposureDays: number; vsHold: number;
}
export interface SkillBacktestResult {
  source: "cmc" | "mock"; days: number;
  hold: { totalReturn: number; sharpe: number; maxDrawdown: number };
  skills: SkillBТ[];
  note: string;
}

function metrics(returns: number[]) {
  const active = returns.filter((r) => r !== 0);
  const mean = active.reduce((a, b) => a + b, 0) / (active.length || 1);
  const std = Math.sqrt(active.reduce((a, b) => a + (b - mean) ** 2, 0) / (active.length || 1)) || 1e-9;
  let eq = 1, peak = 1, maxDD = 0, wins = 0;
  for (const r of returns) { eq *= 1 + r; peak = Math.max(peak, eq); maxDD = Math.min(maxDD, eq / peak - 1); if (r > 0) wins++; }
  return {
    totalReturn: r4(eq - 1), sharpe: Math.round((mean / std) * Math.sqrt(365) * 100) / 100,
    maxDrawdown: r4(maxDD), winRate: Math.round((wins / (active.length || 1)) * 1000) / 1000, exposureDays: active.length,
  };
}

function synth(N: number) {
  const btc: number[] = [], eth: number[] = [], fg: number[] = [], dom: number[] = [];
  let pb = 20000, pe = 1300;
  const prand = (i: number) => { const r = Math.sin(i * 127.1 + 311.7) * 43758.5453; return (r - Math.floor(r)) * 2 - 1; };
  for (let i = 0; i < N; i++) {
    const macro = Math.sin(i / 200 + 1), swing = Math.sin(i / 40);
    const drift = 0.0002 + 0.0058 * macro + 0.0026 * swing;
    const noise = 0.0075 * Math.sin(i / 2.3) + 0.0055 * Math.cos(i / 5.7) + 0.02 * prand(i);
    pb *= 1 + drift + noise; pe *= 1 + (drift + noise) * 1.18;
    btc.push(pb); eth.push(pe);
    fg.push(Math.round(clamp(50 + 38 * macro + 11 * swing, 6, 94)));
    dom.push(58 - 5 * macro + 1.5 * Math.sin(i / 55));
  }
  return { btc, eth, fg, dom };
}

async function real(count: number) {
  const [fgH, gm, btcH, ethH] = await Promise.all([
    getFearGreedHistorical(count), getGlobalMetricsHistorical(count),
    getOhlcvHistorical("BTC", count), getOhlcvHistorical("ETH", count),
  ]);
  const fgBy = new Map(fgH.data.map((d) => [day(d.timestamp), d.value] as const));
  const domBy = new Map(gm.data.quotes.map((q) => [day(q.timestamp), q.btc_dominance] as const));
  const ethBy = new Map(ethH.data.quotes.map((q) => [day(q.time_close), q.quote.USD.close] as const));
  const rows = btcH.data.quotes
    .map((q) => ({ date: day(q.time_close), close: q.quote.USD.close }))
    .filter((p) => fgBy.has(p.date) && ethBy.has(p.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const btc = rows.map((r) => r.close);
  const eth = rows.map((r) => ethBy.get(r.date)!);
  const fg = rows.map((r) => fgBy.get(r.date)!);
  const dom = rows.map((r) => domBy.get(r.date) ?? 55);
  return { btc, eth, fg, dom };
}

export async function runSkillBacktest(count = 1460, forceMock = false): Promise<SkillBacktestResult> {
  let series: { btc: number[]; eth: number[]; fg: number[]; dom: number[] } | null = null;
  let source: "cmc" | "mock" = "mock";
  if (!forceMock) {
    try { const r = await real(count); if (r.btc.length > 45) { series = r; source = "cmc"; } } catch { /* fall back */ }
  }
  if (!series) series = synth(Math.max(120, Math.min(count, 1500)));
  const { btc, eth, fg, dom } = series;

  const perSkill: number[][] = SKILLS.map(() => []);
  const holdRet: number[] = [];

  for (let i = 30; i < btc.length - 1; i++) {
    const market: MarketSignals = {
      fearGreed: fg[i], altseasonIndex: clamp(50 + (pct(eth[i], eth[i - 7]) - pct(btc[i], btc[i - 7])) * 3, 5, 95),
      btcDominance: dom[i], btcDominanceTrend: dom[i] - dom[i - 7],
      btcReturn7d: pct(btc[i], btc[i - 7]), btcReturn30d: pct(btc[i], btc[i - 30]),
    };
    const coins: CoinInput[] = [
      { symbol: "BTC", name: "Bitcoin", marketCap: 1e12, volume24h: 5e10, pctChange24h: pct(btc[i], btc[i - 1]), pctChange7d: pct(btc[i], btc[i - 7]), pctChange30d: pct(btc[i], btc[i - 30]), pctChange90d: pct(btc[i], btc[i - 30]), rsi: rsiCalc(btc.slice(Math.max(0, i - 60), i + 1)) ?? 50 },
      { symbol: "ETH", name: "Ethereum", marketCap: 4e11, volume24h: 2e10, pctChange24h: pct(eth[i], eth[i - 1]), pctChange7d: pct(eth[i], eth[i - 7]), pctChange30d: pct(eth[i], eth[i - 30]), pctChange90d: pct(eth[i], eth[i - 30]), rsi: rsiCalc(eth.slice(Math.max(0, i - 60), i + 1)) ?? 50 },
    ];
    const ctx = { market, coins, globals: null };
    const nbtc = pct(btc[i + 1], btc[i]) / 100;
    holdRet.push(nbtc);

    SKILLS.forEach((sk, si) => {
      let sig = "NEUTRAL";
      try { const v = sk.evaluate(ctx).find((x) => x.symbol === "BTC"); sig = v?.signal ?? "NEUTRAL"; } catch { /* skill needs data we lack -> flat */ }
      perSkill[si].push(sig === "BUY" ? nbtc : 0); // long-only spot
    });
  }

  const holdM = metrics(holdRet);
  const skills = SKILLS.map((sk, si) => {
    const m = metrics(perSkill[si]);
    return { id: sk.id, name: sk.name, ...m, vsHold: r4(m.totalReturn - holdM.totalReturn) };
  }).sort((a, b) => b.sharpe - a.sharpe);

  return {
    source, days: holdRet.length,
    hold: { totalReturn: holdM.totalReturn, sharpe: holdM.sharpe, maxDrawdown: holdM.maxDrawdown },
    skills,
    note: `Each skill as a long-only BTC spot strategy (BUY = hold spot, otherwise cash). ${source === "cmc" ? "Real CMC history." : "Synthetic series (logic proof)."} Derivatives-only skills (funding/OI/ETF) have no historical feed and stay flat here.`,
  };
}
