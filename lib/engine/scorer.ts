// Talons Regime Engine — Layer B: per-coin scorer (SKILL.md §5).
// Each eligible coin gets sub-signals in [-100,+100], combined with regime weights,
// then the market tilts are applied as a multiplier.

import type { CoinInput, CoinScore, MarketSignals, MarketTilts, RegimeResult, Direction } from "./types";
import { REGIME_CONFIG, ENTRY_THRESHOLD, EXIT_THRESHOLD } from "./weights";
import { SCORER, SIZING, isStable } from "./config";

interface ScoreArgs {
  coins: CoinInput[];
  btc: CoinInput; // BTC reference for relative strength
  regime: RegimeResult;
  tilts: MarketTilts;
  market: MarketSignals;
  opts?: ScoreOpts;
  prevPositions?: Record<string, Direction>;
}

export interface ScoreOpts {
  /** scan the whole liquid market instead of the regime's focused universe. */
  fullScan?: boolean;
  /** override the number of ranked names returned. */
  topN?: number;
  /** minimum 24h volume to be eligible in full-scan mode. */
  minVolume?: number;
  /** scale exposure by regime confidence. */
  confidenceScaling?: boolean;
  /** keep FLAT (no-trade) results in the ranking — used for single-coin analyze. */
  includeFlat?: boolean;
}

export function scoreCoins({ coins, btc, regime, tilts, market, opts = {}, prevPositions = {} }: ScoreArgs): CoinScore[] {
  const cfg = REGIME_CONFIG[regime.regime];
  const minVol = opts.minVolume ?? SIZING.minVolumeFullScan;
  const eligible = opts.fullScan
    ? coins.filter((c) => c.volume24h >= minVol && !isStable(c.symbol, c.name))
    : filterUniverse(coins, cfg.universe);
  const topN = opts.topN ?? (opts.fullScan ? SIZING.fullScanTopN : cfg.topN);

  // exposure scales with regime confidence when requested (low conviction → smaller book)
  const budget = opts.confidenceScaling
    ? regime.riskBudget * (0.5 + 0.5 * regime.confidence)
    : regime.riskBudget;

  const scored = eligible.map((c) => {
    const { s, avail } = subSignals(c, btc);
    const w = cfg.weights;
    // Effective weights: only count signals that actually have data, so the
    // available signals carry full weight when flow/funding are absent (Basic key).
    const ew = {
      momentum: w.momentum,
      meanReversion: w.meanReversion,
      relStrength: w.relStrength,
      flow: avail.flow ? w.flow : 0,
      funding: avail.funding ? w.funding : 0,
    };
    const wsum = ew.momentum + ew.meanReversion + ew.relStrength + ew.flow + ew.funding;
    let composite =
      (s.momentum * ew.momentum +
        s.meanReversion * ew.meanReversion +
        s.relStrength * ew.relStrength +
        s.flow * ew.flow +
        s.funding * ew.funding) /
      Math.max(wsum, 1e-6);

    // apply market tilts as additive nudges scaled by their regime weight
    const tiltAdj =
      tilts.etfDivergence * w.etfDivergence * SCORER.tiltScale +
      tilts.sentimentDivergence * w.sentimentDivergence * SCORER.tiltScale;
    composite = clamp(composite + tiltAdj, -100, 100);

    // Trend participation: in non-defensive regimes a clear, established trend should
    // not be cancelled out by the mean-reversion term — the engine should ride it.
    // RISK_OFF / CAPITULATION stay defensive (no floor), preserving drawdown control.
    const defensive = regime.regime === "RISK_OFF" || regime.regime === "CAPITULATION";
    if (!defensive) {
      const trend = c.pctChange7d * 0.6 + c.pctChange30d * 0.4; // blended % trend
      if (trend > SCORER.trendFloorPct) {
        const floor = clamp(trend * SCORER.trendParticipation, 0, 40);
        if (composite < floor) composite = floor; // engage the uptrend
      } else if (trend < -SCORER.trendFloorPct) {
        const floor = clamp(trend * SCORER.trendParticipation, -40, 0);
        if (composite > floor) composite = floor; // engage the downtrend
      }
    }

    const prev = prevPositions[c.symbol] ?? "FLAT";
    const direction = applyHysteresis(composite, prev);

    return { coin: c, score: round1(composite), direction, signals: s };
  });

  // rank by absolute conviction, keep top-N (optionally including FLAT for single-coin)
  const ranked = scored
    .filter((x) => opts.includeFlat || x.direction !== "FLAT")
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, topN);

  // size: regime risk budget split across names, weighted by conviction
  const convSum = ranked.reduce((acc, x) => acc + Math.abs(x.score), 0) || 1;
  return ranked.map((x, i) => ({
    rank: i + 1,
    symbol: x.coin.symbol,
    name: x.coin.name,
    slug: x.coin.slug,
    price: x.coin.price,
    change24h: x.coin.pctChange24h,
    marketCap: x.coin.marketCap,
    score: x.score,
    direction: x.direction,
    targetWeight: round3((Math.abs(x.score) / convSum) * budget),
    signals: x.signals,
  }));
}

// --- sub-signals, each normalized to [-100, +100], plus availability flags ---
function subSignals(c: CoinInput, btc: CoinInput) {
  // Momentum: blend of 7d/30d trend + MACD histogram sign (when OHLCV-derived).
  let momentum = c.pctChange7d * SCORER.momentum7d + c.pctChange30d * SCORER.momentum30d;
  if (typeof c.macdHistogram === "number") {
    momentum = momentum * SCORER.macdBlend + Math.sign(c.macdHistogram) * SCORER.macdWeight;
  }
  momentum = clamp(momentum, -100, 100);

  // Mean-reversion: fade short-term extremes (uses RSI if present, else 24h move)
  let meanReversion: number;
  if (typeof c.rsi === "number") {
    meanReversion = clamp((50 - c.rsi) * SCORER.meanReversionRsi, -100, 100);
  } else {
    meanReversion = clamp(-c.pctChange24h * SCORER.meanReversion24h, -100, 100);
  }

  // Relative strength vs BTC over 7d
  const relStrength = clamp((c.pctChange7d - btc.pctChange7d) * SCORER.relStrength, -100, 100);

  // Flow: exchange outflow bullish, inflow bearish
  const flowAvail = typeof c.exchangeNetflow === "number";
  const flow = flowAvail ? clamp(-(c.exchangeNetflow as number), -100, 100) : 0;

  // Funding: extreme positive funding penalizes longs (crowded), negative supports
  const fundingAvail = typeof c.fundingRate === "number";
  const funding = fundingAvail ? clamp(-(c.fundingRate as number) * SCORER.fundingScale, -100, 100) : 0;

  return {
    s: {
      momentum: round1(momentum),
      meanReversion: round1(meanReversion),
      relStrength: round1(relStrength),
      flow: round1(flow),
      funding: round1(funding),
    },
    avail: { flow: flowAvail, funding: fundingAvail },
  };
}

function filterUniverse(coins: CoinInput[], universe: string): CoinInput[] {
  const bySym = (syms: string[]) => coins.filter((c) => syms.includes(c.symbol));
  switch (universe) {
    case "BTC_ETH_ONLY":
      return bySym(["BTC", "ETH"]);
    case "BTC_AND_LARGECAPS":
      return coins.filter((c) => c.marketCap >= 10e9); // >$10B
    case "HIGH_LIQ_ONLY":
      return coins.filter((c) => c.volume24h >= 5e8); // >$500M 24h vol
    case "ALTS_AND_ETH":
    default:
      return coins.filter((c) => c.symbol !== "BTC");
  }
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/**
 * Entry/exit rules with hysteresis:
 *  - open a position only when |score| crosses ENTRY_THRESHOLD,
 *  - hold an existing position until |score| fades below EXIT_THRESHOLD,
 *  - flip directly when score crosses the opposite ENTRY_THRESHOLD.
 */
function applyHysteresis(score: number, prev: Direction): Direction {
  if (prev === "LONG") {
    if (score < -ENTRY_THRESHOLD) return "SHORT"; // flip
    return score > EXIT_THRESHOLD ? "LONG" : "FLAT"; // hold while still convicted
  }
  if (prev === "SHORT") {
    if (score > ENTRY_THRESHOLD) return "LONG"; // flip
    return score < -EXIT_THRESHOLD ? "SHORT" : "FLAT";
  }
  // previously flat → need full entry conviction
  return score > ENTRY_THRESHOLD ? "LONG" : score < -ENTRY_THRESHOLD ? "SHORT" : "FLAT";
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const round3 = (x: number) => Math.round(x * 1000) / 1000;
