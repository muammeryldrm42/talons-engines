import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { evaluate } from "./lib/skill";
import { buildInputs } from "./lib/cmc/signals";
const server = new McpServer({ name: "talons-regime-engine", version: "0.2.0" });
let registered = false;
server.registerTool("get_regime_strategy",
  { title: "Get Regime Strategy", description: "test", inputSchema: { scan: z.boolean().optional(), limit: z.number().optional() } },
  async () => ({ content: [{ type: "text", text: "ok" }] }));
registered = true;
console.log("McpServer + registerTool OK:", registered);
(async () => {
  const { market, coins, source, scanned } = await buildInputs({ scanLimit: 200, enrichTop: 0 });
  const d = evaluate({ asOf: new Date().toISOString(), market, coins, options: { confidenceScaling: true } });
  console.log("handler result:", JSON.stringify({ source, scanned, regime: d.market.regime, exp: d.totalTargetExposure, coins: d.rankedCoins.map(c=>c.symbol+":"+c.direction) }));
  process.exit(0);
})();
