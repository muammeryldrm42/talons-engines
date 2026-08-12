import type { Globals } from "@/lib/cmc/signals";

function Metric({ k, v, sub, tone }: { k: string; v: string; sub?: string; tone?: string }) {
  return (
    <div className="metric">
      <div className="k">{k}</div>
      <div className="v" style={{ fontSize: 18, color: tone }}>{v}</div>
      {sub && <div style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function BreadthBar({ adv, dec, label }: { adv: number; dec: number; label: string }) {
  const total = Math.max(1, adv + dec);
  const advPct = (adv / total) * 100;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 5 }}>
        <span style={{ color: "var(--green)" }}>{adv} up</span>
        <span style={{ color: "var(--ink-faint)" }}>{label}</span>
        <span style={{ color: "var(--red)" }}>{dec} down</span>
      </div>
      <div style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden", background: "#161c23" }}>
        <div style={{ width: `${advPct}%`, background: "var(--green)" }} />
        <div style={{ width: `${100 - advPct}%`, background: "var(--red)" }} />
      </div>
    </div>
  );
}

export default function MarketInternals({ g, altseasonIndex }: { g: Globals; altseasonIndex: number }) {
  const b = g.breadth;
  const advShare = b.universe ? (b.advancers24h / b.universe) * 100 : 0;
  const stableShare = g.stablecoinMarketCap ? (g.stablecoinMarketCap / g.totalMarketCap) * 100 : null;
  const liq = g.totalMarketCap ? (g.totalVolume24h / g.totalMarketCap) * 100 : 0;

  const breadthRead =
    advShare >= 65 ? "broad strength — risk-on confirmed" :
    advShare <= 35 ? "broad weakness — risk-off confirmed" :
    "mixed — no clear breadth signal";

  return (
    <section className="panel">
      <div className="panel-title">Market Internals · breadth &amp; positioning · CoinMarketCap</div>

      <div className="k" style={{ marginBottom: 8 }}>
        Top {b.universe} breadth · {breadthRead}
      </div>
      <BreadthBar adv={b.advancers24h} dec={b.decliners24h} label="24h" />
      <BreadthBar adv={b.advancers7d} dec={b.decliners7d} label="7d" />

      <div className="metrics" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginTop: 16 }}>
        <Metric k="Avg 24h (top 100)" v={`${b.avgChange24h >= 0 ? "+" : ""}${b.avgChange24h}%`}
          tone={b.avgChange24h >= 0 ? "var(--green)" : "var(--red)"} />
        <Metric k="Altcoin Season" v={String(altseasonIndex)}
          sub={altseasonIndex > 65 ? "alts leading" : altseasonIndex < 35 ? "BTC leading" : "mixed"} />
        <Metric k="Stablecoin Dry Powder" v={stableShare == null ? "—" : `${stableShare.toFixed(1)}%`}
          sub={stableShare == null ? "n/a on this key" : stableShare > 9 ? "lots of sidelined cash" : "low sidelined cash"} />
        <Metric k="Liquidity (vol/cap)" v={`${liq.toFixed(1)}%`}
          sub={liq > 8 ? "active turnover" : "thin turnover"} />
      </div>

      <div className="coin-why" style={{ display: "block", marginTop: 14 }}>
        Breadth confirms or diverges from price: a rally on weak breadth (few coins up) is fragile;
        broad participation backs a risk-on regime. Dry powder is stablecoin capital sitting on the
        sidelines — fuel for the next leg.
      </div>
    </section>
  );
}
