// GET /api/prices — a price chart for BTC & ETH reconstructed from CoinMarketCap
// %-change anchors (1h / 24h / 7d / 30d / 90d). The free CMC Basic key has no
// historical OHLCV endpoint, so each past price is derived from the current price
// and the reported change: price_t = price_now / (1 + pct/100). Indexed to 100 at
// the 90d anchor so BTC and ETH are directly comparable on one axis.
//
// Data comes from /listings (same source the regime engine uses, so it works on
// any key that powers the rest of the app). Falls back to a deterministic mock on
// any CMC failure so the chart always renders — flagged with source: "mock".
import { NextResponse } from "next/server";
import { getListings } from "@/lib/cmc/client";

export const dynamic = "force-dynamic";

const ANCHORS: { key: "p90" | "p30" | "p7" | "p1d" | "p1h" | "now"; label: string }[] = [
  { key: "p90", label: "-90d" },
  { key: "p30", label: "-30d" },
  { key: "p7", label: "-7d" },
  { key: "p1d", label: "-24h" },
  { key: "p1h", label: "-1h" },
  { key: "now", label: "now" },
];

type Quote = { price: number; c1h: number; c24h: number; c7d: number; c30d: number; c90d: number };

function buildSide(sym: string, q: Quote) {
  const back = (pct: number) => q.price / (1 + pct / 100);
  const prices: Record<string, number> = {
    p90: back(q.c90d), p30: back(q.c30d), p7: back(q.c7d), p1d: back(q.c24h), p1h: back(q.c1h), now: q.price,
  };
  const base = prices.p90 || q.price;
  return {
    symbol: sym, price: q.price, change24h: q.c24h, change7d: q.c7d,
    points: ANCHORS.map((a) => ({ label: a.label, price: prices[a.key], index: (prices[a.key] / base) * 100 })),
  };
}

function pack(source: string, btcS: ReturnType<typeof buildSide>, ethS: ReturnType<typeof buildSide>) {
  const series = ANCHORS.map((a, i) => ({
    label: a.label,
    BTC: Math.round(btcS.points[i].index * 100) / 100,
    ETH: Math.round(ethS.points[i].index * 100) / 100,
  }));
  return NextResponse.json({ source, asOf: new Date().toISOString(), series, btc: btcS, eth: ethS });
}

// deterministic demo trajectory so the chart never breaks without a key
const MOCK_BTC: Quote = { price: 104250, c1h: 0.15, c24h: -1.8, c7d: 4.2, c30d: -6.5, c90d: 18.4 };
const MOCK_ETH: Quote = { price: 3180, c1h: 0.22, c24h: -2.6, c7d: 6.1, c30d: -9.2, c90d: 11.7 };

export async function GET() {
  try {
    const r = await getListings(50);
    const find = (sym: string) => (r.data ?? []).find((c) => c.symbol === sym);
    const b = find("BTC"), e = find("ETH");
    if (!b || !e) throw new Error("BTC/ETH not in listings");
    const toQ = (u: typeof b.quote.USD): Quote => ({
      price: u.price,
      c1h: u.percent_change_1h ?? 0,
      c24h: u.percent_change_24h,
      c7d: u.percent_change_7d,
      c30d: u.percent_change_30d,
      c90d: u.percent_change_90d,
    });
    return pack("cmc", buildSide("BTC", toQ(b.quote.USD)), buildSide("ETH", toQ(e.quote.USD)));
  } catch {
    return pack("mock", buildSide("BTC", MOCK_BTC), buildSide("ETH", MOCK_ETH));
  }
}
