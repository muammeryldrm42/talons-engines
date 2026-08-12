// CoinMarketCap Pro API client. Server-side only — never import into client components.
// Key comes from process.env.CMC_API_KEY.

const BASE = "https://pro-api.coinmarketcap.com";
// Keyless trial base (rate-limited, no key) — used as a fallback for demos.
const TRIAL = "https://pro-api.coinmarketcap.com/trial-pro-api";

function key(): string | undefined {
  return process.env.CMC_API_KEY;
}

async function cmcGet<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const k = key();
  const base = k ? BASE : TRIAL;
  const url = new URL(base + path);
  Object.entries(params).forEach(([key, v]) => url.searchParams.set(key, String(v)));

  const res = await fetch(url.toString(), {
    headers: k ? { "X-CMC_PRO_API_KEY": k, Accept: "application/json" } : { Accept: "application/json" },
    // cache for 15 min — F&G + global metrics update on that cadence
    next: { revalidate: 900 },
  });
  if (!res.ok) {
    throw new Error(`CMC ${path} → ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

// --- typed endpoint wrappers ---

export interface FearGreedResp {
  data: { value: number; value_classification: string };
}
export const getFearGreed = () => cmcGet<FearGreedResp>("/v3/fear-and-greed/latest");

export interface GlobalMetricsResp {
  data: {
    btc_dominance: number;
    eth_dominance: number;
    quote: {
      USD: {
        total_market_cap: number;
        total_volume_24h: number;
        altcoin_market_cap?: number;
        altcoin_volume_24h?: number;
        stablecoin_market_cap?: number;
        defi_market_cap?: number;
        total_market_cap_yesterday_percentage_change?: number;
      };
    };
  };
}
export const getGlobalMetrics = () =>
  cmcGet<GlobalMetricsResp>("/v1/global-metrics/quotes/latest");

export interface ListingItem {
  id: number;
  symbol: string;
  name: string;
  slug: string;
  quote: {
    USD: {
      price: number;
      market_cap: number;
      volume_24h: number;
      percent_change_1h: number;
      percent_change_24h: number;
      percent_change_7d: number;
      percent_change_30d: number;
      percent_change_90d: number;
    };
  };
}
export interface ListingsResp {
  data: ListingItem[];
}
// Listings supports up to 5000 per call — enough to scan the whole liquid market.
export const getListings = (limit = 200) =>
  cmcGet<ListingsResp>("/v1/cryptocurrency/listings/latest", {
    limit: Math.min(Math.max(limit, 1), 5000),
    convert: "USD",
  });

// --- historical (for the backtest-lite) ---

export interface FearGreedHist {
  data: { value: number; timestamp: string }[];
}
export const getFearGreedHistorical = (limit = 120) =>
  cmcGet<FearGreedHist>("/v3/fear-and-greed/historical", { limit });

export interface OhlcvHist {
  data: { quotes: { time_close: string; quote: { USD: { close: number } } }[] };
}
export const getOhlcvHistorical = (symbol: string, count = 120, interval = "daily") =>
  cmcGet<OhlcvHist>("/v2/cryptocurrency/ohlcv/historical", {
    symbol, count, interval, convert: "USD",
  });

export interface GlobalMetricsHist {
  data: { quotes: { timestamp: string; btc_dominance: number }[] };
}
export const getGlobalMetricsHistorical = (count = 120, interval = "daily") =>
  cmcGet<GlobalMetricsHist>("/v1/global-metrics/quotes/historical", { count, interval });

export interface QuotesResp {
  data: Record<
    string,
    {
      name: string;
      symbol: string;
      slug?: string;
      quote: {
        USD: {
          price: number;
          market_cap: number;
          volume_24h: number;
          percent_change_1h?: number;
          percent_change_24h: number;
          percent_change_7d: number;
          percent_change_30d: number;
          percent_change_90d: number;
        };
      };
    }
  >;
}
export const getQuotes = (symbols: string[]) =>
  cmcGet<QuotesResp>("/v2/cryptocurrency/quotes/latest", {
    symbol: symbols.join(","), convert: "USD",
  });

// Sector / category market data (DeFi, AI, Memes, L2, ...).
export interface CategoryItem {
  id: string;
  name: string;
  title?: string;
  market_cap: number;
  market_cap_change: number; // 24h %
  volume: number;
  num_tokens: number;
  avg_price_change: number; // 24h %
}
export interface CategoriesResp { data: CategoryItem[] }
export const getCategories = () =>
  cmcGet<CategoriesResp>("/v1/cryptocurrency/categories");

// CoinMarketCap news / content.
export interface ContentItem {
  title: string;
  subtitle?: string;
  type?: string;
  source_name?: string;
  source_url?: string;
  released_at?: string;
  created_at?: string;
  assets?: { name: string; symbol: string }[];
}
export interface ContentResp { data: ContentItem[] }
export const getContent = (symbol = "BTC") =>
  cmcGet<ContentResp>("/v1/content/latest", { symbol, news_type: "news" });

export const hasKey = () => !!key();

// CMC100 Index — CoinMarketCap's official top-100 benchmark (stablecoins excluded).
// Data is free to use. latest + historical.
export interface Cmc100Latest { data?: { value?: number; value_24h_percentage_change?: number; last_update?: string; constituents?: unknown[] } }
export const getCmc100Latest = () => cmcGet<Cmc100Latest>("/v3/index/cmc100-latest");
export interface Cmc100Hist { data?: Array<{ value?: number; update_time?: string; timestamp?: string }> }
export const getCmc100Historical = (count = 120, interval = "daily") =>
  cmcGet<Cmc100Hist>("/v3/index/cmc100-historical", { count, interval });
