// Talons Regime Engine — shared types

export type RegimeName =
  | "ALT_SEASON_RISK_ON"
  | "BTC_LED_RISK_ON"
  | "CHOP"
  | "RISK_OFF"
  | "CAPITULATION";

export type Direction = "LONG" | "SHORT" | "FLAT";

/** Raw market-wide signals pulled from CoinMarketCap. */
export interface MarketSignals {
  fearGreed: number; // 0-100
  altseasonIndex: number; // 0-100 (reconstructed from top-100 vs BTC)
  btcDominance: number; // %
  btcDominanceTrend: number; // signed slope over window (pct points)
  btcReturn7d: number; // % — proxy for BTC trend
  btcReturn30d: number; // %
  // live-only / optional (may be absent on Basic key)
  etfNetFlowZ?: number; // z-score of 5d net ETF flow
  aggFundingRate?: number; // aggregate perp funding (per 8h, e.g. 0.01 = 1%)
  openInterestChange?: number; // 24h change in total OI (%), derivatives positioning
  marketRsi?: number; // total-market-cap RSI from Agent Hub (whole-market technical posture)
  marketLeverage?: number; // market leverage stat from Agent Hub (squeeze fragility)
  liquidationCascade?: boolean;
  riskFlag?: boolean;
  cmc100Trend?: number; // CMC100 index 30d % change — broad-market breadth confirmation
}

/** Per-coin raw inputs (from listings/latest + optional OHLCV/funding). */
export interface CoinInput {
  symbol: string;
  name: string;
  slug?: string;
  price?: number;
  marketCap: number;
  volume24h: number;
  pctChange24h: number;
  pctChange7d: number;
  pctChange30d: number;
  pctChange90d: number;
  // optional richer signals
  rsi?: number; // 0-100 if available
  macdHistogram?: number; // MACD histogram (signed) if available
  fundingRate?: number; // per-coin perp funding
  exchangeNetflow?: number; // +inflow / -outflow proxy
}

export interface RegimeResult {
  regime: RegimeName;
  confidence: number; // 0-1
  riskBudget: number; // 0-1 max gross exposure for this regime
  label: string; // human label
  reasons: string[]; // why this regime
}

export interface MarketTilts {
  etfDivergence: number; // [-1, +1] multiplier-ish tilt
  sentimentDivergence: number; // [-1, +1]
}

export interface CoinScore {
  rank: number;
  symbol: string;
  name: string;
  slug?: string;
  price?: number;
  change24h?: number;
  marketCap?: number;
  score: number; // [-100, +100]
  direction: Direction;
  targetWeight: number; // fraction of portfolio
  signals: {
    momentum: number;
    meanReversion: number;
    relStrength: number;
    flow: number;
    funding: number;
  };
  rationale?: string;
}

export interface EngineDecision {
  asOf: string; // ISO timestamp
  market: {
    regime: RegimeName;
    regimeLabel: string;
    regimeConfidence: number;
    regimeReasons: string[];
    regimeShift: boolean;
    prevRegime: string | null;
    fearGreed: number;
    altseasonIndex: number;
    btcDominance: number;
    tilts: MarketTilts;
    riskFlags: string[];
    // raw signals feeding the regime (for the dashboard)
    signals: {
      btcReturn7d: number;
      btcReturn30d: number;
      btcDominanceTrend: number;
      aggFundingRate: number | null;
      openInterestChange: number | null;
      liquidationCascade: boolean;
    };
    // what the strategy does in this regime
    playbook: {
      riskBudget: number;
      universe: string;
      directionBias: string;
      weights: { signal: string; weight: number; emphasis: "high" | "mid" | "low" }[];
    };
  };
  rankedCoins: CoinScore[];
  totalTargetExposure: number;
  rationale?: string;
}
