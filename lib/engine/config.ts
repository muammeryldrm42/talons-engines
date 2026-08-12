// Central calibration parameters. Everything tunable lives here so the quant
// work (fitting thresholds/coefficients on real history) happens in one place.

export const REGIME_THRESHOLDS = {
  fgHigh: 60,
  fgMidHigh: 55,
  fgLow: 40,
  fgExtremeLow: 20,
  altSeasonHi: 65,
  altSeasonLo: 50,
  domTrendUp: 0.5, // pct-points over the lookback window
  domTrendDown: -0.5,
  btcTrendUp: 2, // 7d % return
  btcTrendDown: -2,
  btcSharpDown: -10, // 7d % for capitulation
  domTrendWindow: 7, // days
};

export const DERIVATIVES = {
  fundingHot: 0.0005, // per 8h — crowded longs
  fundingWashout: -0.0003, // per 8h — leverage flush
  fundingShortCrowd: -0.0002,
  oiCollapse: -10, // % 24h OI change
};

export const SCORER = {
  momentum7d: 2.5,
  momentum30d: 0.8,
  macdWeight: 25, // contribution of MACD histogram sign
  macdBlend: 0.7, // how much price-trend momentum is kept when MACD present
  meanReversionRsi: 2, // (50 - rsi) * this
  meanReversion24h: 5, // -pctChange24h * this (RSI fallback)
  relStrength: 3,
  fundingScale: 5000,
  tiltScale: 8, // tilt * regimeWeight * this
  // trend participation: in non-defensive regimes, a blended trend beyond this %
  // sets a conviction floor so momentum isn't cancelled by mean-reversion.
  trendFloorPct: 3,
  trendParticipation: 1.6,
};

export const SIZING = {
  entryThreshold: 20, // open a position above |score|
  exitThreshold: 8, // hold until |score| fades below this (hysteresis)
  minVolumeFullScan: 1e6, // eligibility floor in full-scan mode
  fullScanTopN: 50,
};

export const VETO = {
  fundingOverheat: 0.0008, // sustained → block new longs
};

// Stablecoins + pegged/wrapped assets to exclude from scoring and scans.
export const STABLES = new Set([
  "USDT", "USDC", "DAI", "FDUSD", "USDE", "USDS", "PYUSD", "USDD", "TUSD",
  "GUSD", "FRAX", "LUSD", "USDP", "EURT", "EURS", "EURC", "USTC", "BUSD",
  "USD1", "USDG", "RLUSD", "USD0", "USDX", "USDB", "USDY", "GHO", "CRVUSD",
  "MIM", "DOLA", "U", "AEUR", "EURI", "USDL",
  "WBTC", "WETH", "WEETH", "WSTETH", "STETH", "WBETH", "CBBTC", "CBETH",
]);

/** True if a symbol/name is a stablecoin or pegged/wrapped asset (excluded from scans). */
export function isStable(symbol: string, name = ""): boolean {
  const s = symbol.toUpperCase();
  if (STABLES.has(s)) return true;
  // any ticker carrying a USD/EUR peg marker
  if (/USD|EUR|^DAI$/.test(s)) return true;
  // name-based peg markers ("Ripple USD", "Euro Coin", "Global Dollar", ...)
  if (/\b(usd|dollar|euro|stablecoin|pegged)\b/i.test(name)) return true;
  return false;
}


