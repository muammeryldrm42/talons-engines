// Talons Regime Engine — Layer A: regime classifier (SKILL.md §4).
// Two axes: risk appetite (F&G + BTC trend) and leadership (dominance trend + altseason).

import type { MarketSignals, RegimeResult, RegimeName } from "./types";
import { REGIME_CONFIG } from "./weights";
import { REGIME_THRESHOLDS as T, DERIVATIVES } from "./config";

export function classifyRegime(s: MarketSignals): RegimeResult {
  const reasons: string[] = [];
  const fg = s.fearGreed;
  const alt = s.altseasonIndex;
  const dom = s.btcDominanceTrend;
  const btc7 = s.btcReturn7d;

  let regime: RegimeName;

  // Priority order: extreme states first, then risk-on (split by leadership), else chop.
  if (fg < T.fgExtremeLow && btc7 < T.btcSharpDown) {
    regime = "CAPITULATION";
    reasons.push(`Extreme fear (F&G ${fg})`, `BTC down ${btc7.toFixed(1)}% (7d)`);
  } else if (fg < T.fgLow && btc7 < T.btcTrendUp) {
    regime = "RISK_OFF";
    reasons.push(`Fear (F&G ${fg})`, dom >= 0 ? "Dominance rising — flight to BTC" : "Weak tape");
  } else if (fg > T.fgMidHigh && btc7 > T.btcTrendUp) {
    // risk-on — split by leadership
    if (alt > T.altSeasonHi || dom <= T.domTrendDown) {
      regime = "ALT_SEASON_RISK_ON";
      reasons.push(`Greed (F&G ${fg})`, `Alts leading (altseason ${alt}${dom <= T.domTrendDown ? ", dominance falling" : ""})`);
    } else {
      regime = "BTC_LED_RISK_ON";
      reasons.push(`Greed (F&G ${fg})`, "BTC leading, alts lagging");
    }
  } else {
    regime = "CHOP";
    reasons.push(`Neutral sentiment (F&G ${fg})`, "No clear leadership trend");
  }

  // Derivatives positioning can switch or adjust the regime (Track 2 example #3).
  const adj = applyDerivatives(regime, s, reasons);
  regime = adj.regime;

  // Agent-Hub market context (ETF demand, whole-market RSI, liquidation risk).
  // Optional inputs — degrades to a no-op when the Hub data is absent.
  const hub = applyHubContext(regime, s, reasons);
  const breadth = applyCmc100Breadth(regime, s, reasons);

  return {
    regime,
    confidence: Math.max(0.2, Math.min(0.97, round2(adj.confidenceScale * hub.confidenceScale * breadth.confidenceScale * regimeConfidence(s, regime)))),
    riskBudget: REGIME_CONFIG[regime].riskBudget,
    label: REGIME_CONFIG[regime].label,
    reasons,
  };
}

// Agent-Hub context layer: institutional ETF demand, the whole crypto market's
// technical posture (total-market-cap RSI), and liquidation-cascade risk sharpen
// or temper the regime's conviction. Every input is optional — when the Agent Hub
// is unavailable this is a pure no-op, so the base engine is never affected.
function applyHubContext(
  regime: RegimeName,
  s: MarketSignals,
  reasons: string[],
): { confidenceScale: number } {
  let scale = 1;
  const riskOn = regime === "ALT_SEASON_RISK_ON" || regime === "BTC_LED_RISK_ON";

  // ETF flows = institutional demand. Confirmation boosts conviction; divergence tempers it.
  if (typeof s.etfNetFlowZ === "number") {
    const z = s.etfNetFlowZ;
    if (riskOn && z > 0.5) { reasons.push("Agent Hub: ETF inflows confirm institutional risk-on"); scale *= 1.12; }
    else if (riskOn && z < -0.5) { reasons.push("Agent Hub: ETF outflows diverge from price — distribution risk"); scale *= 0.85; }
    else if ((regime === "RISK_OFF" || regime === "CAPITULATION") && z < -0.5) { reasons.push("Agent Hub: ETF outflows confirm risk-off"); scale *= 1.1; }
    else if ((regime === "RISK_OFF" || regime === "CHOP") && z > 0.5) { reasons.push("Agent Hub: ETF inflows into weakness — institutions accumulating the fear"); scale *= 1.08; }
  }

  // Whole-market technical posture (total-market-cap RSI from the Agent Hub).
  if (typeof s.marketRsi === "number") {
    if (s.marketRsi >= 72) { reasons.push(`Agent Hub: whole market overbought (mkt RSI ${s.marketRsi.toFixed(0)})`); if (riskOn) scale *= 0.85; }
    else if (s.marketRsi <= 28) { reasons.push(`Agent Hub: whole market oversold (mkt RSI ${s.marketRsi.toFixed(0)})`); if (regime === "CAPITULATION" || regime === "RISK_OFF") scale *= 1.12; }
  }

  // Leverage / liquidation-cascade risk (conservative): a flagged cascade puts entries on hold.
  if (s.liquidationCascade) { reasons.push("Agent Hub: liquidation cascade flagged — entries on hold"); scale *= 0.85; }

  return { confidenceScale: Math.max(0.6, Math.min(1.4, scale)) };
}

// CMC100 breadth confirmation — gated; no-op when the index trend is absent.
// A rising broad market confirms risk-on; a falling one diverges and argues caution.
function applyCmc100Breadth(
  regime: RegimeName,
  s: MarketSignals,
  reasons: string[],
): { confidenceScale: number } {
  if (s.cmc100Trend == null) return { confidenceScale: 1 };
  const t = s.cmc100Trend; // 30d % change of the CMC100 index
  const riskOn = regime === "ALT_SEASON_RISK_ON" || regime === "BTC_LED_RISK_ON";
  let scale = 1;
  if (riskOn) {
    if (t > 5) { reasons.push(`CMC100 breadth: broad market +${t.toFixed(1)}% (30d) confirms risk-on`); scale *= 1.08; }
    else if (t < -5) { reasons.push(`CMC100 breadth: broad market ${t.toFixed(1)}% (30d) diverges from risk-on — caution`); scale *= 0.88; }
  } else if (regime === "CHOP") {
    if (t > 6) { reasons.push(`CMC100 breadth: broad market firming +${t.toFixed(1)}% (30d)`); scale *= 1.05; }
    else if (t < -6) { reasons.push(`CMC100 breadth: broad market weak ${t.toFixed(1)}% (30d)`); scale *= 0.95; }
  } else if (t < -8) {
    reasons.push(`CMC100 breadth: broad market ${t.toFixed(1)}% (30d) confirms risk-off`); scale *= 1.06;
  }
  return { confidenceScale: Math.max(0.7, Math.min(1.3, scale)) };
}

// Funding / open-interest positioning: crowded longs cool risk-on; a leverage
// washout (deeply negative funding + falling OI in a downtrend) escalates to
// capitulation. Degrades to a no-op when derivatives data is absent (backtest).
function applyDerivatives(
  regime: RegimeName,
  s: MarketSignals,
  reasons: string[],
): { regime: RegimeName; confidenceScale: number } {
  const f = s.aggFundingRate;
  const oi = s.openInterestChange;
  let confidenceScale = 1;

  if (typeof f === "number") {
    const riskOn = regime === "ALT_SEASON_RISK_ON" || regime === "BTC_LED_RISK_ON";
    if (riskOn && f > DERIVATIVES.fundingHot) {
      reasons.push("Derivatives: crowded longs (funding hot) — late-cycle caution");
      confidenceScale = 0.8;
    }
    if ((regime === "RISK_OFF" || regime === "CHOP") && f < DERIVATIVES.fundingWashout && s.btcReturn7d < -5) {
      reasons.push("Derivatives: leverage washout (funding deeply negative) — escalating to capitulation");
      regime = "CAPITULATION";
    } else if (regime === "RISK_OFF" && f < DERIVATIVES.fundingShortCrowd) {
      reasons.push("Derivatives: shorts crowded (negative funding) — contrarian fuel");
      confidenceScale = 1.1;
    }
  }
  if (typeof oi === "number" && regime === "CAPITULATION" && oi < DERIVATIVES.oiCollapse) {
    reasons.push("Derivatives: open interest collapsing — forced deleveraging");
    confidenceScale = Math.min(confidenceScale * 1.15, 1.3);
  }
  return { regime, confidenceScale };
}

// Confidence = how cleanly the inputs agree with the chosen regime. Every regime
// gets a sensible floor so it never reads as a flat 0%, and CHOP is scored by how
// genuinely balanced/indecisive the tape is rather than collapsing when sentiment
// drifts off neutral.
function regimeConfidence(s: MarketSignals, regime: RegimeName): number {
  const fg = s.fearGreed;
  const btc7 = s.btcReturn7d;
  const dom = s.btcDominanceTrend;
  const alt = s.altseasonIndex;
  const FLOOR = 0.2;
  let c = 0.5;
  switch (regime) {
    case "CAPITULATION":
      c = 0.55 + (T.fgExtremeLow - fg) / 40 + (T.btcSharpDown - btc7) / 30;
      break;
    case "RISK_OFF":
      c = 0.45 + (T.fgLow - fg) / 45 + Math.max(0, dom) / 4 + Math.max(0, -btc7) / 25;
      break;
    case "ALT_SEASON_RISK_ON":
      c = 0.42 + (fg - T.fgHigh) / 40 + (alt - T.altSeasonHi) / 25 + Math.max(0, -dom) / 4;
      break;
    case "BTC_LED_RISK_ON":
      c = 0.42 + (fg - T.fgMidHigh) / 45 + Math.max(0, btc7) / 20 + Math.max(0, dom) / 5;
      break;
    case "CHOP": {
      // chop conviction rises the more balanced the inputs are; floored so a
      // fearful-but-trendless tape still reads as a real (moderate) chop call.
      const neutral = 1 - Math.min(1, Math.abs(fg - 50) / 30);   // ~1 when F&G near 50
      const flat = 1 - Math.min(1, Math.abs(btc7) / 12);          // ~1 when BTC flat
      const noLead = 1 - Math.min(1, Math.abs(alt - 50) / 40);    // ~1 when no leadership
      c = 0.32 + 0.28 * neutral + 0.16 * flat + 0.1 * noLead;     // ~0.32–0.86
      break;
    }
  }
  return round2(Math.max(FLOOR, Math.min(0.95, c)));
}

const round2 = (x: number) => Math.round(x * 100) / 100;
