// Build a CoinMarketCap coin page URL. Prefers the real slug from listings;
// falls back to a name/symbol-derived slug.
export function cmcUrl(symbol: string, slug?: string, name?: string): string {
  let s = (slug || "").trim();
  if (!s && name) s = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!s) s = symbol.toLowerCase();
  return `https://coinmarketcap.com/currencies/${s}/`;
}
