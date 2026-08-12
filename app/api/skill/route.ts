// GET /api/skill — invoke the Talons Regime Engine Skill.
// Returns the canonical, agent-ready DECISION FRAMEWORK (regime + risk posture +
// market state + BTC/ETH actions + confirming signals + invalidation + rationale).
// ?format=md|yaml -> compact, timestamped agent-ready output (less token bloat).
// Skills-Marketplace ready: stable schema, no auth. Describe at /api/skill/describe.
import { NextResponse } from "next/server";
import { runAgentSkill, toMarkdown, toYaml } from "@/lib/agentSkill";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const fmt = (new URL(req.url).searchParams.get("format") || "json").toLowerCase();
  const out = await runAgentSkill();
  if (fmt === "md" || fmt === "markdown")
    return new NextResponse(toMarkdown(out), { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
  if (fmt === "yaml" || fmt === "yml")
    return new NextResponse(toYaml(out), { headers: { "Content-Type": "text/yaml; charset=utf-8" } });
  return NextResponse.json(out);
}
