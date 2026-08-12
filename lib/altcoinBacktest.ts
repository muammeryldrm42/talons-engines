// Spot backtest for the altcoin skills. Each skill is applied long-only across a
// universe of altcoins (BUY = hold that coin's spot, else cash), pooling returns
// across the universe and ranking skills by risk-adjusted return. Tries real CMC
// OHLCV for the top liquid altcoins; falls back to a synthetic multi-coin universe.
// Whale/holder/narrative skills have no historical feed and stay flat here (honest).
import { ALTCOIN_SKILLS, type AltCoinData } from "./altcoinSkills";
import { getListings, getOhlcvHistorical } from "./cmc/client";
import { rsi as rsiCalc, macdHistogram } from "./indicators";

const pct = (a: number, b?: number) => (b ? ((a - b) / b) * 100 : 0);
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;
const sma = (a: number[], i: number, n: number) => { let s = 0, c = 0; for (let k = Math.max(0, i - n + 1); k <= i; k++) { s += a[k]; c++; } return c ? s / c : a[i]; };
const emaLast = (a: number[], i: number, n: number) => { const k = 2 / (n + 1); let e = a[Math.max(0, i - 40)]; for (let j = Math.max(0, i - 40) + 1; j <= i; j++) e = a[j] * k + e * (1 - k); return e; };

export interface AltBТ { id: string; name: string; hub: boolean; totalReturn: number; sharpe: number; maxDrawdown: number; winRate: number; exposureDays: number }
export interface AltBacktestResult { source: "cmc" | "mock"; days: number; universe: string[]; hold: { totalReturn: number; sharpe: number; maxDrawdown: number }; skills: AltBТ[]; note: string }

function metrics(returns: number[]) {
  const active = returns.filter((r) => r !== 0);
  const mean = active.reduce((a, b) => a + b, 0) / (active.length || 1);
  const std = Math.sqrt(active.reduce((a, b) => a + (b - mean) ** 2, 0) / (active.length || 1)) || 1e-9;
  let eq = 1, peak = 1, maxDD = 0, wins = 0;
  for (const r of returns) { eq *= 1 + r; peak = Math.max(peak, eq); maxDD = Math.min(maxDD, eq / peak - 1); if (r > 0) wins++; }
  return { totalReturn: r4(eq - 1), sharpe: Math.round((mean / std) * Math.sqrt(365) * 100) / 100, maxDrawdown: r4(maxDD), winRate: Math.round((wins / (active.length || 1)) * 1000) / 1000, exposureDays: active.length };
}

interface Coin { symbol: string; price: number[]; vol: number[]; mcap: number }

function synthUniverse(N: number): { coins: Coin[]; btc: number[] } {
  const specs = [
    { s: "ALT1", d: 0.006, v: 0.03 }, { s: "ALT2", d: -0.002, v: 0.045 }, { s: "ALT3", d: 0.004, v: 0.05 },
    { s: "ALT4", d: 0.001, v: 0.06 }, { s: "ALT5", d: 0.008, v: 0.07 }, { s: "ALT6", d: -0.004, v: 0.04 },
  ];
  const prand = (i: number, o: number) => { const r = Math.sin((i + o) * 127.1 + 311.7) * 43758.5453; return (r - Math.floor(r)) * 2 - 1; };
  const btc: number[] = []; let pb = 30000;
  for (let i = 0; i < N; i++) { pb *= 1 + 0.0009 + 0.004 * Math.sin(i / 180) + 0.018 * prand(i, 999); btc.push(pb); }
  const coins = specs.map((sp, ci) => {
    const price: number[] = [], vol: number[] = []; let p = 5 + ci * 3;
    for (let i = 0; i < N; i++) { p *= 1 + sp.d + 0.006 * Math.sin(i / (35 + ci * 8)) + sp.v * prand(i, ci * 100); price.push(Math.max(0.0001, p)); vol.push(1e8 * (0.6 + Math.abs(prand(i, ci * 7)))); }
    return { symbol: sp.s, price, vol, mcap: 3e9 };
  });
  return { coins, btc };
}

async function realUniverse(count: number): Promise<{ coins: Coin[]; btc: number[] } | null> {
  try {
    const listings = await getListings(60);
    const picks = listings.data.filter((c) => c.symbol !== "BTC" && c.symbol !== "ETH").sort((a, b) => (b.quote.USD.volume_24h ?? 0) - (a.quote.USD.volume_24h ?? 0)).slice(0, 6);
    const btcH = await getOhlcvHistorical("BTC", count).catch(() => null);
    const btc = btcH?.data.quotes.map((q) => q.quote.USD.close) ?? [];
    const coins: Coin[] = [];
    for (const c of picks) {
      const h = await getOhlcvHistorical(c.symbol, count).catch(() => null);
      const qs = h?.data.quotes ?? [];
      if (qs.length > 45) coins.push({ symbol: c.symbol, price: qs.map((q) => q.quote.USD.close), vol: qs.map((q) => (q.quote.USD as { close: number; volume?: number }).volume ?? 0), mcap: c.quote.USD.market_cap });
    }
    if (coins.length >= 3 && btc.length > 45) return { coins, btc };
  } catch { /* fall through */ }
  return null;
}

export async function runAltcoinBacktest(count = 365, forceMock = false): Promise<AltBacktestResult> {
  let uni: { coins: Coin[]; btc: number[] } | null = null;
  let source: "cmc" | "mock" = "mock";
  if (!forceMock) { uni = await realUniverse(count); if (uni) source = "cmc"; }
  if (!uni) uni = synthUniverse(Math.max(120, Math.min(count, 730)));
  const { coins, btc } = uni;

  const perSkill: number[][] = ALTCOIN_SKILLS.map(() => []);
  const holdRet: number[] = [];

  for (const coin of coins) {
    const p = coin.price; const len = Math.min(p.length, btc.length);
    for (let i = 30; i < len - 1; i++) {
      const window = p.slice(Math.max(0, i - 60), i + 1);
      const data: AltCoinData = {
        symbol: coin.symbol, name: coin.symbol, price: p[i],
        pctChange24h: pct(p[i], p[i - 1]), pctChange7d: pct(p[i], p[i - 7]), pctChange30d: pct(p[i], p[i - 30]),
        marketCap: coin.mcap, volume24h: coin.vol[i] ?? 0,
        rsi: rsiCalc(window) ?? 50, macd: macdHistogram(window), ema: emaLast(p, i, 21), sma: sma(p, i, 50),
        btcRel7d: pct(p[i], p[i - 7]) - pct(btc[i], btc[i - 7]),
      };
      const nret = pct(p[i + 1], p[i]) / 100;
      holdRet.push(nret);
      ALTCOIN_SKILLS.forEach((sk, si) => { perSkill[si].push(sk.evaluate(data).signal === "BUY" ? nret : 0); });
    }
  }

  const holdM = metrics(holdRet);
  const skills = ALTCOIN_SKILLS.map((sk, si) => { const m = metrics(perSkill[si]); return { id: sk.id, name: sk.name, hub: sk.hub, ...m }; }).sort((a, b) => b.sharpe - a.sharpe);

  return {
    source, days: holdRet.length, universe: coins.map((c) => c.symbol),
    hold: { totalReturn: holdM.totalReturn, sharpe: holdM.sharpe, maxDrawdown: holdM.maxDrawdown },
    skills,
    note: `Each altcoin skill applied long-only across ${coins.length} altcoins (BUY = hold spot, else cash), returns pooled. ${source === "cmc" ? "Real CMC OHLCV." : "Synthetic altcoin universe (logic proof)."} Whale/holder/narrative skills have no historical feed and stay flat.`,
  };
}
