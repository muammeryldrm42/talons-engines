// Talons Regime Engine — orchestrator. Ties Layer A + B + veto into one decision.

import type { CoinInput, EngineDecision, MarketSignals, Direction } from "./types";
import { classifyRegime } from "./regime";
import { computeTilts } from "./tilts";
import { scoreCoins, type ScoreOpts } from "./scorer";
import { evaluateVeto } from "./veto";
import { REGIME_CONFIG } from "./weights";

const UNIVERSE_LABEL: Record<string, string> = {
  ALTS_AND_ETH: "Alts + ETH",
  BTC_AND_LARGECAPS: "BTC + large caps",
  HIGH_LIQ_ONLY: "High-liquidity only",
  BTC_ETH_ONLY: "BTC + ETH only",
};

const BIAS: Record<string, string> = {
  ALT_SEASON_RISK_ON: "Risk is ON and altcoins are leading — favor longs in strong alts and ETH; this is the highest-reward, highest-risk regime.",
  BTC_LED_RISK_ON: "Risk is ON but Bitcoin leads — keep longs in BTC and large caps, stay light on smaller alts.",
  CHOP: "No clear trend — trade the range with smaller size, take profits quickly, don't chase breakouts.",
  RISK_OFF: "Money is leaving risk assets — play defense, mostly cash, act only on the strongest setups.",
  CAPITULATION: "Peak fear and forced selling — the contrarian buy-the-blood zone; scale in slowly on BTC/ETH, never all at once.",
};

function buildPlaybook(regime: ReturnType<typeof classifyRegime>) {
  const cfg = REGIME_CONFIG[regime.regime];
  const w = cfg.weights;
  const entries: [string, number][] = [
    ["Momentum", w.momentum], ["Mean-reversion", w.meanReversion],
    ["Relative strength", w.relStrength], ["Exchange flow", w.flow],
    ["Funding", w.funding], ["ETF divergence", w.etfDivergence],
    ["Sentiment divergence", w.sentimentDivergence],
  ];
  const max = Math.max(...entries.map((e) => e[1]));
  return {
    riskBudget: cfg.riskBudget,
    universe: UNIVERSE_LABEL[cfg.universe] ?? cfg.universe,
    directionBias: BIAS[regime.regime] ?? "",
    weights: entries.map(([signal, weight]) => ({
      signal, weight,
      emphasis: (weight >= max * 0.66 ? "high" : weight >= max * 0.33 ? "mid" : "low") as "high" | "mid" | "low",
    })),
  };
}

export interface EngineInput {
  asOf: string;
  market: MarketSignals;
  coins: CoinInput[]; // scanned universe incl. BTC
  opts?: ScoreOpts;
  /** previous regime, for transition detection. */
  prevRegime?: string;
  /** previously held positions, for entry/exit hysteresis. */
  prevPositions?: Record<string, Direction>;
}

export function runEngine({ asOf, market, coins, opts, prevRegime, prevPositions }: EngineInput): EngineDecision {
  const regime = classifyRegime(market);
  const tilts = computeTilts(market);
  const veto = evaluateVeto(market);
  const btc = coins.find((c) => c.symbol === "BTC") ?? coins[0];

  let ranked = scoreCoins({ coins, btc, regime, tilts, market, opts, prevPositions });

  // apply veto
  if (veto.forceFlat) {
    ranked = [];
  } else if (veto.blockNewLongs) {
    ranked = ranked.filter((c) => c.direction !== "LONG");
  }

  const totalTargetExposure = ranked.reduce((acc, c) => acc + c.targetWeight, 0);
  const regimeShift = !!prevRegime && prevRegime !== regime.regime;

  return {
    asOf,
    market: {
      regime: regime.regime,
      regimeLabel: regime.label,
      regimeConfidence: regime.confidence,
      regimeReasons: regime.reasons,
      regimeShift,
      prevRegime: prevRegime ?? null,
      fearGreed: market.fearGreed,
      altseasonIndex: market.altseasonIndex,
      btcDominance: market.btcDominance,
      tilts,
      riskFlags: veto.flags,
      signals: {
        btcReturn7d: market.btcReturn7d,
        btcReturn30d: market.btcReturn30d,
        btcDominanceTrend: market.btcDominanceTrend,
        aggFundingRate: market.aggFundingRate ?? null,
        openInterestChange: market.openInterestChange ?? null,
        liquidationCascade: !!market.liquidationCascade,
      },
      playbook: buildPlaybook(regime),
    },
    rankedCoins: ranked,
    totalTargetExposure: Math.round(totalTargetExposure * 1000) / 1000,
  };
}

export * from "./types";
