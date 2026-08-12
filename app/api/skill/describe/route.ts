// GET /api/skill/describe — find_skill-style descriptor for the CMC Skills Marketplace.
// An agent calls this to discover what the skill does, how to invoke it, and the output shape.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const base = new URL(req.url).origin;
  return NextResponse.json({
    id: "talons-regime-engine",
    name: "Talons Regime Engine",
    description:
      "Regime-adaptive crypto strategy skill. Classifies the market into one of five regimes (alt-season risk-on, BTC-led risk-on, chop, risk-off, capitulation) from CMC signals and CMC Agent Hub data, then issues BTC/ETH BUY/SELL/HOLD calls with a risk budget, net exposure, and plain-English rationale. Backtestable spec, not a live agent.",
    category: "strategy",
    track: "CMC Strategy Skills",
    tags: ["regime", "momentum", "risk-management", "btc", "eth", "backtestable", "fear-greed", "derivatives"],
    capabilities: ["cmc-data-api", "cmc-agent-hub-mcp"],
    composableSkills: 24,
    invocation: {
      method: "GET",
      url: `${base}/api/skill`,
      auth: "none",
      formats: ["json", "md", "yaml"],
      formatParam: "?format=md | ?format=yaml (compact, timestamped agent-ready output)",
      x402: `${base}/api/x402/skill`,
      describe: `${base}/api/skill/describe`,
    },
    input: { type: "none", note: "reads live CMC market data + Agent Hub server-side; no parameters required" },
    output: {
      skill: "string", version: "string", asOf: "ISO-8601 string",
      dataSource: "'cmc' | 'mock'", agentHubLive: "boolean",
      regime: { key: "string", name: "string", meaning: "string", confidence: "0..1", riskBudget: "0..1", universe: "string", directionBias: "string" },
      riskPosture: "{ label: 'Favorable'|'Mixed'|'Defensive'|'Contrarian', note: string }",
      marketState: "'strong' | 'conflicted' | 'weak' | 'washout'",
      signals: "[{ symbol, action: 'BUY'|'SELL'|'HOLD', direction, targetWeight, score, reason }]",
      confirmingSignals: "string[] — signals that confirm the current regime view",
      invalidation: "string[] — concrete conditions that would flip the thesis",
      inputs: "{ fearGreed, btcDominance, altseasonIndex, btcReturn7d, btcReturn30d, aggFundingRate, openInterestChange }",
      netExposure: "0..1", dataFreshness: "{ asOf, source, agentHubLive }", rationale: "string", capabilities: "string[]",
    },
    example: {
      skill: "talons-regime-engine", version: "1.1",
      regime: { key: "BTC_LED_RISK_ON", name: "BTC-Led Risk-On", confidence: 0.78, riskBudget: 0.8 },
      riskPosture: { label: "Favorable" }, marketState: "strong",
      signals: [{ symbol: "BTC", action: "BUY", direction: "LONG", targetWeight: 0.6, score: 72 }],
      invalidation: ["Fear & Greed dropping below 30", "BTC 7d return turning below -8%"],
      netExposure: 0.78,
    },
  });
}
