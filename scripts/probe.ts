// CMC key capability probe. Run:  npm run probe   (or: tsx scripts/probe.ts)
// Reads CMC_API_KEY from the environment. Reports which endpoints your key can
// reach, so you know exactly what the live skill, scanner, and backtest can use.
// Your key is read from env only — never printed, never transmitted anywhere else.

const KEY = process.env.CMC_API_KEY;
const BASE = "https://pro-api.coinmarketcap.com";

if (!KEY) {
  console.error("No CMC_API_KEY in env. Set it first:\n  CMC_API_KEY=xxxx npm run probe");
  process.exit(1);
}

interface Probe { label: string; path: string; params?: Record<string, string>; group: "live" | "historical"; }

const PROBES: Probe[] = [
  { label: "Fear & Greed (latest)", path: "/v3/fear-and-greed/latest", group: "live" },
  { label: "Global metrics (latest)", path: "/v1/global-metrics/quotes/latest", group: "live" },
  { label: "Listings (latest)", path: "/v1/cryptocurrency/listings/latest", params: { limit: "10" }, group: "live" },
  { label: "Quotes (latest)", path: "/v2/cryptocurrency/quotes/latest", params: { symbol: "BTC" }, group: "live" },
  { label: "Fear & Greed (historical)", path: "/v3/fear-and-greed/historical", params: { limit: "10" }, group: "historical" },
  { label: "Global metrics (historical)", path: "/v1/global-metrics/quotes/historical", params: { count: "10", interval: "daily" }, group: "historical" },
  { label: "OHLCV (historical)", path: "/v2/cryptocurrency/ohlcv/historical", params: { symbol: "BTC", count: "10", interval: "daily" }, group: "historical" },
];

async function run() {
  console.log("\nProbing CMC key capabilities…\n");
  const results: { label: string; group: string; ok: boolean; status: number; note: string }[] = [];

  for (const p of PROBES) {
    const url = new URL(BASE + p.path);
    Object.entries(p.params ?? {}).forEach(([k, v]) => url.searchParams.set(k, v));
    try {
      const res = await fetch(url.toString(), { headers: { "X-CMC_PRO_API_KEY": KEY!, Accept: "application/json" } });
      const body = await res.json().catch(() => ({}));
      const code = body?.status?.error_code ?? 0;
      const msg = body?.status?.error_message ?? "";
      const ok = res.ok && code === 0;
      const note = ok ? "accessible" : code === 1006 ? "plan does not include this endpoint" : `${res.status} ${msg}`;
      results.push({ label: p.label, group: p.group, ok, status: res.status, note });
      console.log(`  ${ok ? "✓" : "✗"} ${p.label.padEnd(30)} ${note}`);
    } catch (e) {
      results.push({ label: p.label, group: p.group, ok: false, status: 0, note: (e as Error).message });
      console.log(`  ✗ ${p.label.padEnd(30)} ${(e as Error).message}`);
    }
  }

  const liveOk = results.filter((r) => r.group === "live").every((r) => r.ok);
  const histOk = results.filter((r) => r.group === "historical").every((r) => r.ok);

  console.log("\n── Verdict ──");
  console.log(`  Live skill / scanner / MCP / forward-test : ${liveOk ? "READY ✓" : "missing live endpoints ✗"}`);
  console.log(`  Historical backtest                       : ${histOk ? "READY ✓" : "NOT on this plan — backtest falls back to synthetic; use the forward-test for real evidence"}`);
  console.log("");
}

run();
