// GET /api/sectors — sector rotation from CoinMarketCap categories: the hottest
// and coldest sectors by 24h average price change, filtered to meaningful size.
// Falls back to a deterministic mock on any CMC failure so the panel always renders.
import { NextResponse } from "next/server";
import { getCategories } from "@/lib/cmc/client";

export const dynamic = "force-dynamic";

type Sector = { name: string; change24h: number; marketCap: number; tokens: number };

const MOCK: Sector[] = [
  { name: "AI & Big Data", change24h: 3.4, marketCap: 2.8e10, tokens: 320 },
  { name: "Layer 2", change24h: 2.1, marketCap: 1.9e10, tokens: 140 },
  { name: "DeFi", change24h: 1.2, marketCap: 6.1e10, tokens: 980 },
  { name: "Memes", change24h: 0.6, marketCap: 4.4e10, tokens: 510 },
  { name: "Real World Assets", change24h: 0.3, marketCap: 1.2e10, tokens: 90 },
  { name: "Gaming", change24h: -0.8, marketCap: 1.5e10, tokens: 410 },
  { name: "Liquid Staking", change24h: -1.9, marketCap: 2.2e10, tokens: 70 },
  { name: "Privacy", change24h: -2.4, marketCap: 9.0e9, tokens: 120 },
  { name: "Metaverse", change24h: -3.1, marketCap: 8.0e9, tokens: 230 },
  { name: "NFT & Collectibles", change24h: -3.8, marketCap: 7.0e9, tokens: 360 },
];

function pack(source: string, cats: Sector[]) {
  const sorted = [...cats].sort((a, b) => b.change24h - a.change24h);
  return NextResponse.json({ source, asOf: new Date().toISOString(), hot: sorted.slice(0, 6), cold: sorted.slice(-6).reverse(), map: sorted.slice(0, 24), total: cats.length });
}

export async function GET() {
  try {
    const r = await getCategories();
    const cats: Sector[] = (r.data ?? [])
      .filter((c) => c.market_cap > 5e8 && c.num_tokens >= 5 && Number.isFinite(c.avg_price_change))
      .map((c) => ({ name: c.title || c.name, change24h: Math.round(c.avg_price_change * 100) / 100, marketCap: c.market_cap, tokens: c.num_tokens }));
    if (!cats.length) throw new Error("no categories");
    return pack("cmc", cats);
  } catch {
    return pack("mock", MOCK);
  }
}
