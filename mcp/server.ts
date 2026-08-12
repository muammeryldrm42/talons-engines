// MCP server — exposes the Regime Engine skill as a tool any MCP client
// (Claude Desktop, Cursor, LangChain, the CMC Agent Hub) can invoke.
//
// Run:  npm run mcp     (or: tsx mcp/server.ts)
// Claude Desktop config:
//   { "mcpServers": { "talons-regime": { "command": "tsx", "args": ["mcp/server.ts"],
//     "env": { "CMC_API_KEY": "..." } } } }

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { evaluate } from "../lib/skill";
import { buildInputs } from "../lib/cmc/signals";

const server = new McpServer({ name: "talons-regime-engine", version: "0.2.0" });

server.registerTool(
  "get_regime_strategy",
  {
    title: "Get Regime Strategy",
    description:
      "Read the current crypto market regime from CoinMarketCap signals and return a " +
      "regime-aware, position-sized strategy decision: a ranked list of directional " +
      "signals (long/short) with target weights and a natural-language rationale. " +
      "Use 'scan: true' to score the whole liquid market instead of the focused universe.",
    inputSchema: {
      scan: z.boolean().optional().describe("scan the entire liquid market"),
      limit: z.number().optional().describe("how many coins to pull from CMC (up to 5000)"),
    },
  },
  async ({ scan, limit }) => {
    const { market, coins, source, scanned } = await buildInputs({
      scanLimit: limit ?? 200,
      enrichTop: scan ? 0 : 10,
    });
    const decision = evaluate({
      asOf: new Date().toISOString(),
      market,
      coins,
      options: { fullScan: !!scan, confidenceScaling: true },
    });
    return {
      content: [
        { type: "text", text: JSON.stringify({ source, scanned, ...decision }, null, 2) },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("talons-regime-engine MCP server running on stdio");
