// GET /api/ta — diagnostic + live technical analysis for BTC & ETH from the CMC
// Agent Hub. Returns the RAW tool payloads alongside the RSI/MACD this app
// extracts, plus the Hub's available tool names — so the exact field shapes can
// be inspected if extraction ever comes back empty.
import { NextResponse } from "next/server";
import { callAgentHubTool, listAgentHubTools } from "@/lib/cmc/agentHub";

export const dynamic = "force-dynamic";

function findNum(obj: any, names: string[], depth = 0): number | undefined {
  if (obj == null || depth > 6) return undefined;
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if (names.some((n) => k.toLowerCase().includes(n))) {
        if (typeof v === "number" && Number.isFinite(v)) return v;
        if (typeof v === "string") { const f = parseFloat(v); if (Number.isFinite(f)) return f; }
        if (v && typeof v === "object") { const i = findNum(v, ["value", "usd", "current", "latest", "last", "close"], depth + 1); if (i !== undefined) return i; }
      }
    }
    for (const v of Object.values(obj)) { const r = findNum(v, names, depth + 1); if (r !== undefined) return r; }
  }
  return undefined;
}

async function ta(id: number) {
  try {
    const r = await callAgentHubTool("get_crypto_technical_analysis", { id: String(id) }, 13000);
    if (r && !(typeof r === "object" && (r as any).error)) return { tool: "get_crypto_technical_analysis", args: { id: String(id) }, payload: r };
  } catch { /* next */ }
  return null;
}

export async function GET() {
  const [tools, btc, eth] = await Promise.all([
    listAgentHubTools().then((t) => t.tools.map((x) => x.name)).catch(() => [] as string[]),
    ta(1),
    ta(1027),
  ]);
  const extract = (p: any) => p ? { rsi: findNum(p.payload, ["rsi", "relative_strength"]) ?? null, macd: findNum(p.payload, ["macd_hist", "histogram", "macd"]) ?? null, tool: p.tool, args: p.args } : null;
  return NextResponse.json({
    source: btc || eth ? "cmc-agent-hub" : "unavailable",
    availableTools: tools,
    btc: { extracted: extract(btc), raw: btc?.payload ?? null },
    eth: { extracted: extract(eth), raw: eth?.payload ?? null },
  });
}
