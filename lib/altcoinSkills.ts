// Agent-Hub-powered ALTCOIN skills. Each is a pure function over a single altcoin's
// live data (CMC listings + CMC Agent Hub technicals/metrics/narratives). Skills that
// need Hub-only inputs (RSI/MACD, whale/holder structure, trending narrative) return
// NEUTRAL when that input is missing, so nothing is fabricated.
export type AltSignal = "BUY" | "SELL" | "NEUTRAL";
export interface AltVerdict { signal: AltSignal; score: number; reason: string }

export interface AltCoinData {
  symbol: string; name: string; id?: number;
  price: number; pctChange24h: number; pctChange7d: number; pctChange30d: number;
  marketCap: number; volume24h: number;
  rsi?: number; macd?: number; ema?: number; sma?: number;      // CMC Agent Hub technicals
  whaleShare?: number; holderRatio?: number;                    // CMC Agent Hub crypto metrics
  inTrendingNarrative?: boolean; narrative?: string;            // CMC Agent Hub narratives
  btcRel7d?: number;                                            // vs BTC 7d
}
export interface AltSkill {
  id: string; name: string; summary: string; inputs: string[]; hub: boolean;
  evaluate(c: AltCoinData): AltVerdict;
}

const sig = (s: number): AltSignal => (s >= 15 ? "BUY" : s <= -15 ? "SELL" : "NEUTRAL");
const pctS = (v?: number) => `${(v ?? 0) >= 0 ? "+" : ""}${(v ?? 0).toFixed(1)}%`;
const turnover = (c: AltCoinData) => (c.marketCap ? c.volume24h / c.marketCap : 0);

export const ALTCOIN_SKILLS: AltSkill[] = [
  {
    id: "alt-momentum", name: "Altcoin Momentum", hub: false,
    summary: "Ranks trend strength from 7d and 30d price change.", inputs: ["quotes"],
    evaluate(c) { const s = c.pctChange7d * 1.2 + c.pctChange30d * 0.5; return { signal: sig(s), score: Math.round(s), reason: `7d ${pctS(c.pctChange7d)} / 30d ${pctS(c.pctChange30d)} - ${sig(s) === "BUY" ? "momentum favors accumulation" : sig(s) === "SELL" ? "momentum rolling over" : "no clear momentum"}.` }; },
  },
  {
    id: "alt-rsi", name: "Altcoin RSI Reversion", hub: true,
    summary: "Buys oversold, fades overbought using live Agent Hub RSI.", inputs: ["agent-hub: RSI"],
    evaluate(c) { if (c.rsi == null) return { signal: "NEUTRAL", score: 0, reason: "no Agent Hub RSI." }; const s = c.rsi < 32 ? 30 : c.rsi > 70 ? -30 : 0; return { signal: sig(s), score: s, reason: `RSI ~${Math.round(c.rsi)} - ${s > 0 ? "oversold, reversion bounce" : s < 0 ? "overbought, fade" : "mid-range"}.` }; },
  },
  {
    id: "alt-macd", name: "Altcoin MACD Momentum", hub: true,
    summary: "Reads MACD histogram sign from the Agent Hub.", inputs: ["agent-hub: MACD"],
    evaluate(c) { if (c.macd == null) return { signal: "NEUTRAL", score: 0, reason: "no Agent Hub MACD." }; const s = c.macd > 0 ? 22 : c.macd < 0 ? -22 : 0; return { signal: sig(s), score: s, reason: `MACD histogram ${c.macd > 0 ? "positive - bullish" : c.macd < 0 ? "negative - bearish" : "flat"}.` }; },
  },
  {
    id: "alt-trend-structure", name: "Trend Structure (EMA/SMA)", hub: true,
    summary: "Price stacked above/below its Agent Hub moving averages.", inputs: ["agent-hub: EMA, SMA"],
    evaluate(c) { if (c.ema == null || c.sma == null) return { signal: "NEUTRAL", score: 0, reason: "no Agent Hub moving averages." }; const up = c.price > c.ema && c.ema > c.sma, dn = c.price < c.ema && c.ema < c.sma; const s = up ? 26 : dn ? -26 : 0; return { signal: sig(s), score: s, reason: up ? "price > EMA > SMA - clean uptrend structure." : dn ? "price < EMA < SMA - downtrend structure." : "moving averages tangled." }; },
  },
  {
    id: "alt-volume-surge", name: "Volume Surge", hub: false,
    summary: "Flags unusual turnover (24h volume vs market cap) with momentum.", inputs: ["quotes"],
    evaluate(c) { const t = turnover(c); const s = t > 0.25 && c.pctChange7d > 0 ? 24 : t > 0.25 && c.pctChange7d < 0 ? -18 : 0; return { signal: sig(s), score: s, reason: `turnover ${(t * 100).toFixed(0)}% of cap - ${s > 0 ? "high volume confirming strength" : s < 0 ? "high volume into weakness" : "normal volume"}.` }; },
  },
  {
    id: "alt-rel-strength", name: "Relative Strength vs BTC", hub: false,
    summary: "Outperformance vs BTC over 7d.", inputs: ["quotes", "BTC 7d"],
    evaluate(c) { if (c.btcRel7d == null) return { signal: "NEUTRAL", score: 0, reason: "no BTC reference." }; const s = c.btcRel7d > 5 ? 22 : c.btcRel7d < -5 ? -22 : 0; return { signal: sig(s), score: s, reason: `${pctS(c.btcRel7d)} vs BTC (7d) - ${s > 0 ? "leading the market" : s < 0 ? "lagging BTC" : "in line with BTC"}.` }; },
  },
  {
    id: "alt-whale-accumulation", name: "Whale Accumulation", hub: true,
    summary: "Concentration in large holders (Agent Hub crypto metrics) with a bid.", inputs: ["agent-hub: holder value distribution"],
    evaluate(c) { if (c.whaleShare == null) return { signal: "NEUTRAL", score: 0, reason: "no Agent Hub holder data." }; const s = c.whaleShare > 60 && c.pctChange7d > -5 ? 20 : 0; return { signal: sig(s), score: s, reason: `whales hold ~${Math.round(c.whaleShare)}% - ${s > 0 ? "large holders dominant and not selling" : "no clear whale edge"}.` }; },
  },
  {
    id: "alt-holder-conviction", name: "Holder Conviction", hub: true,
    summary: "Long-term holders vs short-term traders (Agent Hub holder time).", inputs: ["agent-hub: holder time buckets"],
    evaluate(c) { if (c.holderRatio == null) return { signal: "NEUTRAL", score: 0, reason: "no Agent Hub holder-time data." }; const s = c.holderRatio > 1.3 ? 18 : c.holderRatio < 0.7 ? -18 : 0; return { signal: sig(s), score: s, reason: `holders/traders ${c.holderRatio.toFixed(2)} - ${s > 0 ? "conviction base, low churn" : s < 0 ? "trader-heavy, weak hands" : "balanced base"}.` }; },
  },
  {
    id: "alt-narrative", name: "Narrative Momentum", hub: true,
    summary: "Coin sits in a trending narrative (Agent Hub) with positive drift.", inputs: ["agent-hub: trending narratives"],
    evaluate(c) { if (!c.inTrendingNarrative) return { signal: "NEUTRAL", score: 0, reason: "not in a trending narrative." }; const s = c.pctChange7d > 0 ? 20 : 0; return { signal: sig(s), score: s, reason: `in trending narrative${c.narrative ? ` (${c.narrative})` : ""} ${s > 0 ? "with positive drift - rotation candidate" : "but drift flat"}.` }; },
  },
  {
    id: "alt-breakout", name: "Breakout Watch", hub: true,
    summary: "Strong 7d thrust not yet overextended on RSI.", inputs: ["quotes", "agent-hub: RSI"],
    evaluate(c) { const hot = c.pctChange7d > 15; const okRsi = c.rsi == null || c.rsi < 75; const s = hot && okRsi ? 22 : 0; return { signal: sig(s), score: s, reason: hot ? (okRsi ? `+${c.pctChange7d.toFixed(0)}% 7d thrust, RSI still has room - breakout.` : "thrusting but RSI stretched - wait.") : "no breakout thrust." }; },
  },
  {
    id: "alt-dip-buyer", name: "Dip-in-Uptrend", hub: false,
    summary: "Short-term pullback inside a 30d uptrend.", inputs: ["quotes"],
    evaluate(c) { const s = c.pctChange30d > 10 && c.pctChange24h < -3 ? 20 : 0; return { signal: sig(s), score: s, reason: s > 0 ? `30d ${pctS(c.pctChange30d)} uptrend, 24h ${pctS(c.pctChange24h)} pullback - dip to buy.` : "no dip-in-uptrend setup." }; },
  },
  {
    id: "alt-overextension", name: "Overextension Guard", hub: true,
    summary: "Warns when a coin is parabolic or RSI-stretched.", inputs: ["quotes", "agent-hub: RSI"],
    evaluate(c) { const s = (c.rsi != null && c.rsi > 78) || c.pctChange7d > 60 ? -24 : 0; return { signal: sig(s), score: s, reason: s < 0 ? `${c.rsi != null && c.rsi > 78 ? `RSI ~${Math.round(c.rsi)}` : `+${c.pctChange7d.toFixed(0)}% 7d`} - overextended, chase risk.` : "not overextended." }; },
  },
  {
    id: "alt-liquidity-health", name: "Liquidity Health", hub: false,
    summary: "Avoids thin, illiquid names (very low turnover).", inputs: ["quotes"],
    evaluate(c) { const t = turnover(c); const s = t < 0.015 ? -20 : 0; return { signal: sig(s), score: s, reason: s < 0 ? `turnover only ${(t * 100).toFixed(1)}% of cap - too thin to trade cleanly.` : "liquidity adequate." }; },
  },
  {
    id: "alt-momentum-divergence", name: "Momentum Divergence", hub: true,
    summary: "Price vs RSI disagreement (Agent Hub RSI).", inputs: ["quotes", "agent-hub: RSI"],
    evaluate(c) { if (c.rsi == null) return { signal: "NEUTRAL", score: 0, reason: "no Agent Hub RSI." }; const s = c.pctChange7d > 10 && c.rsi < 50 ? -20 : c.pctChange7d < -10 && c.rsi > 50 ? 20 : 0; return { signal: sig(s), score: s, reason: s < 0 ? "price up but RSI weak - bearish divergence." : s > 0 ? "price down but RSI firm - bullish divergence." : "price and RSI aligned." }; },
  },
];
