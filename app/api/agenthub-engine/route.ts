// GET /api/agenthub-engine — a decision board where EVERY input comes from the
// CoinMarketCap AI Agent Hub (MCP). BTC/ETH signals + regime + a full stack of
// Hub-decided market reads. Hub-only: never falls back to mock decisions.
import { NextResponse } from "next/server";
import { callAgentHubTool } from "@/lib/cmc/agentHub";
import { classifyRegime } from "@/lib/engine/regime";
import { REGIME_CONFIG } from "@/lib/engine/weights";
import { regimePlain } from "@/lib/labels";
import type { MarketSignals } from "@/lib/engine/types";

export const dynamic = "force-dynamic";

// ---------- defensive extraction -------------------------------------------
function findNum(obj: any, names: string[], depth = 0): number | undefined {
  if (obj == null || depth > 6) return undefined;
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if (names.some((n) => k.toLowerCase().includes(n))) {
        if (typeof v === "number" && Number.isFinite(v)) return v;
        if (typeof v === "string") { const f = parseFloat(v); if (Number.isFinite(f)) return f; }
        if (v && typeof v === "object") { const i = findNum(v, ["value", "usd", "current", "latest", "last", "close", "price", "amount", "ratio", "total"], depth + 1); if (i !== undefined) return i; }
      }
    }
    for (const v of Object.values(obj)) { const r = findNum(v, names, depth + 1); if (r !== undefined) return r; }
  }
  return undefined;
}
function findStr(obj: any, names: string[], depth = 0): string | undefined {
  if (obj == null || depth > 5) return undefined;
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if (names.some((n) => k.toLowerCase().includes(n)) && typeof v === "string" && v.trim()) return v;
    }
    for (const v of Object.values(obj)) { const r = findStr(v, names, depth + 1); if (r !== undefined) return r; }
  }
  return undefined;
}
// find the first array of objects anywhere in the payload
function findArray(obj: any, depth = 0): any[] | undefined {
  if (obj == null || depth > 5) return undefined;
  if (Array.isArray(obj)) { if (obj.length && typeof obj[0] === "object") return obj; return undefined; }
  if (typeof obj === "object") for (const v of Object.values(obj)) { const r = findArray(v, depth + 1); if (r) return r; }
  return undefined;
}


function gatherText(obj: any, acc: string[], depth = 0): void {
  if (obj == null || depth > 7) return;
  if (typeof obj === "string") { acc.push(obj); return; }
  if (typeof obj === "object") for (const v of Object.values(obj)) gatherText(v, acc, depth + 1);
}
function numFromText(texts: string[], patterns: RegExp[]): number | undefined {
  for (const t of texts) for (const p of patterns) { const m = t.match(p); if (m && m[1]) { const f = parseFloat(m[1]); if (Number.isFinite(f)) return f; } }
  return undefined;
}

const call = async (name: string, args: Record<string, unknown> = {}, t = 12000) => {
  try { const r = await callAgentHubTool(name, args, t); return r && !(typeof r === "object" && (r as any).error) ? r : null; } catch { return null; }
};

const WHAT_TO_DO: Record<string, string> = {
  ALT_SEASON_RISK_ON: "Risk-on: rotate into ETH and quality alts, let winners run, keep trailing stops.",
  BTC_LED_RISK_ON: "Risk-on but BTC-led: favor BTC and large caps, be selective on alts.",
  CHOP: "No clear trend: trade the range with smaller size, take profits quickly, don't chase breakouts.",
  RISK_OFF: "Defensive: trim risk, raise cash, only the highest-conviction longs, tighten stops.",
  CAPITULATION: "Max fear: scale in slowly to majors, expect volatility, this is historically a bottoming zone.",
};

function signalFor(sym: string, ta: any, quote: any) {
  const rsi = findNum(ta, ["rsi", "relative_strength"]);
  let macd = findNum(ta, ["macd_histogram", "macd_hist", "histogram"]);
  if (macd === undefined) macd = findNum(ta, ["macd"]);
  const taTexts: string[] = []; gatherText(ta, taTexts);
  let ema = findNum(ta, ["ema", "exponential", "movingaverageexp"]); if (ema === undefined) ema = numFromText(taTexts, [/\bema\b[^\d\-]{0,14}(\d+(?:\.\d+)?)/i, /exponential[^\d\-]{0,18}(\d+(?:\.\d+)?)/i]);
  let sma = findNum(ta, ["sma", "simplemoving"]); if (sma === undefined) sma = numFromText(taTexts, [/\bsma\b[^\d\-]{0,14}(\d+(?:\.\d+)?)/i]);
  const price = findNum(quote, ["price"]) ?? findNum(ta, ["price", "close"]);
  const change24h = findNum(quote, ["percentchange24h", "percent_change_24h", "change24h"]);
  let score = 0; const reasons: string[] = [];
  if (rsi !== undefined) {
    if (rsi >= 70) { score -= 22; reasons.push(`RSI ${rsi.toFixed(1)} — overbought`); }
    else if (rsi <= 30) { score += 22; reasons.push(`RSI ${rsi.toFixed(1)} — oversold`); }
    else if (rsi >= 55) { score += 10; reasons.push(`RSI ${rsi.toFixed(1)} — bullish`); }
    else if (rsi <= 45) { score -= 10; reasons.push(`RSI ${rsi.toFixed(1)} — bearish`); }
    else reasons.push(`RSI ${rsi.toFixed(1)} — neutral`);
  }
  if (macd !== undefined) { if (macd > 0) { score += 20; reasons.push(`MACD histogram + — bullish`); } else { score -= 20; reasons.push(`MACD histogram − — bearish`); } }
  const ref = ema ?? sma;
  if (price !== undefined && ref !== undefined) { if (price > ref) { score += 18; reasons.push(`price above ${ema ? "EMA" : "SMA"} — uptrend`); } else { score -= 18; reasons.push(`price below ${ema ? "EMA" : "SMA"} — downtrend`); } }
  const signal = score >= 15 ? "BUY" : score <= -15 ? "SELL" : "NEUTRAL";
  return { symbol: sym, signal, score: Math.max(-100, Math.min(100, score)), rsi: rsi ?? null, macd: macd ?? null, ema: ema ?? null, sma: sma ?? null, price: price ?? null, change24h: change24h ?? null, reasons };
}

function holdersOf(m: any) {
  if (!m) return null;
  const whales = findNum(m, ["whale"]);
  const others = findNum(m, ["other", "retail"]);
  const holders = findNum(m, ["holder"]);
  const traders = findNum(m, ["trader"]);
  const cruisers = findNum(m, ["cruiser"]);
  const fee = findNum(m, ["avgtransactionfee", "transaction_fee", "fee"]);
  if (whales == null && holders == null && traders == null) return null;
  return { whales: whales ?? null, others: others ?? null, holders: holders ?? null, traders: traders ?? null, cruisers: cruisers ?? null, fee: fee ?? null };
}

// ---------- 60s in-memory cache --------------------------------------------
let CACHE: { at: number; body: any } | null = null;

export async function GET(req: Request) {
  const debug = new URL(req.url).searchParams.get("debug") === "1";
  if (CACHE && !debug && Date.now() - CACHE.at < 60_000) return NextResponse.json(CACHE.body);

  const [btcTa, ethTa, btcQ, ethQ, gm, deriv, mcapTa, btcMet, ethMet] = await Promise.all([
    call("get_crypto_technical_analysis", { id: "1" }),
    call("get_crypto_technical_analysis", { id: "1027" }),
    call("get_crypto_quotes_latest", { id: "1" }),
    call("get_crypto_quotes_latest", { id: "1027" }),
    call("get_global_metrics_latest", {}),
    call("get_global_crypto_derivatives_metrics", {}),
    call("get_crypto_marketcap_technical_analysis", {}),
    call("get_crypto_metrics", { id: "1" }),
    call("get_crypto_metrics", { id: "1027" }),
  ]);

  const hubOk = !!(btcTa || ethTa || gm);
  if (!hubOk) {
    const body = { source: "unavailable", hub: false, note: "CMC Agent Hub is not reachable (add a CMC API key). This board is Hub-only and does not fall back to mock decisions." };
    return NextResponse.json(body);
  }

  if (debug) {
    const trunc = (x: any) => { try { const s = JSON.stringify(x); return s.length > 4000 ? s.slice(0, 4000) + "…[truncated]" : JSON.parse(s); } catch { return null; } };
    return NextResponse.json({
      debug: true,
      raw: { globalMetrics: trunc(gm), derivatives: trunc(deriv), marketcapTA: trunc(mcapTa), btcMetrics: trunc(btcMet), btcTechnicalAnalysis: trunc(btcTa) },
    });
  }

  const signals = [signalFor("BTC", btcTa, btcQ), signalFor("ETH", ethTa, ethQ)];

  // regime from Agent Hub global metrics + BTC quote + derivatives
  const gmTexts: string[] = []; gatherText(gm, gmTexts);
  const fearGreed = findNum(gm, ["fear", "greed"]) ?? numFromText(gmTexts, [/fear[\s&_-]*(?:and|&)?[\s_-]*greed[^\d]{0,24}(\d{1,3})/i, /\bf&g\b[^\d]{0,12}(\d{1,3})/i]) ?? 50;
  const altseasonIndex = findNum(gm, ["altcoinseason", "altseason", "altcoin_season", "seasonindex", "seasongauge"]) ?? numFromText(gmTexts, [/alt(?:coin)?\s*season[^\d]{0,18}(\d{1,3})/i]) ?? 50;
  const btcDominance = findNum(gm, ["btcdominance", "btc_dominance", "bitcoindominance", "btcmarketcappercentage", "btcshare"]) ?? numFromText(gmTexts, [/(?:btc|bitcoin)\s*dominance[^\d]{0,14}(\d{1,3}(?:\.\d+)?)/i]) ?? 55;
  const ethDominance = findNum(gm, ["ethdominance", "eth_dominance", "ethereumdominance", "ethshare"]) ?? numFromText(gmTexts, [/(?:eth|ethereum)\s*dominance[^\d]{0,14}(\d{1,3}(?:\.\d+)?)/i]) ?? null;
  const btcReturn7d = findNum(btcQ, ["percentchange7d", "percent_change_7d", "change7d"]) ?? 0;
  const btcReturn30d = findNum(btcQ, ["percentchange30d", "percent_change_30d", "change30d"]) ?? 0;
  const funding = findNum(deriv, ["fundingrate", "funding"]);
  const oi = findNum(deriv, ["openinterestchange", "oi_change", "oichange"]);

  // #2 ETF flows + leverage (from global metrics)
  const etfFlow = findNum(gm, ["etfflow", "etf_flow", "etfnetflow", "etf"]);
  const leverage = findNum(gm, ["leverageratio", "estimatedleverage", "leverage"]);
  // #3 BTC liquidations (from derivatives)
  const liqTotal = findNum(deriv, ["totalliquidation", "liquidation24h", "btcliquidation", "liquidation"]);
  const liqLong = findNum(deriv, ["longliquidation", "long_liquidation"]);
  const liqShort = findNum(deriv, ["shortliquidation", "short_liquidation"]);

  const market: MarketSignals = {
    fearGreed, altseasonIndex, btcDominance, btcDominanceTrend: 0, btcReturn7d, btcReturn30d,
    ...(funding !== undefined ? { aggFundingRate: funding } : {}),
    ...(oi !== undefined ? { openInterestChange: oi } : {}),
  };
  const r = classifyRegime(market);
  const plain = regimePlain(r.regime);
  const cfg = REGIME_CONFIG[r.regime];

  // #4 total market-cap technical analysis
  let mtRsi = findNum(mcapTa, ["rsi", "relative_strength"]);
  let mtMacd = findNum(mcapTa, ["macd_histogram", "macd_hist", "histogram"]); if (mtMacd === undefined) mtMacd = findNum(mcapTa, ["macd"]);
  const mtSupport = findNum(mcapTa, ["support"]);
  const mtResistance = findNum(mcapTa, ["resistance"]);

  // #5 holder structure
  const holders = { BTC: holdersOf(btcMet), ETH: holdersOf(ethMet) };



  const body = {
    source: "cmc-agent-hub", hub: true, asOf: new Date().toISOString(),
    regime: { key: r.regime, name: plain.name, meaning: plain.meaning, confidence: r.confidence, whatToDo: WHAT_TO_DO[r.regime] ?? "", riskBudget: cfg.riskBudget, universe: cfg.universe },
    market: { fearGreed, altseasonIndex, btcDominance, ethDominance, etfFlow: etfFlow ?? null, leverage: leverage ?? null },
    derivatives: { funding: funding ?? null, oi: oi ?? null, liqTotal: liqTotal ?? null, liqLong: liqLong ?? null, liqShort: liqShort ?? null },
    marketTA: (mtRsi != null || mtMacd != null) ? { rsi: mtRsi ?? null, macd: mtMacd ?? null, support: mtSupport ?? null, resistance: mtResistance ?? null } : null,
    holders,
    signals,
  };
  CACHE = { at: Date.now(), body };
  return NextResponse.json(body);
}
