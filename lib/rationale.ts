// Natural-language rationale — the field that makes this an LLM *skill* (SKILL.md §7).
// Template-based so it always works offline; swap buildRationale for an Anthropic
// API call if ANTHROPIC_API_KEY is set and you want generative phrasing.

import type { EngineDecision } from "./engine/types";

const REGIME_BLURB: Record<string, string> = {
  CAPITULATION:
    "Extreme fear with a sharp drawdown. Momentum is heavily down-weighted here; the engine leans on accumulation divergence (ETF inflows / exchange outflows / negative funding) for contrarian entries.",
  RISK_OFF:
    "Fear with capital rotating into BTC. Defensive posture — only high-conviction flow/funding divergences earn exposure.",
  CHOP:
    "Neutral, trendless tape. Mean-reversion dominates; momentum is muted and size is cut.",
  BTC_LED_RISK_ON:
    "Risk-on with BTC leading and alts lagging. Exposure concentrates in BTC and large caps on momentum.",
  ALT_SEASON_RISK_ON:
    "Risk-on alt season — capital flowing down the risk curve. Momentum and relative strength on alts/ETH carry the most weight.",
};

export function buildRationale(d: EngineDecision): string {
  const m = d.market;
  const parts: string[] = [];
  parts.push(`Regime: ${m.regimeLabel} (confidence ${(m.regimeConfidence * 100).toFixed(0)}%).`);
  parts.push(REGIME_BLURB[m.regime] ?? "");

  const tiltBits: string[] = [];
  if (m.tilts.etfDivergence > 0.2) tiltBits.push("bullish ETF-flow divergence (smart money accumulating)");
  if (m.tilts.etfDivergence < -0.2) tiltBits.push("bearish ETF-flow divergence (distribution)");
  if (m.tilts.sentimentDivergence > 0.2) tiltBits.push("fearful crowd vs accumulation (bottoming signal)");
  if (m.tilts.sentimentDivergence < -0.2) tiltBits.push("greedy crowd vs distribution (warning)");
  if (tiltBits.length) parts.push(`Market tilt: ${tiltBits.join("; ")}.`);

  if (m.riskFlags.length) parts.push(`Risk veto: ${m.riskFlags.join("; ")}.`);

  if (d.rankedCoins.length === 0) {
    parts.push("No position passes the conviction threshold — staying flat.");
  } else {
    const longs = d.rankedCoins.filter((c) => c.direction === "LONG").map((c) => c.symbol);
    const shorts = d.rankedCoins.filter((c) => c.direction === "SHORT").map((c) => c.symbol);
    const bits: string[] = [];
    if (longs.length) bits.push(`long ${longs.join(", ")}`);
    if (shorts.length) bits.push(`short ${shorts.join(", ")}`);
    parts.push(
      `Decision: ${bits.join(" / ")} at ${(d.totalTargetExposure * 100).toFixed(0)}% gross exposure.`,
    );
  }
  return parts.filter(Boolean).join(" ");
}

// Per-coin one-liner for the ranked table.
export function coinRationale(
  symbol: string,
  signals: { momentum: number; meanReversion: number; flow: number; funding: number },
): string {
  const bits: string[] = [];
  if (signals.momentum > 20) bits.push("strong momentum");
  else if (signals.momentum < -20) bits.push("negative momentum (down-weighted by regime)");
  if (signals.flow > 20) bits.push("exchange outflows (accumulation)");
  else if (signals.flow < -20) bits.push("exchange inflows (distribution)");
  if (signals.funding > 20) bits.push("supportive funding");
  if (signals.meanReversion > 20) bits.push("oversold");
  else if (signals.meanReversion < -20) bits.push("overbought");
  return bits.length ? `${symbol}: ${bits.join(", ")}.` : `${symbol}: mixed signals.`;
}
