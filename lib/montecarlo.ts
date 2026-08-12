// Monte Carlo robustness — the honest way to read a synthetic backtest.
// Instead of ONE lucky path, generate N independent regime-switching market paths,
// run the REAL engine on each, and report the DISTRIBUTION of outcomes: median /
// p5 / p95 return and Sharpe, worst-case drawdown, and how often the strategy beats
// buy & hold. This is a stress test of the strategy LOGIC, not a live track record.
import { runEngine } from "./engine";
import type { CoinInput, Direction, MarketSignals } from "./engine/types";

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const pct = (a: number, b?: number) => (b ? ((a - b) / b) * 100 : 0);
const mkCoin = (symbol: string, name: string, c1: number, c7: number, c30: number): CoinInput =>
  ({ symbol, name, marketCap: symbol === "BTC" ? 1e12 : 4e11, volume24h: 5e10, pctChange24h: c1, pctChange7d: c7, pctChange30d: c30, pctChange90d: c30 });

// mulberry32 — fast seeded PRNG so each path is independent & reproducible.
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PathResult { ret: number; sharpe: number; maxDD: number; holdRet: number; holdDD: number }

function simulatePath(days: number, seed: number): PathResult {
  const rnd = rng(seed);
  // regime-switching drift: bull / bear / chop, switching stochastically → varied markets
  const drifts = [0.0045, -0.0045, 0.0004];
  let drift = drifts[Math.floor(rnd() * 3)];
  const vol = 0.02 + rnd() * 0.015;
  const btc: number[] = []; const eth: number[] = [];
  let pb = 20000, pe = 1300;
  for (let i = 0; i < days + 30; i++) {
    if (rnd() < 0.018) drift = drifts[Math.floor(rnd() * 3)]; // regime switch
    const shock = rnd() * 2 - 1;
    const ret = drift + vol * shock;
    pb *= 1 + ret; pe *= 1 + ret * 1.15 + vol * 0.4 * (rnd() * 2 - 1);
    btc.push(pb); eth.push(pe);
  }
  const fgRnd = rng(seed ^ 0x9e3779b9);
  let dom = 55;
  let prevPositions: Record<string, Direction> = {};
  const retS: number[] = []; const retB: number[] = [];
  let eqS = 1, eqB = 1, peakS = 1, peakB = 1, ddS = 0, ddB = 0;

  for (let i = 30; i < btc.length - 1; i++) {
    const r7 = pct(btc[i], btc[i - 7]); const r30 = pct(btc[i], btc[i - 30]);
    const er7 = pct(eth[i], eth[i - 7]);
    dom = clamp(dom + (fgRnd() * 2 - 1) * 0.6, 40, 70);
    const fg = clamp(50 + r7 * 1.6 + (fgRnd() * 2 - 1) * 8, 5, 95);
    const market: MarketSignals = {
      fearGreed: Math.round(fg), altseasonIndex: clamp(50 + (er7 - r7) * 3, 5, 95),
      btcDominance: dom, btcDominanceTrend: 0, btcReturn7d: r7, btcReturn30d: r30,
    };
    const coins: CoinInput[] = [
      mkCoin("BTC", "Bitcoin", pct(btc[i], btc[i - 1]), r7, r30),
      mkCoin("ETH", "Ethereum", pct(eth[i], eth[i - 1]), er7, er7),
    ];
    const dec = runEngine({ asOf: String(i), market, coins, prevPositions, opts: { confidenceScaling: true } });
    const nb = pct(btc[i + 1], btc[i]) / 100;
    const ne = pct(eth[i + 1], eth[i]) / 100;
    const nret: Record<string, number> = { BTC: nb, ETH: ne };
    const newPos: Record<string, Direction> = {};
    let rS = 0;
    for (const c of dec.rankedCoins) {
      const sign = c.direction === "LONG" ? 1 : c.direction === "SHORT" ? -1 : 0;
      newPos[c.symbol] = c.direction;
      rS += c.targetWeight * sign * (nret[c.symbol] ?? 0);
    }
    prevPositions = newPos;
    retS.push(rS); retB.push(nb);
    eqS *= 1 + rS; eqB *= 1 + nb;
    peakS = Math.max(peakS, eqS); ddS = Math.min(ddS, eqS / peakS - 1);
    peakB = Math.max(peakB, eqB); ddB = Math.min(ddB, eqB / peakB - 1);
  }
  const mean = retS.reduce((a, b) => a + b, 0) / (retS.length || 1);
  const std = Math.sqrt(retS.reduce((a, b) => a + (b - mean) ** 2, 0) / (retS.length || 1)) || 1e-9;
  return { ret: eqS - 1, sharpe: (mean / std) * Math.sqrt(365), maxDD: ddS, holdRet: eqB - 1, holdDD: ddB };
}

const q = (arr: number[], p: number) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[clamp(Math.floor(p * (s.length - 1)), 0, s.length - 1)];
};

export interface MonteCarloResult {
  paths: number; days: number;
  strategy: { medianReturn: number; p5Return: number; p95Return: number; medianSharpe: number; p5Sharpe: number; p95Sharpe: number; worstDrawdown: number; medianDrawdown: number };
  hold: { medianReturn: number; worstDrawdown: number };
  beatHoldPct: number; profitablePct: number;
  histogram: { bucket: string; count: number }[];
}

export function runMonteCarlo(paths = 300, days = 365): MonteCarloResult {
  const res: PathResult[] = [];
  for (let i = 0; i < paths; i++) res.push(simulatePath(days, (i + 1) * 2654435761));
  const rets = res.map((r) => r.ret);
  const sharpes = res.map((r) => r.sharpe);
  const dds = res.map((r) => r.maxDD);
  const beat = res.filter((r) => r.ret > r.holdRet).length / paths;
  const prof = res.filter((r) => r.ret > 0).length / paths;

  // histogram of returns (%) in fixed buckets
  const edges = [-50, -25, 0, 25, 50, 100, 200, 1e9];
  const labels = ["<-25%", "-25–0%", "0–25%", "25–50%", "50–100%", "100–200%", ">200%"];
  const hist = labels.map((l) => ({ bucket: l, count: 0 }));
  for (const r of rets) {
    const v = r * 100;
    for (let e = 1; e < edges.length; e++) { if (v < edges[e]) { hist[e - 1].count++; break; } }
  }

  return {
    paths, days,
    strategy: {
      medianReturn: q(rets, 0.5), p5Return: q(rets, 0.05), p95Return: q(rets, 0.95),
      medianSharpe: Math.round(q(sharpes, 0.5) * 100) / 100, p5Sharpe: Math.round(q(sharpes, 0.05) * 100) / 100, p95Sharpe: Math.round(q(sharpes, 0.95) * 100) / 100,
      worstDrawdown: Math.min(...dds), medianDrawdown: q(dds, 0.5),
    },
    hold: { medianReturn: q(res.map((r) => r.holdRet), 0.5), worstDrawdown: Math.min(...res.map((r) => r.holdDD)) },
    beatHoldPct: Math.round(beat * 1000) / 10, profitablePct: Math.round(prof * 1000) / 10,
    histogram: hist,
  };
}
