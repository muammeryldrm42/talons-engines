// GET /api/marketmap — top coins by market cap with 24h/7d change, for the
// Market Map treemap (size = market cap, color = 24h change). Pure CMC listings,
// stablecoins/wrapped excluded. Deterministic mock fallback so the map always renders.
import { NextResponse } from "next/server";
import { getListings } from "@/lib/cmc/client";
import { isStable } from "@/lib/engine/config";

export const dynamic = "force-dynamic";

const MOCK = [
  { symbol: "BTC", name: "Bitcoin", slug: "bitcoin", marketCap: 1.2e12, change24h: -1.8, change7d: 4.2 },
  { symbol: "ETH", name: "Ethereum", slug: "ethereum", marketCap: 3.8e11, change24h: -2.6, change7d: 6.1 },
  { symbol: "BNB", name: "BNB", slug: "bnb", marketCap: 9.0e10, change24h: 0.8, change7d: 3.0 },
  { symbol: "SOL", name: "Solana", slug: "solana", marketCap: 7.5e10, change24h: 3.4, change7d: -2.1 },
  { symbol: "XRP", name: "XRP", slug: "xrp", marketCap: 6.0e10, change24h: -0.5, change7d: 1.2 },
  { symbol: "DOGE", name: "Dogecoin", slug: "dogecoin", marketCap: 2.2e10, change24h: 5.1, change7d: -3.4 },
  { symbol: "ADA", name: "Cardano", slug: "cardano", marketCap: 1.8e10, change24h: -2.2, change7d: 0.4 },
  { symbol: "AVAX", name: "Avalanche", slug: "avalanche", marketCap: 1.2e10, change24h: 1.9, change7d: -1.0 },
  { symbol: "LINK", name: "Chainlink", slug: "chainlink", marketCap: 1.0e10, change24h: -0.9, change7d: 2.3 },
  { symbol: "TON", name: "Toncoin", slug: "toncoin", marketCap: 9.5e9, change24h: 2.6, change7d: -4.2 },
  { symbol: "DOT", name: "Polkadot", slug: "polkadot", marketCap: 8.0e9, change24h: -1.4, change7d: 1.1 },
  { symbol: "MATIC", name: "Polygon", slug: "polygon", marketCap: 6.0e9, change24h: 0.3, change7d: -2.0 },
];

export async function GET(req: Request) {
  const n = Math.min(60, Math.max(10, Number(new URL(req.url).searchParams.get("n")) || 40));
  try {
    const r = await getListings(120);
    const coins = (r.data ?? [])
      .filter((c) => !isStable(c.symbol, c.name))
      .slice(0, n)
      .map((c) => ({
        symbol: c.symbol, name: c.name, slug: c.slug,
        marketCap: c.quote.USD.market_cap,
        change24h: c.quote.USD.percent_change_24h,
        change7d: c.quote.USD.percent_change_7d,
      }))
      .filter((c) => c.marketCap > 0);
    if (!coins.length) throw new Error("no listings");
    return NextResponse.json({ source: "cmc", asOf: new Date().toISOString(), coins });
  } catch {
    return NextResponse.json({ source: "mock", asOf: new Date().toISOString(), coins: MOCK });
  }
}
