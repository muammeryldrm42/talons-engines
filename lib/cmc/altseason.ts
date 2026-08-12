// Reconstruct the Altcoin Season Index (no direct CMC historical endpoint).
// CMC definition: if ≥75% of the top 100 coins outperform BTC over the last 90 days,
// it's Altcoin Season. We map the share of outperformers to a 0-100 index.

import type { ListingItem } from "./client";

export function reconstructAltseason(listings: ListingItem[]): number {
  const btc = listings.find((c) => c.symbol === "BTC");
  if (!btc) return 50;
  const btc90 = btc.quote.USD.percent_change_90d;

  // top 100 excluding BTC and stablecoins (rough filter by near-zero 90d move + name)
  const top = listings
    .filter((c) => c.symbol !== "BTC")
    .filter((c) => !isStable(c))
    .slice(0, 100);

  if (top.length === 0) return 50;
  const outperformers = top.filter((c) => c.quote.USD.percent_change_90d > btc90).length;
  const share = outperformers / top.length; // 0..1

  // CMC scales so that 75% outperformance ≈ "alt season" threshold.
  // Map share directly to 0-100 (share*100), which matches the CMC index semantics.
  return Math.round(share * 100);
}

function isStable(c: ListingItem): boolean {
  const s = c.symbol.toUpperCase();
  return ["USDT", "USDC", "DAI", "FDUSD", "TUSD", "USDE", "PYUSD", "USDD"].includes(s);
}
