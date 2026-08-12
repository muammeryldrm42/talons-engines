// Talons Regime Engine — risk veto (SKILL.md §6). Live layer; sits above scoring.

import type { MarketSignals } from "./types";
import { VETO } from "./config";

export interface VetoResult {
  flags: string[];
  blockNewLongs: boolean;
  forceFlat: boolean;
}

export function evaluateVeto(s: MarketSignals): VetoResult {
  const flags: string[] = [];
  let blockNewLongs = false;
  let forceFlat = false;

  if (typeof s.aggFundingRate === "number" && s.aggFundingRate > VETO.fundingOverheat) {
    flags.push("Funding overheated — new longs blocked");
    blockNewLongs = true;
  }
  if (s.liquidationCascade) {
    flags.push("Liquidation cascade — entries paused");
    blockNewLongs = true;
  }
  if (s.riskFlag) {
    flags.push("CMC risk flag — forced flat");
    forceFlat = true;
  }
  return { flags, blockNewLongs, forceFlat };
}
