// GET/POST /api/mcp — a minimal MCP server (Streamable HTTP, JSON-RPC 2.0).
// Exposes the Talons Regime Engine as a callable MCP tool so any agent
// (Claude, MCP Inspector, the CMC "Connect MCP" flow) can discover and invoke it.
// No new logic — it wraps the existing runAgentSkill() decision framework.
import { NextResponse } from "next/server";
import { runAgentSkill, toMarkdown } from "@/lib/agentSkill";
import { scanAltcoins } from "@/lib/cmc/altcoinScan";
import { ALTCOIN_SKILLS } from "@/lib/altcoinSkills";
import { getNarratives, getMacroEvents, coinLookup } from "@/lib/cmc/agentHubData";
import { buildInputs } from "@/lib/cmc/signals";
import { runSkills } from "@/lib/skills";
import { runSkillBacktest } from "@/lib/skillBacktest";
import { runAltcoinBacktest } from "@/lib/altcoinBacktest";

export const dynamic = "force-dynamic";

const PROTOCOL = "2024-11-05";
const SERVER = { name: "talons-regime-engine", version: "1.1.0" };

const TOOLS = [
  {
    name: "get_strategy_decision",
    description:
      "Run the Talons Regime Engine and return today's market decision framework: the current regime (one of five), BTC/ETH BUY/SELL/HOLD with target weights, risk posture, confirming signals, the conditions that would invalidate the thesis, net exposure, and a plain-English rationale. Built from live CoinMarketCap data + the CMC Agent Hub. No arguments required.",
    inputSchema: {
      type: "object",
      properties: { format: { type: "string", enum: ["json", "markdown"], description: "Output format. Default json." } },
      additionalProperties: false,
    },
  },
  {
    name: "describe_strategy",
    description: "Return a find_skill-style descriptor for this strategy skill: what it does, the CMC capabilities it uses, how to invoke it, and its output schema.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "scan_altcoins",
    description: "Scan the most liquid altcoins live and return each Agent-Hub-powered altcoin skill's current BUY/SELL picks (RSI/MACD, whale & holder structure, trending narratives).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_narrative_rotation",
    description: "Return the trending crypto narratives from the CMC Agent Hub - where market attention and rotation are concentrated right now.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_macro_events",
    description: "Return upcoming macro events (CPI, FOMC, jobs, etc.) from the CMC Agent Hub that can shift crypto risk appetite.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "coin_lookup",
    description: "Look up any crypto by ticker or name via the CMC Agent Hub and return a live snapshot: price, 24h/7d change, RSI, MACD.",
    inputSchema: { type: "object", properties: { query: { type: "string", description: "Ticker or name, e.g. SOL" } }, required: ["query"], additionalProperties: false },
  },
  {
    name: "skill_consensus",
    description: "Return how the 24 ETH/BTC skills line up for BTC and ETH: buy/sell/neutral counts and the net lean.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "skill_backtest",
    description: "Backtest all 24 ETH/BTC skills as long-only BTC spot strategies and return them ranked by risk-adjusted return (Sharpe). ?synthetic uses the 4-year synthetic series.",
    inputSchema: { type: "object", properties: { synthetic: { type: "boolean", description: "Use the synthetic 4-year series instead of live ~90d." } }, additionalProperties: false },
  },
  {
    name: "altcoin_backtest",
    description: "Backtest the 14 Agent-Hub altcoin skills as long-only spot strategies across the altcoin universe, ranked by Sharpe.",
    inputSchema: { type: "object", properties: { synthetic: { type: "boolean" } }, additionalProperties: false },
  },
];

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, mcp-protocol-version",
};

const json = (body: unknown, status = 200) =>
  new NextResponse(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });
const ok = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id, result });
const err = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

function describe(base: string) {
  return {
    id: "talons-regime-engine", name: "Talons Regime Engine", category: "strategy",
    description: "Regime-adaptive crypto strategy skill. Five-regime classifier over CMC signals + Agent Hub data, emitting BTC/ETH BUY/SELL/HOLD with risk budget, net exposure, confirming signals, invalidation conditions, and rationale.",
    capabilities: ["cmc-data-api", "cmc-agent-hub-mcp", "cmc100-index"],
    invocation: { transport: "mcp", endpoint: `${base}/api/mcp`, tool: "get_strategy_decision", rest: `${base}/api/skill`, describe: `${base}/api/skill/describe` },
    output: "regime + riskPosture + marketState + signals[BTC/ETH] + confirmingSignals + invalidation + netExposure + rationale",
  };
}

async function handleOne(msg: any, base: string): Promise<unknown | null> {
  const { id, method, params } = msg ?? {};
  if (typeof method === "string" && method.startsWith("notifications/")) return null; // notification, no reply
  switch (method) {
    case "initialize":
      return ok(id, { protocolVersion: PROTOCOL, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER, instructions: "Call get_strategy_decision for today's regime-adaptive BTC/ETH decision framework." });
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: TOOLS });
    case "tools/call": {
      const name = params?.name;
      const args = params?.arguments ?? {};
      try {
        if (name === "get_strategy_decision") {
          const out = await runAgentSkill();
          const text = args.format === "markdown" ? toMarkdown(out) : JSON.stringify(out, null, 2);
          return ok(id, { content: [{ type: "text", text }], isError: false });
        }
        if (name === "describe_strategy") {
          return ok(id, { content: [{ type: "text", text: JSON.stringify(describe(base), null, 2) }], isError: false });
        }
        if (name === "scan_altcoins") {
          const scan = await scanAltcoins(8);
          const out = ALTCOIN_SKILLS.map((sk) => ({ skill: sk.name, picks: scan.coins.map((c) => ({ symbol: c.symbol, ...sk.evaluate(c) })).filter((v) => v.signal !== "NEUTRAL") })).filter((x) => x.picks.length);
          return ok(id, { content: [{ type: "text", text: JSON.stringify({ source: scan.source, hubEnriched: scan.hubEnriched, scanned: scan.coins.map((c) => c.symbol), skills: out }, null, 2) }], isError: false });
        }
        if (name === "get_narrative_rotation") {
          return ok(id, { content: [{ type: "text", text: JSON.stringify(await getNarratives(), null, 2) }], isError: false });
        }
        if (name === "get_macro_events") {
          return ok(id, { content: [{ type: "text", text: JSON.stringify(await getMacroEvents(), null, 2) }], isError: false });
        }
        if (name === "coin_lookup") {
          const q = String(args.query ?? "").trim();
          if (!q) return ok(id, { content: [{ type: "text", text: "Provide a query (ticker or name)." }], isError: true });
          return ok(id, { content: [{ type: "text", text: JSON.stringify(await coinLookup(q), null, 2) }], isError: false });
        }
        if (name === "skill_backtest") {
          const r = await runSkillBacktest(args.synthetic ? 1460 : 90, !!args.synthetic);
          return ok(id, { content: [{ type: "text", text: JSON.stringify({ source: r.source, days: r.days, hold: r.hold, skills: r.skills.slice(0, 12) }, null, 2) }], isError: false });
        }
        if (name === "altcoin_backtest") {
          const r = await runAltcoinBacktest(args.synthetic ? 365 : 90, !!args.synthetic);
          return ok(id, { content: [{ type: "text", text: JSON.stringify({ source: r.source, universe: r.universe, days: r.days, hold: r.hold, skills: r.skills.slice(0, 12) }, null, 2) }], isError: false });
        }
        if (name === "skill_consensus") {
          const { market, coins, globals } = await buildInputs({ scanLimit: 200 });
          const v = runSkills({ market, coins, globals });
          const tally = (sym: string) => { const vs = v.filter((x: any) => x.symbol === sym); const buy = vs.filter((x: any) => x.signal === "BUY").length, sell = vs.filter((x: any) => x.signal === "SELL").length; return { buy, sell, neutral: vs.length - buy - sell, total: vs.length }; };
          return ok(id, { content: [{ type: "text", text: JSON.stringify({ BTC: tally("BTC"), ETH: tally("ETH") }, null, 2) }], isError: false });
        }
        return ok(id, { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true });
      } catch (e) {
        return ok(id, { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true });
      }
    }
    default:
      if (id === undefined || id === null) return null;
      return err(id, -32601, `Method not found: ${method}`);
  }
}

export async function POST(req: Request) {
  const base = new URL(req.url).origin;
  let body: any;
  try { body = await req.json(); } catch { return json(err(null, -32700, "Parse error")); }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleOne(m, base)))).filter((x) => x !== null);
    return out.length ? json(out) : new NextResponse(null, { status: 202, headers: CORS });
  }
  const res = await handleOne(body, base);
  return res ? json(res) : new NextResponse(null, { status: 202, headers: CORS });
}

export async function GET() {
  return new NextResponse("Talons Regime Engine MCP server. POST JSON-RPC 2.0 (Streamable HTTP): initialize, tools/list, tools/call.", { status: 405, headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
