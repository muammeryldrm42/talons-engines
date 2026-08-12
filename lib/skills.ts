// A library of composable strategy skills, each evaluated specifically for
// BTC and ETH. Every skill returns a clear BUY / SELL / NEUTRAL verdict per coin
// with a plain-English explanation. Pure functions — independently runnable,
// listed in the manifest, composed by the Regime Engine.

import type { CoinInput, MarketSignals } from "./engine/types";
import type { Globals } from "./cmc/signals";
import { classifyRegime } from "./engine/regime";

export type Signal = "BUY" | "SELL" | "NEUTRAL";

export interface Verdict {
  symbol: string;
  slug?: string;
  signal: Signal;
  score: number;
  reason: string;
}

export interface Skill {
  id: string;
  name: string;
  summary: string;
  entry: string;
  exit: string;
  inputs: string[];
  evaluate(ctx: SkillContext): Verdict[];
}

export interface SkillContext {
  market: MarketSignals;
  coins: CoinInput[];
  globals: Globals | null;
}

const TARGETS = ["BTC", "ETH"];
const clamp = (v: number, lo = -100, hi = 100) => Math.max(lo, Math.min(hi, v));
const round = (v: number) => Math.round(v);
const tanh = (x: number) => Math.tanh(x);
const pct = (v?: number) => `${(v ?? 0) >= 0 ? "+" : ""}${(v ?? 0).toFixed(1)}%`;
function toSignal(score: number): Signal { return score >= 15 ? "BUY" : score <= -15 ? "SELL" : "NEUTRAL"; }
function rsiOf(c: CoinInput): number {
  if (typeof c.rsi === "number") return c.rsi;
  return clamp(50 + c.pctChange24h * 2 + (c.pctChange7d ?? 0) * 0.6, 3, 97);
}
function get(coins: CoinInput[], sym: string) { return coins.find((c) => c.symbol === sym); }

function forTargets(coins: CoinInput[], fn: (c: CoinInput) => { score: number; reason: string } | null): Verdict[] {
  const out: Verdict[] = [];
  for (const sym of TARGETS) {
    const c = get(coins, sym);
    if (!c) continue;
    const r = fn(c);
    if (!r) continue;
    out.push({ symbol: sym, slug: c.slug, signal: toSignal(r.score), score: round(r.score), reason: r.reason });
  }
  return out;
}

const momentum: Skill = {
  id: "momentum",
  name: "Momentum (RSI · MACD · Fear & Greed)",
  summary: "Rides assets with positive trend, confirmed by MACD and a healthy RSI, gated by market Fear & Greed.",
  entry: "7d & 30d momentum positive, MACD >= 0, RSI 45-72, Fear & Greed < 82.",
  exit: "Momentum turns negative, RSI > 75, or Fear & Greed > 85.",
  inputs: ["%change 7d/30d", "RSI/MACD", "Fear & Greed"],
  evaluate({ market, coins }) {
    const fg = market.fearGreed;
    return forTargets(coins, (c) => {
      let s = 60 * tanh(c.pctChange7d / 12) + 40 * tanh((c.pctChange30d ?? 0) / 30);
      const rsi = rsiOf(c);
      if (typeof c.macdHistogram === "number") s += 15 * Math.sign(c.macdHistogram);
      if (rsi > 75) s -= 22;
      if (fg > 82) s -= 18;
      const v = toSignal(s);
      const reason = v === "BUY" ? `7d ${pct(c.pctChange7d)} & 30d ${pct(c.pctChange30d)}, RSI ~${round(rsi)}, F&G ${fg} - trend intact, momentum favors buying.`
        : v === "SELL" ? `7d ${pct(c.pctChange7d)} & 30d ${pct(c.pctChange30d)}, RSI ~${round(rsi)} - momentum rolling over, favors selling.`
        : `mixed momentum (7d ${pct(c.pctChange7d)}, 30d ${pct(c.pctChange30d)}) - no clear edge, stand aside.`;
      return { score: clamp(s), reason };
    });
  },
};

const trendAlignment: Skill = {
  id: "trend-alignment",
  name: "Trend Alignment (multi-timeframe)",
  summary: "Checks whether 24h, 7d, 30d and 90d all point the same way - the cleanest trends are aligned across timeframes.",
  entry: "All four timeframes positive -> buy; all four negative -> sell.",
  exit: "Timeframes diverge.",
  inputs: ["%change 24h/7d/30d/90d"],
  evaluate({ coins }) {
    return forTargets(coins, (c) => {
      const tf = [c.pctChange24h, c.pctChange7d, c.pctChange30d ?? 0, c.pctChange90d ?? 0];
      const up = tf.filter((x) => x > 0).length;
      const s = (up - 2) * 30;
      const v = toSignal(s);
      const reason = `${up}/4 timeframes up (24h ${pct(tf[0])}, 7d ${pct(tf[1])}, 30d ${pct(tf[2])}, 90d ${pct(tf[3])}) - ` +
        (v === "BUY" ? "aligned uptrend." : v === "SELL" ? "aligned downtrend." : "no alignment, choppy.");
      return { score: clamp(s), reason };
    });
  },
};

const meanReversion: Skill = {
  id: "mean-reversion",
  name: "Mean Reversion (RSI extremes)",
  summary: "Fades stretched moves - buys oversold, trims overbought. Best in range-bound markets.",
  entry: "RSI < 32 (oversold) -> buy; RSI > 70 (overbought) -> sell.",
  exit: "RSI reverts toward 50, or a strong trend takes over.",
  inputs: ["RSI", "BTC 7d trend"],
  evaluate({ market, coins }) {
    const trending = Math.abs(market.btcReturn7d) > 9;
    return forTargets(coins, (c) => {
      const rsi = rsiOf(c);
      let s = rsi < 32 ? (32 - rsi) * 2.4 : rsi > 70 ? -(rsi - 70) * 2.4 : 0;
      if (trending) s *= 0.5;
      const v = toSignal(s);
      const reason = `RSI ~${round(rsi)} - ` + (v === "BUY" ? "oversold, mean-reversion bounce favored." : v === "SELL" ? "overbought, fade the move." : "mid-range, no reversion edge.") + (trending ? " (trending -> weighted down)" : "");
      return { score: clamp(s), reason };
    });
  },
};

const momentumCross: Skill = {
  id: "momentum-cross",
  name: "Momentum Cross (7d vs 30d)",
  summary: "A moving-average-cross proxy: short-term momentum crossing above long-term is bullish, below is bearish.",
  entry: "7d pace above 30d pace -> buy; below -> sell.",
  exit: "The cross reverses.",
  inputs: ["%change 7d", "%change 30d"],
  evaluate({ coins }) {
    return forTargets(coins, (c) => {
      const sp = c.pctChange7d / 7, lp = (c.pctChange30d ?? 0) / 30;
      const s = clamp((sp - lp) * 60);
      const v = toSignal(s);
      const reason = `7d pace ${sp.toFixed(2)}%/d vs 30d ${lp.toFixed(2)}%/d - ` +
        (v === "BUY" ? "accelerating above trend (bullish cross)." : v === "SELL" ? "decelerating below trend (bearish cross)." : "paces converged, no cross.");
      return { score: s, reason };
    });
  },
};

const volumeTurnover: Skill = {
  id: "volume-turnover",
  name: "Volume / Turnover",
  summary: "Reads volume-to-market-cap turnover: heavy turnover into a rising price is accumulation; into a falling price, distribution.",
  entry: "Turnover elevated + 24h up -> buy; elevated + down -> sell.",
  exit: "Turnover normalizes.",
  inputs: ["24h volume", "market cap", "%change 24h"],
  evaluate({ coins }) {
    return forTargets(coins, (c) => {
      const turn = c.marketCap > 0 ? (c.volume24h / c.marketCap) * 100 : 0;
      const heavy = turn > 6;
      const s = heavy ? clamp(Math.sign(c.pctChange24h) * Math.min(60, turn * 4)) : clamp(c.pctChange24h * 3);
      const v = toSignal(s);
      const reason = `turnover ${turn.toFixed(1)}% of cap, 24h ${pct(c.pctChange24h)} - ` +
        (v === "BUY" ? (heavy ? "heavy volume into strength = accumulation." : "mild buying pressure.") : v === "SELL" ? (heavy ? "heavy volume into weakness = distribution." : "mild selling pressure.") : "ordinary turnover.");
      return { score: s, reason };
    });
  },
};

const dipBuyer: Skill = {
  id: "dip-buyer",
  name: "Dip Buyer (drawdown recovery)",
  summary: "Looks for assets well off their 90-day highs that are starting to stabilize - buying weakness with signs of a turn.",
  entry: "90d deeply negative but 7d turning up -> buy.",
  exit: "Price reclaims trend, or weakness accelerates.",
  inputs: ["%change 90d/7d/24h"],
  evaluate({ coins }) {
    return forTargets(coins, (c) => {
      const deep = (c.pctChange90d ?? 0) < -15;
      const turning = c.pctChange7d > 0 || c.pctChange24h > 1.5;
      let s = 0;
      if (deep && turning) s = 45;
      else if ((c.pctChange90d ?? 0) < -8 && turning) s = 25;
      else if (c.pctChange7d < -10) s = -20;
      const v = toSignal(s);
      const reason = `90d ${pct(c.pctChange90d)}, 7d ${pct(c.pctChange7d)} - ` +
        (v === "BUY" ? "beaten down and stabilizing, dip-buy setup." : v === "SELL" ? "still falling, no bottom yet." : "no clean dip setup.");
      return { score: s, reason };
    });
  },
};

const volatilityBreakout: Skill = {
  id: "volatility-breakout",
  name: "Volatility Breakout",
  summary: "Flags an outsized 24h move relative to the recent weekly pace as a likely continuation breakout.",
  entry: "24h move large and same direction as 7d trend -> trade the breakout.",
  exit: "Move fades back into range.",
  inputs: ["%change 24h", "%change 7d"],
  evaluate({ coins }) {
    return forTargets(coins, (c) => {
      const wk = Math.abs((c.pctChange7d ?? 0) / 7) + 0.5;
      const ratio = c.pctChange24h / wk;
      const aligned = Math.sign(c.pctChange24h) === Math.sign(c.pctChange7d || c.pctChange24h);
      const s = clamp(ratio * (aligned ? 14 : 6));
      const v = toSignal(s);
      const reason = `24h ${pct(c.pctChange24h)} vs typical ${wk.toFixed(2)}%/d - ` +
        (v === "BUY" ? "upside breakout with trend." : v === "SELL" ? "downside breakdown with trend." : "within normal range.");
      return { score: s, reason };
    });
  },
};

const regimeDetection: Skill = {
  id: "regime-detection",
  name: "Regime Detection (derivatives-aware)",
  summary: "Classifies the market into five regimes and sets posture; derivatives positioning escalates/cools the regime when a feed is connected.",
  entry: "Risk-on -> buy (ETH higher beta); Risk-Off / Capitulation -> sell or stand aside.",
  exit: "Regime transition.",
  inputs: ["Fear & Greed", "Altcoin Season", "Dominance + trend", "BTC trend", "funding/OI (optional)"],
  evaluate({ market, coins }) {
    const r = classifyRegime(market);
    const riskOn = r.regime === "ALT_SEASON_RISK_ON" || r.regime === "BTC_LED_RISK_ON";
    const riskOff = r.regime === "RISK_OFF" || r.regime === "CAPITULATION";
    const base = (riskOn ? 1 : riskOff ? -1 : 0) * r.confidence * 70;
    return TARGETS.map((sym) => {
      const c = get(coins, sym);
      const s = clamp(base * (sym === "ETH" ? 1.15 : 1));
      const v = toSignal(s);
      return { symbol: sym, slug: c?.slug, signal: v, score: round(s),
        reason: `Regime: ${r.label} (${(r.confidence * 100).toFixed(0)}%). ` +
          (v === "BUY" ? `risk-on -> favor ${sym} longs${sym === "ETH" ? " (higher beta)" : ""}.` : v === "SELL" ? `defensive regime -> reduce ${sym} risk.` : "no directional regime edge.") };
    });
  },
};

const fearGreedContrarian: Skill = {
  id: "fear-greed-contrarian",
  name: "Fear & Greed Contrarian",
  summary: "Buys extreme fear and sells extreme greed - the classic contrarian sentiment play.",
  entry: "F&G <= 25 -> buy; >= 78 -> sell.",
  exit: "Sentiment returns to neutral (40-60).",
  inputs: ["Fear & Greed index"],
  evaluate({ market, coins }) {
    const fg = market.fearGreed;
    const s = fg <= 25 ? (35 - fg) * 2.5 : fg >= 78 ? -(fg - 68) * 2.5 : (50 - fg) * 0.5;
    const v = toSignal(s);
    const reason = `Fear & Greed ${fg} - ` + (v === "BUY" ? "extreme fear, contrarian buy zone." : v === "SELL" ? "extreme greed, contrarian sell zone." : "neutral sentiment.");
    return TARGETS.map((sym) => ({ symbol: sym, slug: get(coins, sym)?.slug, signal: v, score: round(s), reason }));
  },
};

const sentimentDivergence: Skill = {
  id: "sentiment-divergence",
  name: "Sentiment Divergence",
  summary: "Flags when crowd sentiment disagrees with market internals - euphoria on weak breadth (distribution) or fear on strong breadth (accumulation).",
  entry: "Bullish: F&G <= 40 with broad breadth (>60% up). Bearish: F&G >= 65 with narrow breadth (<45% up).",
  exit: "Sentiment and breadth re-converge.",
  inputs: ["Fear & Greed", "top-100 breadth"],
  evaluate({ market, globals, coins }) {
    const fg = market.fearGreed;
    const b = globals?.breadth;
    const adv = b && b.universe ? (b.advancers24h / b.universe) * 100 : 50;
    let s = 0; let note = "sentiment and internals agree - no divergence.";
    if (fg >= 65 && adv < 45) { s = -clamp((fg - 50) + (50 - adv)); note = "euphoria on weak breadth -> distribution risk."; }
    else if (fg <= 40 && adv > 60) { s = clamp((50 - fg) + (adv - 50)); note = "fear on strong breadth -> quiet accumulation."; }
    const v = toSignal(s);
    const reason = `F&G ${fg} vs breadth ${round(adv)}% up - ${note}`;
    return TARGETS.map((sym) => ({ symbol: sym, slug: get(coins, sym)?.slug, signal: v, score: round(s), reason }));
  },
};

const breadthRotation: Skill = {
  id: "breadth-rotation",
  name: "Breadth Rotation",
  summary: "Broad participation backs risk-on; a narrowing tape flags fragility.",
  entry: "Risk-on when >62% of the top 100 are up; risk-off below 38%.",
  exit: "Breadth crosses back through 45-55%.",
  inputs: ["top-100 breadth 24h"],
  evaluate({ globals, coins }) {
    const b = globals?.breadth;
    if (!b || !b.universe) return TARGETS.map((sym) => ({ symbol: sym, slug: get(coins, sym)?.slug, signal: "NEUTRAL" as Signal, score: 0, reason: "breadth data unavailable on this key." }));
    const adv = (b.advancers24h / b.universe) * 100;
    const s = clamp((adv - 50) * 3);
    const v = toSignal(s);
    const reason = `${round(adv)}% of top 100 advancing - ` + (v === "BUY" ? "broad strength, risk-on." : v === "SELL" ? "broad weakness, risk-off." : "mixed participation.");
    return TARGETS.map((sym) => ({ symbol: sym, slug: get(coins, sym)?.slug, signal: v, score: round(s), reason }));
  },
};

const dominanceRotation: Skill = {
  id: "dominance-rotation",
  name: "Dominance Rotation (BTC <-> ETH)",
  summary: "Uses BTC Dominance trend to decide where risk should sit: rising dominance favors BTC over ETH; falling dominance favors ETH.",
  entry: "Dominance rising -> BTC buy / ETH soft; falling -> ETH buy.",
  exit: "Dominance trend flattens.",
  inputs: ["BTC Dominance + trend"],
  evaluate({ market, coins }) {
    const t = market.btcDominanceTrend;
    const mag = clamp(Math.abs(t) * 25);
    const rising = t > 0.3, falling = t < -0.3;
    return TARGETS.map((sym) => {
      let s = 0;
      if (rising) s = sym === "BTC" ? mag : -mag;
      else if (falling) s = sym === "ETH" ? mag : -mag * 0.5;
      const v = toSignal(s);
      const reason = `dominance ${market.btcDominance.toFixed(1)}%, trend ${t >= 0 ? "+" : ""}${t.toFixed(2)}pt - ` +
        (rising ? (sym === "BTC" ? "rising dominance favors BTC." : "rising dominance pressures ETH.") :
         falling ? (sym === "ETH" ? "falling dominance favors ETH." : "falling dominance, BTC lags.") :
         "dominance flat, no rotation edge.");
      return { symbol: sym, slug: get(coins, sym)?.slug, signal: v, score: round(s), reason };
    });
  },
};

const ethBtcStrength: Skill = {
  id: "eth-btc-strength",
  name: "ETH / BTC Relative Strength",
  summary: "Measures ETH versus BTC directly - which of the two is the stronger horse right now.",
  entry: "Buy the outperformer over 7d & 30d; the laggard is relatively weak.",
  exit: "Leadership flips.",
  inputs: ["BTC %change 7d/30d", "ETH %change 7d/30d"],
  evaluate({ coins }) {
    const btc = get(coins, "BTC"), eth = get(coins, "ETH");
    if (!btc || !eth) return [];
    const sp7 = eth.pctChange7d - btc.pctChange7d;
    const sp30 = (eth.pctChange30d ?? 0) - (btc.pctChange30d ?? 0);
    const ethScore = clamp(sp7 * 6 + sp30 * 2);
    const mk = (sym: string, slug: string | undefined, score: number): Verdict => {
      const v = toSignal(score);
      const reason = `ETH-BTC spread 7d ${pct(sp7)}, 30d ${pct(sp30)} - ` +
        (v === "BUY" ? `${sym} is the stronger of the two.` : v === "SELL" ? `${sym} is the laggard.` : `${sym} roughly in line.`);
      return { symbol: sym, slug, signal: v, score: round(score), reason };
    };
    return [mk("BTC", btc.slug, -ethScore), mk("ETH", eth.slug, ethScore)];
  },
};

const dryPowder: Skill = {
  id: "dry-powder",
  name: "Dry Powder (stablecoin supply)",
  summary: "High stablecoin share is sidelined capital - fuel. Lots of dry powder during fear is a bullish setup.",
  entry: "Stablecoin share >9% with neutral/fearful sentiment -> buy bias.",
  exit: "Dry powder deployed into greed.",
  inputs: ["stablecoin market cap", "total market cap", "Fear & Greed"],
  evaluate({ market, globals, coins }) {
    const share = globals?.stablecoinMarketCap ? (globals.stablecoinMarketCap / globals.totalMarketCap) * 100 : null;
    if (share == null) return TARGETS.map((sym) => ({ symbol: sym, slug: get(coins, sym)?.slug, signal: "NEUTRAL" as Signal, score: 0, reason: "stablecoin supply not available on this key." }));
    const fg = market.fearGreed;
    let s = 0;
    if (share > 9 && fg < 55) s = clamp((share - 8) * 8 + (50 - fg) * 0.4);
    else if (share < 6 && fg > 65) s = -clamp((8 - share) * 6 + (fg - 50) * 0.4);
    const v = toSignal(s);
    const reason = `stablecoin share ${share.toFixed(1)}%, F&G ${fg} - ` + (v === "BUY" ? "sidelined cash + caution = fuel for upside." : v === "SELL" ? "low dry powder into greed = limited fuel." : "neutral positioning.");
    return TARGETS.map((sym) => ({ symbol: sym, slug: get(coins, sym)?.slug, signal: v, score: round(s), reason }));
  },
};

const altseasonGate: Skill = {
  id: "altseason-gate",
  name: "Altcoin Season Gate",
  summary: "Uses the Altcoin Season Index to decide whether ETH should be favored over BTC.",
  entry: "Altseason > 65 -> favor ETH; < 35 (BTC season) -> favor BTC.",
  exit: "Index crosses back through the neutral band.",
  inputs: ["Altcoin Season Index"],
  evaluate({ market, coins }) {
    const a = market.altseasonIndex;
    const ethBias = clamp((a - 50) * 2);
    return TARGETS.map((sym) => {
      const s = sym === "ETH" ? ethBias : -ethBias * 0.6;
      const v = toSignal(s);
      const reason = `Altcoin Season ${a} - ` + (a > 65 ? (sym === "ETH" ? "alt season, favor ETH." : "alt season, BTC lags.") : a < 35 ? (sym === "BTC" ? "BTC season, favor BTC." : "BTC season, ETH lags.") : "mixed, no clear favorite.");
      return { symbol: sym, slug: get(coins, sym)?.slug, signal: v, score: round(s), reason };
    });
  },
};

const momentumAcceleration: Skill = {
  id: "momentum-acceleration",
  name: "Momentum Acceleration",
  summary: "A second-order read: is the trend speeding up or fading? Compares the 24h pace to the 7d and 30d pace to catch acceleration before price has fully run.",
  entry: "Short-term pace above mid-term above long-term (accelerating up) -> buy; the reverse (fading) -> sell.",
  exit: "Acceleration flattens or flips.",
  inputs: ["%change 24h", "%change 7d", "%change 30d"],
  evaluate({ coins }) {
    return forTargets(coins, (c) => {
      const p1 = c.pctChange24h;
      const p7 = c.pctChange7d / 7;
      const p30 = (c.pctChange30d ?? 0) / 30;
      // accel up if each shorter window is faster than the longer one
      const accelUp = p1 > p7 && p7 > p30 && p1 > 0;
      const accelDown = p1 < p7 && p7 < p30 && p1 < 0;
      const s = clamp((p1 - p30) * 12 * (accelUp || accelDown ? 1.4 : 0.8));
      const v = toSignal(s);
      const reason = `pace 24h ${p1.toFixed(2)}%/d vs 7d ${p7.toFixed(2)}%/d vs 30d ${p30.toFixed(2)}%/d - ` +
        (accelUp ? "momentum accelerating up." : accelDown ? "momentum accelerating down." : v === "BUY" ? "mildly speeding up." : v === "SELL" ? "mildly fading." : "steady, no acceleration.");
      return { score: s, reason };
    });
  },
};

const trendQuality: Skill = {
  id: "trend-quality",
  name: "Trend Quality",
  summary: "Rewards clean, consistent trends over choppy ones. A trend where every timeframe agrees and the pace is orderly is higher-conviction than a noisy one.",
  entry: "All timeframes same sign and pace orderly -> high-conviction buy/sell; mixed signs -> neutral.",
  exit: "Consistency breaks.",
  inputs: ["%change 24h/7d/30d/90d"],
  evaluate({ coins }) {
    return forTargets(coins, (c) => {
      const tf = [c.pctChange24h, c.pctChange7d, c.pctChange30d ?? 0, c.pctChange90d ?? 0];
      const up = tf.filter((x) => x > 0).length;
      const down = tf.filter((x) => x < 0).length;
      const dir = up === 4 ? 1 : down === 4 ? -1 : 0;
      // smoothness: how monotonic the per-day pace is
      const paces = [tf[0], tf[1] / 7, tf[2] / 30, tf[3] / 90];
      const range = Math.max(...paces) - Math.min(...paces);
      const quality = dir === 0 ? 0 : Math.max(0, 1 - range / 6); // 0..1
      const s = clamp(dir * (40 + quality * 45));
      const v = toSignal(s);
      const reason = `${up}/4 up, pace spread ${range.toFixed(2)}%/d - ` +
        (dir === 1 ? `clean uptrend (quality ${(quality * 100).toFixed(0)}%).` : dir === -1 ? `clean downtrend (quality ${(quality * 100).toFixed(0)}%).` : "timeframes disagree, low-quality/choppy.");
      return { score: s, reason };
    });
  },
};

const reversalRadar: Skill = {
  id: "reversal-radar",
  name: "Capitulation / Euphoria Reversal",
  summary: "Hunts for turning points at sentiment extremes: extreme fear into a beaten-down, stabilizing coin is a reversal buy; extreme greed into a parabolic, overbought coin is a blow-off sell.",
  entry: "Fear <= 25 + deep drawdown + 24h stabilizing -> buy. Greed >= 78 + parabolic 7d/30d + hot RSI -> sell.",
  exit: "Sentiment normalizes or the reversal confirms.",
  inputs: ["Fear & Greed", "%change 7d/30d/90d", "RSI"],
  evaluate({ market, coins }) {
    const fg = market.fearGreed;
    return forTargets(coins, (c) => {
      const rsi = rsiOf(c);
      const deepDown = (c.pctChange90d ?? 0) < -20 || c.pctChange7d < -12;
      const stabilizing = c.pctChange24h > -1;
      const parabolic = c.pctChange7d > 15 || (c.pctChange30d ?? 0) > 40;
      let s = 0; let note = "no reversal setup.";
      if (fg <= 25 && deepDown && stabilizing) { s = 55; note = "extreme fear + beaten down + stabilizing = capitulation reversal buy."; }
      else if (fg >= 78 && parabolic && rsi > 72) { s = -55; note = "extreme greed + parabolic + overbought = blow-off sell."; }
      else if (fg <= 30 && deepDown) { s = 22; note = "fear + weakness, early reversal watch."; }
      else if (fg >= 72 && parabolic) { s = -22; note = "greed + extension, exhaustion watch."; }
      const v = toSignal(s);
      return { score: s, reason: `F&G ${fg}, 7d ${pct(c.pctChange7d)}, RSI ~${round(rsi)} - ${note}` };
    });
  },
};

const flightToMajors: Skill = {
  id: "flight-to-majors",
  name: "Flight to Majors",
  summary: "When capital concentrates in BTC and ETH (their combined share of the market rising), the majors get a defensive bid even as smaller alts bleed. Reads the majors' share of total market cap and its direction.",
  entry: "BTC+ETH dominance high and rising -> buy majors (BTC the prime safe haven); low and falling (money into alts) -> majors lag.",
  exit: "Concentration reverses.",
  inputs: ["BTC dominance + trend", "ETH dominance", "others dominance"],
  evaluate({ market, globals, coins }) {
    const ethDom = globals?.ethDominance ?? 0;
    const majors = market.btcDominance + ethDom;
    const t = market.btcDominanceTrend;
    const concentrating = t > 0.2 || majors > 62;
    const dispersing = t < -0.2 && majors < 58;
    return TARGETS.map((sym) => {
      let s = 0;
      if (concentrating) s = clamp(20 + Math.abs(t) * 15) * (sym === "BTC" ? 1 : 0.8);
      else if (dispersing) s = -clamp(15 + Math.abs(t) * 12) * (sym === "ETH" ? 1 : 0.7);
      const v = toSignal(s);
      const reason = `majors share ${majors.toFixed(1)}% (BTC.D trend ${t >= 0 ? "+" : ""}${t.toFixed(2)}pt) - ` +
        (concentrating ? `capital concentrating in majors, defensive bid for ${sym}.` : dispersing ? `capital dispersing into alts, ${sym} on the back foot.` : "no clear concentration signal.");
      return { symbol: sym, slug: get(coins, sym)?.slug, signal: v, score: round(s), reason };
    });
  },
};

const volumeConfirmedTrend: Skill = {
  id: "volume-confirmed-trend",
  name: "Volume-Confirmed Trend",
  summary: "A trend only counts if volume backs it. A rising price on healthy turnover is a real move; the same move on thin volume is suspect and gets downgraded to neutral.",
  entry: "7d trend up AND turnover healthy -> confirmed buy; trend down on heavy turnover -> confirmed sell; trend on thin volume -> neutral.",
  exit: "Volume no longer confirms the move.",
  inputs: ["%change 7d", "24h volume", "market cap"],
  evaluate({ coins }) {
    return forTargets(coins, (c) => {
      const turn = c.marketCap > 0 ? (c.volume24h / c.marketCap) * 100 : 0;
      const confirmed = turn >= 3;
      const dir = Math.sign(c.pctChange7d);
      const s = confirmed ? clamp(dir * Math.min(60, 18 + turn * 4)) : clamp(dir * 8);
      const v = toSignal(s);
      const reason = `7d ${pct(c.pctChange7d)} on turnover ${turn.toFixed(1)}% of cap - ` +
        (!confirmed ? "thin volume, move unconfirmed -> stay neutral." : dir > 0 ? "uptrend confirmed by volume." : dir < 0 ? "downtrend confirmed by volume." : "flat.");
      return { score: s, reason };
    });
  },
};

const liquidityHealth: Skill = {
  id: "liquidity-health",
  name: "Liquidity Health",
  summary: "Checks whether turnover (24h volume vs market cap) is healthy enough to trust the move. Thin liquidity means any signal is lower-conviction; healthy turnover into strength is tradable.",
  entry: "Healthy turnover (>=3% of cap) with a positive 7d trend -> buy; very thin turnover -> stay neutral regardless of direction.",
  exit: "Liquidity dries up.",
  inputs: ["24h volume", "market cap", "%change 7d"],
  evaluate({ coins }) {
    return forTargets(coins, (c) => {
      const turn = c.marketCap > 0 ? (c.volume24h / c.marketCap) * 100 : 0;
      let s = 0;
      if (turn < 1.5) s = 0;
      else if (turn >= 3) s = clamp(Math.sign(c.pctChange7d) * Math.min(45, 18 + turn));
      else s = clamp(Math.sign(c.pctChange7d) * 12);
      const v = toSignal(s);
      const reason = `turnover ${turn.toFixed(1)}% of cap, 7d ${pct(c.pctChange7d)} - ` +
        (turn < 1.5 ? "thin liquidity, low conviction -> neutral." : v === "BUY" ? "healthy liquidity backing the uptrend." : v === "SELL" ? "liquid market leaning down." : "adequate liquidity, no edge.");
      return { score: s, reason };
    });
  },
};

const drawdownGuard: Skill = {
  id: "drawdown-guard",
  name: "Drawdown Guard",
  summary: "A capital-preservation filter: deep, sustained drawdowns across 30d and 90d that are still bleeding flag risk-off — the opposite of a dip-buy, this says step aside.",
  entry: "30d and 90d deeply negative and 7d still down -> sell / preserve capital.",
  exit: "Drawdown stops deepening and price stabilizes.",
  inputs: ["%change 30d", "%change 90d", "%change 7d"],
  evaluate({ coins }) {
    return forTargets(coins, (c) => {
      const d30 = c.pctChange30d ?? 0, d90 = c.pctChange90d ?? 0;
      let s = 0;
      if (d30 < -15 && d90 < -25 && c.pctChange7d < 0) s = -55;
      else if (d30 < -10 && c.pctChange7d < -3) s = -28;
      else if (d30 > 0 && d90 > 0) s = 12;
      const v = toSignal(s);
      const reason = `30d ${pct(d30)}, 90d ${pct(d90)} - ` +
        (v === "SELL" ? "deep, ongoing drawdown -> preserve capital." : v === "BUY" ? "no drawdown stress, healthy." : "moderate, no preservation trigger.");
      return { score: s, reason };
    });
  },
};

const capitulationVolume: Skill = {
  id: "capitulation-volume",
  name: "Capitulation Volume",
  summary: "Looks for a sharp move on heavy turnover at a sentiment extreme: a violent flush in extreme fear is a contrarian accumulation setup; a vertical pump in extreme greed on huge volume is a blow-off to sell.",
  entry: "Sharp 24h drop + heavy turnover + extreme fear -> buy. Sharp 24h pump + heavy turnover + extreme greed -> sell.",
  exit: "Volume normalizes / sentiment resets.",
  inputs: ["%change 24h", "24h volume / cap", "Fear & Greed"],
  evaluate({ market, coins }) {
    const fg = market.fearGreed;
    return forTargets(coins, (c) => {
      const turn = c.marketCap > 0 ? (c.volume24h / c.marketCap) * 100 : 0;
      const heavy = turn > 6;
      let s = 0;
      if (heavy && c.pctChange24h < -4 && fg <= 30) s = 48;
      else if (heavy && c.pctChange24h > 4 && fg >= 70) s = -48;
      const v = toSignal(s);
      const reason = `24h ${pct(c.pctChange24h)} on ${turn.toFixed(1)}% turnover, F&G ${fg} - ` +
        (v === "BUY" ? "capitulation flush, contrarian accumulation." : v === "SELL" ? "volume blow-off in greed, distribution." : "no capitulation/blow-off signature.");
      return { score: s, reason };
    });
  },
};

const momentumDivergence: Skill = {
  id: "momentum-divergence",
  name: "Momentum Divergence",
  summary: "Catches early turns: when the very recent move (24h) disagrees with the weekly trend (7d), it can be the first sign of a reversal before the longer trend flips.",
  entry: "24h up while 7d still down -> early bullish turn. 24h down while 7d still up -> early bearish turn.",
  exit: "The two timeframes re-align.",
  inputs: ["%change 24h", "%change 7d"],
  evaluate({ coins }) {
    return forTargets(coins, (c) => {
      let s = 0;
      if (c.pctChange24h > 1 && c.pctChange7d < -2) s = clamp(15 + c.pctChange24h * 3);
      else if (c.pctChange24h < -1 && c.pctChange7d > 2) s = clamp(-15 + c.pctChange24h * 3);
      const v = toSignal(s);
      const reason = `24h ${pct(c.pctChange24h)} vs 7d ${pct(c.pctChange7d)} - ` +
        (v === "BUY" ? "recent strength against a weak week -> early bullish turn." : v === "SELL" ? "recent weakness against a strong week -> early bearish turn." : "timeframes agree, no divergence.");
      return { score: s, reason };
    });
  },
};

export const SKILLS: Skill[] = [
  momentum, trendAlignment, meanReversion, momentumCross, volumeTurnover,
  dipBuyer, volatilityBreakout, regimeDetection, fearGreedContrarian,
  sentimentDivergence, breadthRotation, dominanceRotation, ethBtcStrength,
  dryPowder, altseasonGate,
  momentumAcceleration, trendQuality, reversalRadar, flightToMajors, volumeConfirmedTrend,
  liquidityHealth, drawdownGuard, capitulationVolume, momentumDivergence,
];

export function runSkills(ctx: SkillContext) {
  return SKILLS.map((s) => {
    const { evaluate, ...meta } = s;
    try { return { ...meta, verdicts: evaluate(ctx) }; }
    catch { return { ...meta, verdicts: [] as Verdict[] }; }
  });
}
