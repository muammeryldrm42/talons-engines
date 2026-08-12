// GET /api/regime — the live CMC Strategy Skill.
// Query params:
//   ?scan=all          scan the whole liquid market (else focused regime universe)
//   ?limit=500         how many coins to pull from CMC (up to 5000)
//   ?enrich=20         enrich top-N candidates with real RSI/MACD from OHLCV
//   ?coin=SOL          analyze a single ticker through the current regime lens
// Returns the current regime + ranked coins + rationale. Agent-consumable JSON.

import { NextResponse } from "next/server";
import { runEngine } from "@/lib/engine";
import { buildInputs, coinFromQuotes } from "@/lib/cmc/signals";
import { buildRationale, coinRationale } from "@/lib/rationale";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fullScan = searchParams.get("scan") === "all";
  const scanLimit = Math.min(Number(searchParams.get("limit")) || (fullScan ? 500 : 200), 5000);
  const enrichTop = Math.min(Number(searchParams.get("enrich")) || 0, 50);
  const topN = searchParams.get("topN") ? Number(searchParams.get("topN")) : undefined;
  const coinParam = searchParams.get("coin")?.trim().toUpperCase();

  const { market, coins, globals, source, scanned, hubEnriched } = await buildInputs({ scanLimit, enrichTop });
  const prevRegime = undefined;
  const btc = coins.find((c) => c.symbol === "BTC") ?? coins[0];

  // Single-coin analyze: score just the requested ticker through the current regime.
  if (coinParam) {
    let coin = coins.find((c) => c.symbol === coinParam);
    if (!coin) coin = (await coinFromQuotes(coinParam)) ?? undefined;
    if (!coin) {
      return NextResponse.json({ error: `Ticker not found: ${coinParam}`, source }, { status: 404 });
    }
    const decision = runEngine({
      asOf: new Date().toISOString(),
      market,
      coins: [coin, btc].filter((c, i, a) => a.findIndex((x) => x.symbol === c.symbol) === i),
      prevRegime,
      opts: { fullScan: true, minVolume: 0, topN: 5, confidenceScaling: true, includeFlat: true },
    });
    // keep only the requested ticker (BTC is present only as a relative-strength reference)
    decision.rankedCoins = decision.rankedCoins
      .filter((c) => c.symbol === coinParam)
      .map((c, i) => ({ ...c, rank: i + 1, rationale: coinRationale(c.symbol, c.signals) }));
    decision.totalTargetExposure = decision.rankedCoins.reduce((a, c) => a + c.targetWeight, 0);
    decision.rationale = buildRationale(decision);
    return NextResponse.json({ source, scanned, hubEnriched, mode: "single", query: coinParam, ...decision });
  }

  const decision = runEngine({
    asOf: new Date().toISOString(),
    market,
    coins,
    prevRegime,
    opts: {
      fullScan,
      topN: fullScan ? scanLimit : topN,
      includeFlat: fullScan, // a scan shows every coin with its read, not just signals
      confidenceScaling: true,
    },
  });

  decision.rationale = buildRationale(decision);
  decision.rankedCoins = decision.rankedCoins.map((c) => ({ ...c, rationale: coinRationale(c.symbol, c.signals) }));

  return NextResponse.json({ source, scanned, fullScan, hubEnriched, globals, ...decision });
}
