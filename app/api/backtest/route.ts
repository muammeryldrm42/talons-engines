// GET /api/backtest?days=130 — historical backtest-lite on CMC historical data.

import { NextResponse } from "next/server";
import { runBacktest } from "@/lib/backtest";

export const revalidate = 3600; // 1h — historical data moves slowly

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(Math.max(Number(searchParams.get("days")) || 1460, 40), 1500);
  const forceMock = searchParams.get("synthetic") === "1" || searchParams.get("mock") === "1";
  const result = await runBacktest(days, forceMock);
  return NextResponse.json(result);
}
