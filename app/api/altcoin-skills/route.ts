// GET /api/altcoin-skills — run the Agent-Hub-powered altcoin skills over a live
// altcoin set and return each skill's current picks. Honest fallback when the
// listings/Agent Hub aren't reachable.
import { NextResponse } from "next/server";
import { scanAltcoins } from "@/lib/cmc/altcoinScan";
import { ALTCOIN_SKILLS } from "@/lib/altcoinSkills";

export const revalidate = 300;

export async function GET() {
  const scan = await scanAltcoins(8);
  const skills = ALTCOIN_SKILLS.map((sk) => {
    const picks = scan.coins
      .map((c) => ({ symbol: c.symbol, ...sk.evaluate(c) }))
      .filter((v) => v.signal !== "NEUTRAL")
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
    return { id: sk.id, name: sk.name, summary: sk.summary, hub: sk.hub, inputs: sk.inputs, picks };
  });

  // coin-centric aggregation: strongest altcoin setups by BUY-signal consensus
  const setups = scan.coins.map((c) => {
    const verdicts = ALTCOIN_SKILLS.map((sk) => ({ skill: sk.name, ...sk.evaluate(c) }));
    const buy = verdicts.filter((v) => v.signal === "BUY");
    const sell = verdicts.filter((v) => v.signal === "SELL");
    return {
      symbol: c.symbol, buy: buy.length, sell: sell.length, net: buy.length - sell.length,
      pctChange7d: c.pctChange7d,
      reasons: buy.sort((a, b) => b.score - a.score).slice(0, 3).map((v) => v.skill),
    };
  }).sort((a, b) => b.net - a.net || b.buy - a.buy);

  return NextResponse.json({ source: scan.source, hubEnriched: scan.hubEnriched, coinsScanned: scan.coins.length, coins: scan.coins.map((c) => c.symbol), asOf: scan.asOf, setups, skills });
}
