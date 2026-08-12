// Assemble the engine's inputs from CMC. If live calls fail (no key / rate limit),
// fall back to a deterministic mock so the demo and cron never hard-fail.

import {
  getFearGreed, getGlobalMetrics, getListings, getOhlcvHistorical, getCmc100Historical, hasKey,
} from "./client";
import { reconstructAltseason } from "./altseason";
import { rsi, macdHistogram } from "../indicators";
import { enrichFromHub } from "./hubEnrich";
import { isStable } from "../engine/config";
import type { CoinInput, MarketSignals } from "../engine/types";

export interface BuildOpts {
  /** how many coins to scan from the market (up to 5000). */
  scanLimit?: number;
  /** enrich the top N ranked candidates with real RSI from OHLCV (extra calls). */
  enrichTop?: number;
}

export interface BtcVitals {
  price: number;
  marketCap: number;
  volume24h: number;
  dominance: number;
  change1h: number;
  change24h: number;
  change7d: number;
  change30d: number;
  change90d: number;
}
export interface Globals {
  btc: BtcVitals;
  btcDominance: number;
  ethDominance: number;
  othersDominance: number;
  totalMarketCap: number;
  totalVolume24h: number;
  altcoinMarketCap: number | null;
  stablecoinMarketCap: number | null;
  marketCapChange24h: number | null;
  // market internals (computed from top-100 listings, stablecoins excluded)
  breadth: {
    universe: number;
    advancers24h: number;
    decliners24h: number;
    advancers7d: number;
    decliners7d: number;
    avgChange24h: number;
  };
}

export interface EngineInputs {
  market: MarketSignals;
  coins: CoinInput[];
  globals: Globals | null;
  source: "cmc" | "mock";
  scanned: number;
  hubEnriched?: boolean;
}

// Short-TTL cache so repeated page loads don't burn CMC credits (free tier is
// ~10-15k credits/month). Keyed by scan depth; market data moves on minutes.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { ts: number; value: EngineInputs }>();

export async function buildInputs(opts: BuildOpts = {}): Promise<EngineInputs> {
  const scanLimit = opts.scanLimit ?? 200;
  const enrichTop = opts.enrichTop ?? 0;
  const cacheKey = `${scanLimit}:${enrichTop}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.value;

  try {
    const [fg, gm, listings] = await Promise.all([
      getFearGreed(),
      getGlobalMetrics(),
      getListings(scanLimit),
    ]);

    const items = listings.data;
    const btc = items.find((c) => c.symbol === "BTC");
    const altseasonIndex = reconstructAltseason(items);

    let coins: CoinInput[] = items.map((c) => ({
      symbol: c.symbol,
      name: c.name,
      slug: c.slug,
      price: c.quote.USD.price,
      marketCap: c.quote.USD.market_cap,
      volume24h: c.quote.USD.volume_24h,
      pctChange24h: c.quote.USD.percent_change_24h,
      pctChange7d: c.quote.USD.percent_change_7d,
      pctChange30d: c.quote.USD.percent_change_30d,
      pctChange90d: c.quote.USD.percent_change_90d,
    }));

    // Two-pass: enrich the top-liquidity candidates with real RSI (bounded calls).
    if (enrichTop > 0) {
      const top = [...coins]
        .sort((a, b) => b.volume24h - a.volume24h)
        .slice(0, enrichTop);
      await Promise.all(
        top.map(async (c) => {
          try {
            const ohlcv = await getOhlcvHistorical(c.symbol, 40, "daily");
            const closes = ohlcv.data.quotes.map((q) => q.quote.USD.close);
            const r = rsi(closes, 14);
            const m = macdHistogram(closes);
            if (typeof r === "number") c.rsi = r;
            if (typeof m === "number") c.macdHistogram = m;
          } catch {
            /* leave undefined → scorer falls back to %change proxy */
          }
        }),
      );
    }

    const market: MarketSignals = {
      fearGreed: fg.data.value,
      altseasonIndex,
      btcDominance: gm.data.btc_dominance,
      btcDominanceTrend: 0, // wire global-metrics/historical for a real slope
      btcReturn7d: btc?.quote.USD.percent_change_7d ?? 0,
      btcReturn30d: btc?.quote.USD.percent_change_30d ?? 0,
    };

    const u = gm.data.quote.USD;
    const bq = btc?.quote.USD;
    const nonStable = coins.filter((c) => !isStable(c.symbol, c.name));
    const top = nonStable.slice(0, 100);
    const adv24 = top.filter((c) => c.pctChange24h > 0).length;
    const adv7 = top.filter((c) => (c.pctChange7d ?? 0) > 0).length;
    const avg24 = top.length ? top.reduce((a, c) => a + c.pctChange24h, 0) / top.length : 0;
    const globals: Globals = {
      btc: {
        price: bq?.price ?? 0,
        marketCap: bq?.market_cap ?? 0,
        volume24h: bq?.volume_24h ?? 0,
        dominance: gm.data.btc_dominance,
        change1h: bq?.percent_change_1h ?? 0,
        change24h: bq?.percent_change_24h ?? 0,
        change7d: bq?.percent_change_7d ?? 0,
        change30d: bq?.percent_change_30d ?? 0,
        change90d: bq?.percent_change_90d ?? 0,
      },
      btcDominance: gm.data.btc_dominance,
      ethDominance: gm.data.eth_dominance,
      othersDominance: Math.max(0, 100 - gm.data.btc_dominance - gm.data.eth_dominance),
      totalMarketCap: u.total_market_cap,
      totalVolume24h: u.total_volume_24h,
      altcoinMarketCap: u.altcoin_market_cap ?? null,
      stablecoinMarketCap: u.stablecoin_market_cap ?? null,
      marketCapChange24h: u.total_market_cap_yesterday_percentage_change ?? null,
      breadth: {
        universe: top.length,
        advancers24h: adv24,
        decliners24h: top.length - adv24,
        advancers7d: adv7,
        decliners7d: top.length - adv7,
        avgChange24h: Math.round(avg24 * 100) / 100,
      },
    };

    // CMC100 breadth (best-effort): 30d trend of CoinMarketCap's broad-market index.
    try {
      const c100 = await getCmc100Historical(40);
      const pts = (c100?.data ?? [])
        .map((p) => (typeof p.value === "number" ? p.value : null))
        .filter((v): v is number => v != null);
      if (pts.length > 30) {
        const last = pts[pts.length - 1];
        const past = pts[pts.length - 31];
        if (past) market.cmc100Trend = ((last - past) / past) * 100;
      }
    } catch { /* index optional — engine no-ops without it */ }

    // Pull real RSI/MACD (BTC & ETH) + funding/OI from the CMC Agent Hub (best-effort).
    const hub = await enrichFromHub(coins, market).catch(() => ({ enriched: false } as { enriched: boolean }));
    const result: EngineInputs = { market, coins, globals, source: "cmc", scanned: coins.length, hubEnriched: hub.enriched };
    cache.set(cacheKey, { ts: Date.now(), value: result });
    return result;
  } catch (err) {
    console.warn("[cmc] live build failed, using mock:", (err as Error).message);
    const m = mockInputs();
    return { ...m, globals: null, source: "mock", scanned: m.coins.length };
  }
}

// Deterministic mock — a "Capitulation" snapshot for demos without a key.
// Extreme fear + sharp BTC drop, but ETF inflows + negative funding + exchange
// outflows → institutional accumulation diverging from retail panic → contrarian long.
export function mockInputs(): { market: MarketSignals; coins: CoinInput[] } {
  const market: MarketSignals = {
    fearGreed: 14,
    altseasonIndex: 19,
    btcDominance: 59.1,
    btcDominanceTrend: 1.4,
    btcReturn7d: -13.5,
    btcReturn30d: -18.0,
    etfNetFlowZ: 1.6, // strong inflows while price drops → bullish divergence
    aggFundingRate: -0.0003, // negative funding → shorts paying, contrarian support
    openInterestChange: -22, // OI collapsing → forced deleveraging (capitulation)
    liquidationCascade: false,
    riskFlag: false,
  };
  const coins: CoinInput[] = [
    // symbol, name, price, mcap, vol, 24h, 7d, 30d, 90d, funding, exchangeNetflow
    mk("BTC", "Bitcoin", 61000, 1.2e12, 55e9, -2.1, -13.5, -18.0, -8, -0.0004, -35),
    mk("ETH", "Ethereum", 3300, 4e11, 28e9, -3.0, -16.0, -22.0, -14, -0.0006, -28),
    mk("SOL", "Solana", 148, 8e10, 6e9, -4.5, -20.0, -30.0, -25, 0.0002, 12),
    mk("BNB", "BNB", 620, 9e10, 2e9, -1.2, -9.0, -12.0, -5, -0.0001, -10),
    mk("XRP", "XRP", 2.1, 1.3e11, 4e9, -2.8, -14.0, -19.0, -16, 0.0003, 18),
    mk("DOGE", "Dogecoin", 0.13, 2e10, 1.5e9, -5.0, -24.0, -33.0, -30, 0.0005, 22),
  ];
  return { market, coins };
}

function mk(
  symbol: string, name: string, price: number, mc: number, vol: number,
  c24: number, c7: number, c30: number, c90: number,
  funding?: number, netflow?: number,
): CoinInput {
  return {
    symbol, name, price, marketCap: mc, volume24h: vol,
    pctChange24h: c24, pctChange7d: c7, pctChange30d: c30, pctChange90d: c90,
    fundingRate: funding, exchangeNetflow: netflow,
  };
}

export { hasKey } from "./client";

// Build a CoinInput for a single requested ticker (single-coin analyze),
// enriched with real RSI + MACD from OHLCV when available.
import { getQuotes } from "./client";
export async function coinFromQuotes(symbol: string): Promise<CoinInput | null> {
  try {
    const sym = symbol.toUpperCase();
    const q = await getQuotes([sym]);
    const d = q.data[sym];
    if (!d) return null;
    const u = d.quote.USD;
    const coin: CoinInput = {
      symbol: d.symbol,
      name: d.name,
      slug: d.slug,
      price: u.price,
      marketCap: u.market_cap,
      volume24h: u.volume_24h,
      pctChange24h: u.percent_change_24h,
      pctChange7d: u.percent_change_7d,
      pctChange30d: u.percent_change_30d,
      pctChange90d: u.percent_change_90d,
    };
    try {
      const ohlcv = await getOhlcvHistorical(sym, 40, "daily");
      const closes = ohlcv.data.quotes.map((x) => x.quote.USD.close);
      const r = rsi(closes, 14);
      const mac = macdHistogram(closes);
      if (typeof r === "number") coin.rsi = r;
      if (typeof mac === "number") coin.macdHistogram = mac;
    } catch {
      /* historical not on this plan → score uses %change proxies */
    }
    return coin;
  } catch {
    return null;
  }
}
