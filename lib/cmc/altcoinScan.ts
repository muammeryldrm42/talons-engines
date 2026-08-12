// Live altcoin data for the altcoin skills: CMC listings for the candidate set +
// CMC Agent Hub (technicals, crypto metrics, trending narratives) enrichment.
// Best-effort and honest: whatever the Hub can't provide is left undefined and the
// dependent skills return NEUTRAL rather than inventing a signal.
import { getListings, hasKey } from "./client";
import { callAgentHubTool } from "./agentHub";
import { isStable } from "../engine/config";
import type { AltCoinData } from "../altcoinSkills";

export interface AltcoinScan { source: "cmc" | "unavailable"; hubEnriched: boolean; coins: AltCoinData[]; asOf: string }

// recursively find the first numeric value under a key containing `sub`
function deepNum(obj: unknown, sub: string, depth = 0): number | undefined {
  if (obj == null || depth > 6) return undefined;
  if (Array.isArray(obj)) { for (const v of obj) { const n = deepNum(v, sub, depth + 1); if (n != null) return n; } return undefined; }
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k.toLowerCase().includes(sub) && (typeof v === "number" || (typeof v === "string" && v !== "" && !isNaN(Number(v))))) return Number(v);
    }
    for (const v of Object.values(obj as Record<string, unknown>)) { const n = deepNum(v, sub, depth + 1); if (n != null) return n; }
  }
  return undefined;
}

const asText = (x: unknown): string => {
  try {
    if (x == null) return "";
    if (typeof x === "string") return x;
    if (Array.isArray(x)) return x.map(asText).join(" ");
    if (typeof x === "object") { const c = (x as any).content; if (Array.isArray(c)) return c.map((b) => b?.text ?? "").join(" "); return JSON.stringify(x); }
    return String(x);
  } catch { return ""; }
};

export async function scanAltcoins(topN = 8): Promise<AltcoinScan> {
  const asOf = new Date().toISOString();
  let listings;
  try { listings = await getListings(80); } catch { return { source: "unavailable", hubEnriched: false, coins: [], asOf }; }
  const items = listings?.data ?? [];
  if (!items.length) return { source: "unavailable", hubEnriched: false, coins: [], asOf };

  const btc = items.find((c) => c.symbol === "BTC");
  const btc7d = btc?.quote.USD.percent_change_7d ?? 0;

  const candidates = items
    .filter((c) => c.symbol !== "BTC" && c.symbol !== "ETH" && !isStable(c.symbol))
    .sort((a, b) => (b.quote.USD.volume_24h ?? 0) - (a.quote.USD.volume_24h ?? 0))
    .slice(0, topN);

  // trending narratives (one call, best-effort)
  let narrativeText = "";
  try { narrativeText = asText(await callAgentHubTool("trending_crypto_narratives", {})).toLowerCase(); } catch { /* optional */ }

  let hubEnriched = false;
  const coins: AltCoinData[] = await Promise.all(
    candidates.map(async (c) => {
      const base: AltCoinData = {
        symbol: c.symbol, name: c.name, id: c.id,
        price: c.quote.USD.price, pctChange24h: c.quote.USD.percent_change_24h,
        pctChange7d: c.quote.USD.percent_change_7d, pctChange30d: c.quote.USD.percent_change_30d,
        marketCap: c.quote.USD.market_cap, volume24h: c.quote.USD.volume_24h,
        btcRel7d: (c.quote.USD.percent_change_7d ?? 0) - btc7d,
        inTrendingNarrative: narrativeText ? narrativeText.includes(c.symbol.toLowerCase()) || narrativeText.includes(c.name.toLowerCase()) : false,
      };
      try {
        const ta = await callAgentHubTool("get_crypto_technical_analysis", { id: String(c.id) }, 12000);
        const rsi = deepNum(ta, "rsi"); const macd = deepNum(ta, "histogram") ?? deepNum(ta, "macd");
        const ema = deepNum(ta, "ema"); const sma = deepNum(ta, "sma");
        if (rsi != null) { base.rsi = rsi; hubEnriched = true; }
        if (macd != null) base.macd = macd;
        if (ema != null) base.ema = ema;
        if (sma != null) base.sma = sma;
      } catch { /* hub optional */ }
      try {
        const met = await callAgentHubTool("get_crypto_metrics", { id: String(c.id) }, 12000);
        const whale = deepNum(met, "whale") ?? deepNum(met, "toptenholder");
        if (whale != null) base.whaleShare = whale > 1 ? whale : whale * 100;
        const holders = deepNum(met, "holder"); const traders = deepNum(met, "trader");
        if (holders != null && traders) base.holderRatio = holders / traders;
      } catch { /* hub optional */ }
      return base;
    }),
  );

  return { source: "cmc", hubEnriched, coins, asOf };
}
