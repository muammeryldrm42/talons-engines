// Talons Regime Engine — regime config + the regime→weight matrix.
// These are the first-draft CALIBRATION PARAMETERS (SKILL.md §9).
// Tune these; they are the quant work.

import type { RegimeName } from "./types";

export interface SubSignalWeights {
  momentum: number;
  meanReversion: number;
  relStrength: number;
  flow: number;
  funding: number;
  // market-wide tilts (applied as multipliers to the composite)
  etfDivergence: number;
  sentimentDivergence: number;
}

export interface RegimeConfig {
  label: string;
  riskBudget: number; // 0-1 max gross exposure
  topN: number; // how many coins to allocate to
  // universe filter: which assets are eligible in this regime
  universe: "ALTS_AND_ETH" | "BTC_AND_LARGECAPS" | "HIGH_LIQ_ONLY" | "BTC_ETH_ONLY";
  weights: SubSignalWeights;
}

// Weights are relative; the scorer normalizes by their sum.
export const REGIME_CONFIG: Record<RegimeName, RegimeConfig> = {
  ALT_SEASON_RISK_ON: {
    label: "Alt Season · Risk-On",
    riskBudget: 1.0,
    topN: 8,
    universe: "ALTS_AND_ETH",
    weights: {
      momentum: 3, meanReversion: 0.5, relStrength: 3, flow: 1.5, funding: 1.5,
      etfDivergence: 1.5, sentimentDivergence: 1.5,
    },
  },
  BTC_LED_RISK_ON: {
    label: "BTC-Led · Risk-On",
    riskBudget: 0.8,
    topN: 4,
    universe: "BTC_AND_LARGECAPS",
    weights: {
      momentum: 3, meanReversion: 0.5, relStrength: 2, flow: 1.5, funding: 1.5,
      etfDivergence: 1.5, sentimentDivergence: 1,
    },
  },
  CHOP: {
    label: "Chop · Neutral",
    riskBudget: 0.4,
    topN: 3,
    universe: "HIGH_LIQ_ONLY",
    weights: {
      momentum: 1, meanReversion: 3, relStrength: 1, flow: 1.5, funding: 1.5,
      etfDivergence: 1.5, sentimentDivergence: 1.5,
    },
  },
  RISK_OFF: {
    label: "Risk-Off · Fear",
    riskBudget: 0.2,
    topN: 2,
    universe: "BTC_ETH_ONLY",
    weights: {
      momentum: 1, meanReversion: 2, relStrength: 1, flow: 3, funding: 3,
      etfDivergence: 3, sentimentDivergence: 3,
    },
  },
  CAPITULATION: {
    label: "Capitulation",
    riskBudget: 0.5,
    topN: 2,
    universe: "BTC_ETH_ONLY",
    weights: {
      momentum: 0.5, meanReversion: 2, relStrength: 1, flow: 3, funding: 3.5,
      etfDivergence: 4, sentimentDivergence: 3,
    },
  },
};

// Score thresholds for direction (hysteresis) — sourced from central config.
import { SIZING } from "./config";
export const ENTRY_THRESHOLD = SIZING.entryThreshold;
export const EXIT_THRESHOLD = SIZING.exitThreshold;
