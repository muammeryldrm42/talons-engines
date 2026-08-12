// GET /api/x402/skill — x402 pay-per-call wrapper around the skill.
// No X-PAYMENT header -> HTTP 402 with payment requirements (x402 handshake).
// With an X-PAYMENT header -> returns the skill decision (?format=md|yaml supported).
// Reference implementation of the x402 protocol shape; real settlement requires a
// facilitator to verify the on-chain payment. Honest demo, no funds move here.
import { NextResponse } from "next/server";
import { runAgentSkill, toMarkdown, toYaml } from "@/lib/agentSkill";

export const dynamic = "force-dynamic";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export async function GET(req: Request) {
  const payment = req.headers.get("X-PAYMENT") || req.headers.get("x-payment");
  const url = new URL(req.url);
  const resource = url.toString();

  if (!payment) {
    return NextResponse.json(
      {
        x402Version: 1,
        error: "Payment Required",
        accepts: [
          {
            scheme: "exact", network: "base", maxAmountRequired: "10000",
            resource, description: "One Talons Regime Engine decision framework",
            mimeType: "application/json", payTo: "0x0000000000000000000000000000000000000000",
            asset: USDC_BASE, maxTimeoutSeconds: 60,
          },
        ],
        note: "Reference x402 handshake. Replace payTo and wire a facilitator to verify settlement before returning the resource in production.",
      },
      { status: 402 },
    );
  }

  const out = await runAgentSkill();
  const fmt = (url.searchParams.get("format") || "json").toLowerCase();
  if (fmt === "md" || fmt === "markdown") return new NextResponse(toMarkdown(out), { headers: { "Content-Type": "text/markdown; charset=utf-8", "X-Payment-Status": "unverified-demo" } });
  if (fmt === "yaml" || fmt === "yml") return new NextResponse(toYaml(out), { headers: { "Content-Type": "text/yaml; charset=utf-8", "X-Payment-Status": "unverified-demo" } });
  return NextResponse.json({ paid: true, settlement: "unverified-demo", ...out });
}
