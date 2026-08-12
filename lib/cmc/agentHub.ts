// CoinMarketCap AI Agent Hub — Data MCP client.
//
// The Agent Hub exposes CMC's data tools over a single Model Context Protocol
// endpoint (Streamable HTTP / JSON-RPC). Instead of parsing raw REST JSON, an
// agent discovers tools via `tools/list` and calls them via `tools/call`, getting
// decision-ready signals (quotes, technical analysis, global overview, derivatives,
// trending narratives, macro events, news, semantic search).
//
//   Endpoint : https://mcp.coinmarketcap.com/mcp
//   Auth     : header  X-CMC-MCP-API-KEY  (the same CMC Pro key works)
//   Keyless  : an x402 pay-per-request path also exists at /x402/mcp
//
// This client is intentionally dependency-free: a minimal JSON-RPC-over-HTTP
// implementation that handles both plain-JSON and SSE (text/event-stream)
// responses, so it runs inside a Next.js route without an MCP SDK.

const MCP_ENDPOINT = process.env.CMC_MCP_ENDPOINT || "https://mcp.coinmarketcap.com/mcp";
const PROTOCOL_VERSION = "2025-06-18";

function mcpKey(): string | undefined {
  // The Agent Hub MCP uses the standard CMC API key.
  return process.env.CMC_MCP_API_KEY || process.env.CMC_API_KEY;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

type JsonRpc = { jsonrpc: "2.0"; id?: number; method?: string; params?: unknown; result?: any; error?: any };

// Parse a response that may be plain JSON or an SSE stream of JSON-RPC frames.
function parseRpc(text: string, contentType: string): JsonRpc | null {
  if (contentType.includes("text/event-stream")) {
    const datas = text
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .filter(Boolean);
    for (let i = datas.length - 1; i >= 0; i--) {
      try {
        const j = JSON.parse(datas[i]);
        if (j && (j.result !== undefined || j.error !== undefined)) return j;
      } catch { /* keep scanning */ }
    }
    return null;
  }
  try { return JSON.parse(text); } catch { return null; }
}

async function rpc(
  method: string,
  params: unknown,
  id: number,
  sessionId?: string,
  signal?: AbortSignal,
): Promise<{ body: JsonRpc | null; sessionId?: string }> {
  const k = mcpKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (k) headers["X-CMC-MCP-API-KEY"] = k;
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const res = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    signal,
  });
  const sid = res.headers.get("mcp-session-id") || sessionId;
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  if (!res.ok) throw new Error(`Agent Hub MCP ${method} → ${res.status} ${res.statusText}`);
  return { body: parseRpc(text, ct), sessionId: sid || undefined };
}

// Open a session: initialize + initialized notification. Returns the session id.
async function open(signal?: AbortSignal): Promise<string | undefined> {
  const { body, sessionId } = await rpc(
    "initialize",
    {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "talons-regime-engine", version: "1.0.0" },
    },
    1,
    undefined,
    signal,
  );
  if (body?.error) throw new Error(`initialize: ${JSON.stringify(body.error)}`);
  // best-effort initialized notification (no id = notification)
  try {
    const k = mcpKey();
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
    if (k) headers["X-CMC-MCP-API-KEY"] = k;
    if (sessionId) headers["Mcp-Session-Id"] = sessionId;
    await fetch(MCP_ENDPOINT, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }), signal });
  } catch { /* notification is best-effort */ }
  return sessionId;
}

/** Discover the data tools the Agent Hub exposes (proves connectivity). */
export async function listAgentHubTools(timeoutMs = 8000): Promise<{ connected: boolean; endpoint: string; keyed: boolean; tools: McpTool[]; error?: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const sid = await open(ctrl.signal);
    const { body } = await rpc("tools/list", {}, 2, sid, ctrl.signal);
    if (body?.error) throw new Error(JSON.stringify(body.error));
    const tools: McpTool[] = (body?.result?.tools ?? []).map((x: any) => ({
      name: x.name, description: x.description, inputSchema: x.inputSchema,
    }));
    return { connected: true, endpoint: MCP_ENDPOINT, keyed: !!mcpKey(), tools };
  } catch (e) {
    return { connected: false, endpoint: MCP_ENDPOINT, keyed: !!mcpKey(), tools: [], error: String(e) };
  } finally {
    clearTimeout(t);
  }
}

/** Call a named Agent Hub tool and return its content payload. */
export async function callAgentHubTool(name: string, args: Record<string, unknown> = {}, timeoutMs = 10000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const sid = await open(ctrl.signal);
    const { body } = await rpc("tools/call", { name, arguments: args }, 3, sid, ctrl.signal);
    if (body?.error) throw new Error(JSON.stringify(body.error));
    const content = body?.result?.content;
    // MCP tool results are an array of content blocks; surface text/JSON if present
    if (Array.isArray(content)) {
      const textBlock = content.find((c: any) => c.type === "text");
      if (textBlock?.text) { try { return JSON.parse(textBlock.text); } catch { return textBlock.text; } }
    }
    return body?.result ?? null;
  } finally {
    clearTimeout(t);
  }
}
