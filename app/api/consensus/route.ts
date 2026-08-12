// GET /api/consensus — how many of the 24 ETH/BTC skills agree, per coin.
import { NextResponse } from "next/server";
import { buildInputs } from "@/lib/cmc/signals";
import { runSkills } from "@/lib/skills";

export const revalidate = 120;

export async function GET() {
  const { market, coins, globals, source, hubEnriched } = await buildInputs({ scanLimit: 200 });
  const verdicts = runSkills({ market, coins, globals });
  const tally = (sym: string) => {
    const vs = verdicts.filter((v: any) => v.symbol === sym);
    const buy = vs.filter((v: any) => v.signal === "BUY").length;
    const sell = vs.filter((v: any) => v.signal === "SELL").length;
    const neutral = vs.filter((v: any) => v.signal === "NEUTRAL").length;
    const total = vs.length || 1;
    const net = Math.round(((buy - sell) / total) * 100);
    return { buy, sell, neutral, total: vs.length, net, lean: net > 12 ? "BUY" : net < -12 ? "SELL" : "NEUTRAL" };
  };
  return NextResponse.json({ source, hubEnriched, BTC: tally("BTC"), ETH: tally("ETH") });
}
