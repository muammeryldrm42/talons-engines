// GET /api/skill-backtest — backtest each of the 24 skills as a long-only BTC spot strategy.
// ?synthetic=1 forces the synthetic 4-year series; otherwise tries live CMC history.
import { NextResponse } from "next/server";
import { runSkillBacktest } from "@/lib/skillBacktest";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(Math.max(Number(searchParams.get("days")) || 1460, 60), 1500);
  const forceMock = searchParams.get("synthetic") === "1";
  return NextResponse.json(await runSkillBacktest(days, forceMock));
}
