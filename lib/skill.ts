// THE SKILL. This is the canonical, framework-free entrypoint an LLM agent invokes.
// Everything else (Next.js routes, dashboard, backtest) is just a consumer of this.
// Pure and deterministic → fully replayable by judges on any historical snapshot.

import { runEngine } from "./engine";
import type { CoinInput, EngineDecision, MarketSignals } from "./engine/types";
import type { ScoreOpts } from "./engine/scorer";
import { buildRationale, coinRationale } from "./rationale";

export interface SkillInput {
  asOf: string;
  market: MarketSignals;
  coins: CoinInput[];
  /** previous regime for transition detection (optional). */
  prevRegime?: string;
  /** previously held directional positions for entry/exit hysteresis (optional). */
  prevPositions?: Record<string, "LONG" | "SHORT" | "FLAT">;
  options?: ScoreOpts;
}

/**
 * Evaluate the strategy on one market snapshot and return a decision.
 * This is the unit a CMC Agent Hub skill / MCP tool / backtest all call.
 */
export function evaluate(input: SkillInput): EngineDecision {
  const decision = runEngine({
    asOf: input.asOf,
    market: input.market,
    coins: input.coins,
    prevRegime: input.prevRegime,
    prevPositions: input.prevPositions,
    opts: input.options ?? { confidenceScaling: true },
  });
  decision.rationale = buildRationale(decision);
  decision.rankedCoins = decision.rankedCoins.map((c) => ({
    ...c,
    rationale: coinRationale(c.symbol, c.signals),
  }));
  return decision;
}

export type { EngineDecision, MarketSignals, CoinInput };
