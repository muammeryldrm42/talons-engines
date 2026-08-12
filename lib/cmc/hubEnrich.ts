// Enrich the engine's inputs with REAL signals from the CoinMarketCap AI Agent Hub
// (MCP), replacing the %-change proxies the free REST tier forces us to use:
//   • real RSI + MACD histogram for BTC & ETH  (get_crypto_technical_analysis)
//   • aggregate perp funding rate + OI         (get_global_crypto_derivatives_metrics)
// Best-effort and defensive: parallel, generous timeouts, tolerant of unknown
// payload shapes (structured fields AND prose/text are both parsed). If the Hub is
// unreachable (no key / quota), nothing changes and the engine uses its proxies.
import { callAgentHubTool } from "./agentHub";
import type { CoinInput, MarketSignals } from "../engine/types";

// ---- generic helpers -------------------------------------------------------

// recursively find the first finite number under a key matching one of `names`
function findNum(obj: any, names: string[], depth = 0): number | undefined {
  if (obj == null || depth > 6) return undefined;
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      const kl = k.toLowerCase();
      if (names.some((n) => kl.includes(n))) {
        if (typeof v === "number" && Number.isFinite(v)) return v;
        if (typeof v === "string") { const f = parseFloat(v); if (Number.isFinite(f)) return f; }
        if (v && typeof v === "object") {
          const inner = findNum(v, ["value", "usd", "amount", "rate", "current", "val", "latest", "last", "close"], depth + 1);
          if (inner !== undefined) return inner;
        }
      }
    }
    for (const v of Object.values(obj)) { const r = findNum(v, names, depth + 1); if (r !== undefined) return r; }
  }
  return undefined;
}

// collect every string anywhere in the payload (tool results are often prose/text)
function gatherText(obj: any, acc: string[], depth = 0): void {
  if (obj == null || depth > 7) return;
  if (typeof obj === "string") { acc.push(obj); return; }
  if (typeof obj === "object") for (const v of Object.values(obj)) gatherText(v, acc, depth + 1);
}

function numFromText(texts: string[], patterns: RegExp[]): number | undefined {
  for (const t of texts) {
    for (const p of patterns) {
      const m = t.match(p);
      if (m && m[1]) { const f = parseFloat(m[1]); if (Number.isFinite(f)) return f; }
    }
  }
  return undefined;
}

// ---- field name + text patterns -------------------------------------------

const RSI_KEYS = ["rsi", "relative_strength", "relativestrength", "relative strength"];
const MACD_KEYS = ["macd_hist", "macd_histogram", "macdhistogram", "histogram", "macd", "convergence_divergence"];
const FUND_KEYS = ["fundingrate", "funding_rate", "funding", "avgfunding", "weightedfunding"];
const OI_KEYS = ["openinterestchange", "oi_change", "oichange", "openinterest_change", "oi_24h", "oi24h", "interest_change"];

const RSI_RX = [
  /\brsi\b[^\d\-+]{0,16}(-?\d{1,3}(?:\.\d+)?)/i,
  /relative\s*strength(?:\s*index)?[^\d\-+]{0,16}(-?\d{1,3}(?:\.\d+)?)/i,
];
const MACD_RX = [
  /macd(?:\s*histogram|\s*hist)?[^\d\-+]{0,20}(-?\d+(?:\.\d+)?)/i,
  /\bhistogram\b[^\d\-+]{0,16}(-?\d+(?:\.\d+)?)/i,
];
const FUND_RX = [/funding(?:\s*rate)?[^\d\-+]{0,16}(-?\d+(?:\.\d+)?%?)/i];

// ---- tool calls ------------------------------------------------------------

const TA_TIMEOUT = 13000;

// get_crypto_technical_analysis requires exactly { id: "<cmc id>" } as a STRING
// (additionalProperties:false — any other arg is rejected). BTC=1, ETH=1027.
async function ta(id: number): Promise<any> {
  try {
    const r = await callAgentHubTool("get_crypto_technical_analysis", { id: String(id) }, TA_TIMEOUT);
    if (r && !(typeof r === "object" && (r as any).error)) return r;
  } catch { /* unavailable */ }
  return null;
}

export interface HubEnrichment {
  enriched: boolean;
  rsi: Record<string, number>;
  macd: Record<string, number>;
  fundingRate?: number;
  oiChange?: number;
  etfFlow?: number;
  leverage?: number;
  marketRsi?: number;
}

export async function enrichFromHub(coins: CoinInput[], market: MarketSignals): Promise<HubEnrichment> {
  const out: HubEnrichment = { enriched: false, rsi: {}, macd: {} };
  try {
    const [btcTa, ethTa, deriv, gm, mcapTa] = await Promise.all([
      ta(1),
      ta(1027),
      (async () => { try { return await callAgentHubTool("get_global_crypto_derivatives_metrics", {}, 12000); } catch { return null; } })(),
      (async () => { try { return await callAgentHubTool("get_global_metrics_latest", {}, 12000); } catch { return null; } })(),
      (async () => { try { return await callAgentHubTool("get_crypto_marketcap_technical_analysis", {}, 12000); } catch { return null; } })(),
    ]);

    const apply = (sym: string, payload: any) => {
      if (!payload) return;
      const texts: string[] = []; gatherText(payload, texts);
      let r = findNum(payload, RSI_KEYS); if (r === undefined) r = numFromText(texts, RSI_RX);
      let m = findNum(payload, ["macd_histogram", "macd_hist", "histogram"]);
      if (m === undefined) m = findNum(payload, ["macd"]);
      if (m === undefined) m = numFromText(texts, MACD_RX);
      const c = coins.find((x) => x.symbol === sym);
      if (!c) return;
      if (r !== undefined && r >= 0 && r <= 100) { c.rsi = r; out.rsi[sym] = Math.round(r * 10) / 10; }
      if (m !== undefined) { c.macdHistogram = m; out.macd[sym] = m; }
    };
    apply("BTC", btcTa);
    apply("ETH", ethTa);

    if (deriv) {
      const texts: string[] = []; gatherText(deriv, texts);
      let f = findNum(deriv, FUND_KEYS); if (f === undefined) { const ft = numFromText(texts, FUND_RX); if (ft !== undefined) f = ft; }
      const oi = findNum(deriv, OI_KEYS);
      if (f !== undefined) { market.aggFundingRate = f; out.fundingRate = f; }
      if (oi !== undefined) { market.openInterestChange = oi; out.oiChange = oi; }
    }

    // Agent-Hub market context feeding the regime engine: institutional ETF demand,
    // market leverage, and the whole market's technical posture (total-cap RSI).
    if (gm) {
      const etf = findNum(gm, ["etfflow", "etf_flow", "etfnetflow", "etf"]);
      const lev = findNum(gm, ["leverageratio", "estimatedleverage", "leverage"]);
      if (etf !== undefined) { market.etfNetFlowZ = Math.max(-2.5, Math.min(2.5, etf / 250)); out.etfFlow = etf; }
      if (lev !== undefined) { market.marketLeverage = lev; out.leverage = lev; }
    }
    if (mcapTa) {
      const mr = findNum(mcapTa, RSI_KEYS);
      if (mr !== undefined && mr >= 0 && mr <= 100) { market.marketRsi = mr; out.marketRsi = Math.round(mr * 10) / 10; }
    }

    out.enriched = Object.keys(out.rsi).length > 0 || Object.keys(out.macd).length > 0 || out.fundingRate !== undefined || out.etfFlow !== undefined || out.marketRsi !== undefined;
  } catch { /* keep proxies */ }
  return out;
}
