// Thin, defensive wrappers over the extra CMC Agent Hub tools (trending narratives,
// macro events, news, coin search/lookup). Everything is best-effort: on any failure
// we return an honest "unavailable" shape rather than fabricating data.
import { callAgentHubTool } from "./agentHub";
import { ALTCOIN_SKILLS, type AltCoinData } from "../altcoinSkills";

const asText = (x: unknown): string => {
  try {
    if (x == null) return "";
    if (typeof x === "string") return x;
    if (Array.isArray(x)) return x.map(asText).join("\n");
    if (typeof x === "object") { const c = (x as any).content; if (Array.isArray(c)) return c.map((b) => b?.text ?? "").join("\n"); return JSON.stringify(x); }
    return String(x);
  } catch { return ""; }
};
const deepNum = (obj: unknown, sub: string, depth = 0): number | undefined => {
  if (obj == null || depth > 6) return undefined;
  if (Array.isArray(obj)) { for (const v of obj) { const n = deepNum(v, sub, depth + 1); if (n != null) return n; } return undefined; }
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) if (k.toLowerCase().includes(sub) && (typeof v === "number" || (typeof v === "string" && v !== "" && !isNaN(Number(v))))) return Number(v);
    for (const v of Object.values(obj as Record<string, unknown>)) { const n = deepNum(v, sub, depth + 1); if (n != null) return n; }
  }
  return undefined;
};
// pull the first array of objects found anywhere in the payload
const deepArray = (obj: unknown, depth = 0): any[] | null => {
  if (obj == null || depth > 6) return null;
  if (Array.isArray(obj)) { if (obj.length && typeof obj[0] === "object") return obj; for (const v of obj) { const a = deepArray(v, depth + 1); if (a) return a; } return null; }
  if (typeof obj === "object") { for (const v of Object.values(obj as Record<string, unknown>)) { const a = deepArray(v, depth + 1); if (a) return a; } }
  return null;
};
const pick = (o: any, keys: string[]): string | undefined => { for (const k of Object.keys(o ?? {})) if (keys.some((kk) => k.toLowerCase().includes(kk))) { const v = o[k]; if (v != null && typeof v !== "object") return String(v); } return undefined; };

export async function getNarratives(): Promise<{ ok: boolean; items: { name: string; detail?: string }[]; text?: string }> {
  try {
    const r = await callAgentHubTool("trending_crypto_narratives", {}, 12000);
    const arr = deepArray(r);
    if (arr?.length) return { ok: true, items: arr.slice(0, 12).map((o) => ({ name: pick(o, ["name", "narrative", "category", "sector", "title"]) ?? "Narrative", detail: pick(o, ["change", "performance", "coins", "tokens", "description"]) })) };
    const text = asText(r).trim();
    return text ? { ok: true, items: [], text } : { ok: false, items: [] };
  } catch { return { ok: false, items: [] }; }
}

export async function getMacroEvents(): Promise<{ ok: boolean; items: { event: string; date?: string; detail?: string }[]; text?: string }> {
  try {
    const r = await callAgentHubTool("get_upcoming_macro_events", {}, 12000);
    const arr = deepArray(r);
    if (arr?.length) return { ok: true, items: arr.slice(0, 10).map((o) => ({ event: pick(o, ["event", "name", "title"]) ?? "Event", date: pick(o, ["date", "time", "when"]), detail: pick(o, ["importance", "impact", "detail", "description"]) })) };
    const text = asText(r).trim();
    return text ? { ok: true, items: [], text } : { ok: false, items: [] };
  } catch { return { ok: false, items: [] }; }
}

export async function getNews(id: string, limit = 6): Promise<{ ok: boolean; items: { title: string; url?: string; source?: string }[] }> {
  try {
    const r = await callAgentHubTool("get_crypto_latest_news", { id, limit }, 12000);
    const arr = deepArray(r);
    if (arr?.length) return { ok: true, items: arr.slice(0, limit).map((o) => ({ title: pick(o, ["title", "headline", "text"]) ?? "News", url: pick(o, ["url", "link"]), source: pick(o, ["source", "site", "publisher"]) })) };
    return { ok: false, items: [] };
  } catch { return { ok: false, items: [] }; }
}

export async function coinLookup(query: string): Promise<{
  ok: boolean; symbol?: string; name?: string; id?: string;
  price?: number; change24h?: number; change7d?: number; change30d?: number;
  rsi?: number; macd?: number; marketCap?: number; volume24h?: number;
  signals?: { skill: string; signal: string; reason: string }[];
  news?: { title: string; url?: string; source?: string }[]; note?: string;
}> {
  try {
    const sr = await callAgentHubTool("search_cryptos", { query }, 10000);
    const arr = deepArray(sr);
    const first = arr?.[0];
    const id = first ? pick(first, ["id"]) : undefined;
    const symbol = (first ? pick(first, ["symbol"]) : query.toUpperCase()) ?? query.toUpperCase();
    const name = first ? pick(first, ["name"]) : undefined;
    if (!id) return { ok: false, note: "coin not found via Agent Hub search" };
    const [q, ta, met, news] = await Promise.all([
      callAgentHubTool("get_crypto_quotes_latest", { id }, 10000).catch(() => null),
      callAgentHubTool("get_crypto_technical_analysis", { id }, 12000).catch(() => null),
      callAgentHubTool("get_crypto_metrics", { id }, 12000).catch(() => null),
      getNews(String(id), 5),
    ]);
    const price = deepNum(q, "price");
    const change24h = deepNum(q, "24h") ?? deepNum(q, "percentchange24");
    const change7d = deepNum(q, "7d") ?? deepNum(q, "percentchange7");
    const change30d = deepNum(q, "30d") ?? deepNum(q, "percentchange30");
    const rsi = deepNum(ta, "rsi"); const macd = deepNum(ta, "histogram") ?? deepNum(ta, "macd");
    const ema = deepNum(ta, "ema"); const sma = deepNum(ta, "sma");
    const marketCap = deepNum(q, "marketcap"); const volume24h = deepNum(q, "volume");
    const whale = deepNum(met, "whale") ?? deepNum(met, "toptenholder");

    const data: AltCoinData = {
      symbol, name: name ?? symbol, price: price ?? 0,
      pctChange24h: change24h ?? 0, pctChange7d: change7d ?? 0, pctChange30d: change30d ?? 0,
      marketCap: marketCap ?? 0, volume24h: volume24h ?? 0,
      rsi, macd, ema, sma, whaleShare: whale != null ? (whale > 1 ? whale : whale * 100) : undefined,
    };
    const signals = ALTCOIN_SKILLS.map((sk) => { const v = sk.evaluate(data); return { skill: sk.name, signal: v.signal, reason: v.reason }; })
      .filter((v) => v.signal !== "NEUTRAL");

    return { ok: true, symbol, name, id: String(id), price, change24h, change7d, change30d, rsi, macd, marketCap, volume24h, signals, news: news.ok ? news.items : [] };
  } catch { return { ok: false, note: "Agent Hub lookup unavailable" }; }
}