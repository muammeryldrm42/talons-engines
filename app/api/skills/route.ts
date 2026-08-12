// GET /api/skills — the strategy-skill library, each run live on the current
// CMC snapshot. Returns metadata (rules, inputs) + the current signal per skill.
import { NextResponse } from "next/server";
import { buildInputs } from "@/lib/cmc/signals";
import { runSkills } from "@/lib/skills";

export const dynamic = "force-dynamic";

export async function GET() {
  const { market, coins, globals, source, hubEnriched } = await buildInputs({ scanLimit: 200 });
  const skills = runSkills({ market, coins, globals });
  const tech = (sym: string) => {
    const c = coins.find((x) => x.symbol === sym);
    return c ? { rsi: c.rsi ?? null, macd: c.macdHistogram ?? null } : { rsi: null, macd: null };
  };
  const technicals = { BTC: tech("BTC"), ETH: tech("ETH") };
  const funding = market.aggFundingRate ?? null;
  return NextResponse.json({ source, hubEnriched, technicals, funding, skills });
}
