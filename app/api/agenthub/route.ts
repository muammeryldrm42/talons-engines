// GET /api/agenthub — proves and exposes the CoinMarketCap AI Agent Hub (Data MCP)
// integration. Connects to the Agent Hub MCP endpoint, runs tools/list, and returns
// the discovered data tools (with their input schemas, for the interactive console).
import { NextResponse } from "next/server";
import { listAgentHubTools } from "@/lib/cmc/agentHub";

export const dynamic = "force-dynamic";

export async function GET() {
  const res = await listAgentHubTools();
  return NextResponse.json({
    integration: "CoinMarketCap AI Agent Hub · Data MCP",
    endpoint: res.endpoint,
    connected: res.connected,
    apiKeyPresent: res.keyed,
    toolCount: res.tools.length,
    tools: res.tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
    note: res.connected
      ? "Live connection to the CMC Agent Hub MCP; tools discovered via tools/list."
      : "Not connected. Set CMC_API_KEY (used as X-CMC-MCP-API-KEY) and ensure the Hub is reachable.",
    error: res.error,
  });
}
