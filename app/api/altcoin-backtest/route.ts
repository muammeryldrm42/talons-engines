import { NextResponse } from "next/server";
import { runAltcoinBacktest } from "@/lib/altcoinBacktest";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(Math.max(Number(searchParams.get("days")) || 365, 60), 730);
  const forceMock = searchParams.get("synthetic") === "1";
  return NextResponse.json(await runAltcoinBacktest(days, forceMock));
}
