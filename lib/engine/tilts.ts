// Talons Regime Engine — market-wide tilts (SKILL.md §5).
// ETF flow divergence + sentiment divergence. Applied to every coin's composite.

import type { MarketSignals, MarketTilts } from "./types";

/**
 * ETF flow divergence: z(5d net ETF flow) vs BTC price action.
 * Strong inflows + flat/down price → bullish tilt (accumulation not yet priced).
 * Outflows + price up → bearish tilt (distribution).
 * Falls back to 0 (neutral) when ETF flow data is unavailable (e.g. Basic key).
 */
export function computeTilts(s: MarketSignals): MarketTilts {
  let etf = 0;
  if (typeof s.etfNetFlowZ === "number") {
    // divergence = flow z-score minus a price-return proxy (normalized 7d return)
    const priceZ = s.btcReturn7d / 8; // crude normalization
    etf = clamp(s.etfNetFlowZ - priceZ, -1, 1);
  }

  // Sentiment divergence: crowd leg (F&G) vs structure leg (aggregate exchange flow proxy).
  // Greedy + inflows → distribution (bearish). Fearful + outflows → bottom (bullish).
  // Without exchange flow we use F&G as a contrarian-lite proxy at the extremes only.
  const fgCentered = (s.fearGreed - 50) / 50; // -1 (fear) .. +1 (greed)
  let sentiment = 0;
  if (typeof s.etfNetFlowZ === "number") {
    // when we have flow, treat persistent fear + accumulation as bullish divergence
    sentiment = clamp(-fgCentered * 0.6, -1, 1);
  } else {
    // contrarian only at the extremes
    if (s.fearGreed < 20) sentiment = 0.5;
    else if (s.fearGreed > 80) sentiment = -0.5;
  }

  return { etfDivergence: round2(etf), sentimentDivergence: round2(sentiment) };
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const round2 = (x: number) => Math.round(x * 100) / 100;
