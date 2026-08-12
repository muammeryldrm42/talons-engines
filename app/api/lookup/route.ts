import { NextResponse } from "next/server";
import { coinLookup } from "@/lib/cmc/agentHubData";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ ok: false, note: "provide ?q=<ticker>" });
  return NextResponse.json(await coinLookup(q));
}
