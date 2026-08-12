// GET /api/movers — top gainers / losers / most-active from CMC listings
// (stablecoins excluded). Derived from data already fetched for the engine.
import { NextResponse } from "next/server";
import { buildInputs } from "@/lib/cmc/signals";
import { isStable } from "@/lib/engine/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const { coins, source } = await buildInputs({ scanLimit: 300 });
  const live = coins.filter((c) => !isStable(c.symbol, c.name) && c.volume24h > 0);
  const slim = (c: typeof live[number]) => ({
    symbol: c.symbol, name: c.name, slug: c.slug, price: c.price ?? 0,
    change24h: c.pctChange24h, change7d: c.pctChange7d, volume24h: c.volume24h, marketCap: c.marketCap,
  });
  const byChange = [...live].sort((a, b) => b.pctChange24h - a.pctChange24h);
  return NextResponse.json({
    source,
    gainers: byChange.slice(0, 12).map(slim),
    losers: byChange.slice(-12).reverse().map(slim),
    mostActive: [...live].sort((a, b) => b.volume24h - a.volume24h).slice(0, 12).map(slim),
  });
}
