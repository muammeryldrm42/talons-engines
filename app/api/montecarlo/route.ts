// GET /api/montecarlo — Monte Carlo robustness across N regime-switching market paths.
// Runs the real engine on every path and returns the distribution of outcomes.
import { NextResponse } from "next/server";
import { runMonteCarlo } from "@/lib/montecarlo";

export const revalidate = 86400; // 1 day — robustness stat, deterministic seeds
export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const paths = Math.min(Math.max(Number(searchParams.get("paths")) || 500, 50), 1000);
  const days = Math.min(Math.max(Number(searchParams.get("days")) || 365, 90), 730);
  return NextResponse.json(runMonteCarlo(paths, days));
}
