import type { EngineDecision } from "@/lib/engine/types";
import { REGIME_COLOR } from "./RegimeTimeline";
import { regimePlain } from "@/lib/labels";
import { cmcUrl } from "@/lib/cmcLink";

export default function TodaysCall({ d }: { d: EngineDecision & { hubEnriched?: boolean } }) {
  const m = d.market;
  const color = REGIME_COLOR[m.regime] ?? "var(--green)";
  const plain = regimePlain(m.regime);
  // Headline call focuses on BTC & ETH only — altcoin picks are intentionally
  // not surfaced here. Exposure/cash are recomputed from the shown majors.
  const calls = d.rankedCoins.filter((c) => (c.symbol === "BTC" || c.symbol === "ETH") && c.targetWeight > 0 && c.direction !== "FLAT").slice(0, 2);
  const exposure = Math.round(calls.reduce((a, c) => a + c.targetWeight, 0) * 100);

  return (
    <section className="hero" style={{ borderColor: color }}>
      <div className="hero-eyebrow">
        Today&apos;s Call · live read of the market
        {d.hubEnriched && <span className="src live" style={{ marginLeft: 8, fontSize: 10 }}>● powered by Agent Hub</span>}
      </div>
      <div className="hero-regime" style={{ color }}>
        {plain.name}
        <span className="hero-conf">{(m.regimeConfidence * 100).toFixed(0)}% confidence</span>
        {m.regimeShift && <span className="hero-shift">↺ just changed</span>}
      </div>
      <div className="hero-meaning">{plain.meaning}</div>

      <div className="hero-thesis"><b>What to do:</b> {m.playbook.directionBias}</div>

      {calls.length > 0 ? (
        <div className="hero-calls">
          {calls.map((c) => (
            <a key={c.symbol} className={`call-chip ${c.direction}`} href={cmcUrl(c.symbol, c.slug)} target="_blank" rel="noopener noreferrer" title={`${c.symbol} on CoinMarketCap`} style={{ textDecoration: "none" }}>
              <b>{c.symbol}</b> {c.direction === "LONG" ? "buy" : c.direction === "SHORT" ? "sell" : "hold"}
              <i>{Math.round(c.targetWeight * 100)}%</i>
            </a>
          ))}
          <span className="call-cash">cash {100 - exposure}%</span>
        </div>
      ) : (
        <div className="hero-calls"><span className="call-cash">Stay in cash — nothing clears the conviction bar right now</span></div>
      )}

      <div className="hero-foot">
        net exposure {exposure}% · risk budget {Math.round(m.playbook.riskBudget * 100)}% · focus: {m.playbook.universe}
      </div>
    </section>
  );
}
