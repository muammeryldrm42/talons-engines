export default function AboutSkill() {
  return (
    <details className="about">
      <summary>How this skill works</summary>
      <div className="about-body">
        <p>
          A regime-adaptive crypto strategy skill. It reads the market&apos;s posture from
          CoinMarketCap&apos;s market-wide signals, then ranks assets through that lens — instead
          of applying one fixed rule set in every market.
        </p>
        <ol>
          <li>
            <b>Regime layer (market-wide).</b> Fear &amp; Greed, Altcoin Season, BTC Dominance trend,
            BTC trend, and derivatives positioning (funding / open interest) classify the market into
            one of five regimes: Alt Risk-On, BTC Risk-On, Chop, Risk-Off, Capitulation. This sets the
            eligible universe, risk budget, and which signals to trust.
          </li>
          <li>
            <b>Per-coin scorer (regime-aware).</b> Each coin is scored on momentum (price + MACD),
            mean-reversion (RSI), relative strength, exchange flow, and funding — with weights set by
            the regime — then nudged by market-wide ETF-flow and sentiment divergence. Entry/exit uses
            hysteresis to cut churn.
          </li>
          <li>
            <b>Risk veto.</b> Overheated funding, liquidation cascades, or risk flags can block new
            longs or force flat.
          </li>
          <li>
            <b>CMC Agent Hub context (live).</b> When the Agent Hub is reachable, the regime is
            sharpened by Hub-native data that the REST tier can&apos;t give: real RSI/MACD for BTC &amp;
            ETH feed the per-coin signals; aggregate funding and open interest feed the derivatives
            layer; institutional <b>ETF flows</b> confirm or diverge from price; the whole market&apos;s
            technical posture (<b>total-market-cap RSI</b>) flags broad overbought/oversold; and
            leverage / liquidation risk tempers conviction. Each input is optional and degrades to a
            no-op when the Hub is offline, so the base engine never breaks.
          </li>
        </ol>
        <p>
          Output is a ranked, position-sized decision with a plain-language rationale — backtestable
          (walk-forward) and replayable. It is exposed as a pure function, an HTTP endpoint, and an MCP
          tool. Data: CoinMarketCap.
        </p>
        <p>
          <b>For agents.</b> The skill is Skills-Marketplace ready: discover it via{" "}
          <code>GET /api/skill/describe</code> (a find_skill-style descriptor), invoke it via{" "}
          <code>GET /api/skill</code> for an agent-ready <b>decision framework</b> (risk posture,
          market state, confirming signals, and the conditions that would <b>invalidate</b> the
          thesis) — add <code>?format=md</code> or <code>?format=yaml</code> for compact, timestamped
          output — or pay-per-call via <code>GET /api/x402/skill</code> (x402 handshake, USDC on Base).
        </p>
      </div>
    </details>
  );
}
