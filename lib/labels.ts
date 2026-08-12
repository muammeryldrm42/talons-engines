// Plain-English names + one-line meanings for each regime, so the dashboard
// reads clearly without trading jargon.
export const REGIME_PLAIN: Record<string, { name: string; meaning: string }> = {
  ALT_SEASON_RISK_ON: {
    name: "Altcoin Rally",
    meaning: "Risk-on market with altcoins outperforming Bitcoin.",
  },
  BTC_LED_RISK_ON: {
    name: "Bitcoin-Led Rally",
    meaning: "Risk-on market, but Bitcoin is leading and alts lag.",
  },
  CHOP: {
    name: "Choppy / Range-Bound",
    meaning: "No clear trend — the market is grinding sideways.",
  },
  RISK_OFF: {
    name: "Risk-Off / Defensive",
    meaning: "Capital is rotating out of crypto into safety.",
  },
  CAPITULATION: {
    name: "Capitulation (Max Fear)",
    meaning: "Panic selling and extreme fear — historically a bottoming zone.",
  },
};

export function regimePlain(regime: string) {
  return REGIME_PLAIN[regime] ?? { name: regime, meaning: "" };
}
