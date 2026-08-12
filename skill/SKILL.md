---
name: talons-regime-engine
description: Regime-adaptive crypto trading-strategy skill. Reads the market regime from CoinMarketCap signals (Fear & Greed, Altcoin Season, BTC Dominance, derivatives positioning), then ranks assets with regime-dependent weights and explicit entry/exit rules. Use when an agent needs a directional, position-sized crypto strategy decision grounded in market-wide context rather than a single-chart indicator read. Produces a backtestable specification with a natural-language rationale.
---

# Talons Regime Engine — CMC Strategy Skill

*BNB HACK: AI Trading Agent Edition — Track 2 (Strategy Skills)*
*Deliverable: backtestable strategy specification, written as an LLM skill. Not a live trading agent.*

## Invoking this skill

The skill is a pure, deterministic function — `evaluate(input)` in `lib/skill.ts` — that maps one market snapshot to a decision. This makes it agent-callable and fully replayable on any historical date.

- **As an LLM/agent tool:** read `skill/manifest.json` for the input/output JSON schema and `when_to_use`. An agent gathers the CMC signals (Agent Hub or Data API), calls `evaluate`, and reads back the `decision` + `rationale`.
- **As a CMC Agent Hub skill:** the `data_dependencies` in the manifest map each input to its CMC endpoint/tool; wrap `evaluate` behind `find_skill` routing or an MCP tool.
- **Over HTTP:** `GET /api/regime` (live decision; `?scan=all` full market, `?coin=SYM` single), `GET /api/skills` (24-skill library on BTC/ETH), `GET /api/agenthub-engine` (Hub-only engine: BTC/ETH signals + regime, every input from the Agent Hub), `GET /api/agenthub` (live MCP connection + tool list), `GET /api/ta` (real RSI/MACD via Agent Hub), `GET /api/backtest` (~4-year replay), `GET /api/prices`, `GET /api/sectors`, `GET /api/marketmap`. **Agent-ready / Skills Marketplace:** `GET /api/skill` (canonical agent decision), `GET /api/skill/describe` (find_skill descriptor), `GET /api/x402/skill` (x402 pay-per-call).

The Next.js app, dashboard, and backtest are all just consumers of this one entrypoint.

---

## 1. Thesis

Most retail strategies fail because they apply one fixed rule set across all market conditions. RSI mean-reversion prints in chop and gets steamrolled in trends; momentum prints in trends and whipsaws in chop. The edge here is **regime-conditioning**: read the market's macro posture first using CoinMarketCap's market-wide signals (which no single-chart TA can see), then pick the play and rank assets within that context.

**Read the room → pick the play → rank the names.**

## 2. Architecture (hybrid)

Two layers, top-down:

- **Layer A — Regime (market-wide):** one regime classification for the whole market per timestamp, derived from CMC-exclusive indices. Sets the *context*, eligible universe, direction bias, risk budget, and the signal-weight profile used downstream.
- **Layer B — Per-coin scoring (regime-aware):** every eligible coin is scored and ranked. Regime decides which signals matter and which coins are even in scope. Output is a ranked table, not a single call.

A market-wide **risk veto** sits above both and can force flat.

```
CMC market signals ──► [A] Regime classifier ──► regime + risk budget + weight profile + eligible universe
                                                          │
per-coin OHLCV/flow/funding ──► [B] Per-coin scorer (weights set by regime) ──► ranked coin table
                                                          │
derivatives / risk flags ──────────────────────► [Veto] ──► final decision
```

## 3. Data sources

| Signal | CMC source | History? | Layer |
|---|---|---|---|
| Fear & Greed | `/v3/fear-and-greed/historical` + Agent Hub `get_global_metrics_latest` | ✅ historical | A |
| BTC Dominance, total mcap | `/v1/global-metrics/quotes/historical` | ✅ historical | A |
| Altcoin Season Index | no direct historical endpoint → **reconstruct** from top-100 OHLCV (≥75% of top 100 beating BTC over 90d = alt season) | ✅ via reconstruction | A |
| Price OHLCV (per coin) | `/v2/cryptocurrency/ohlcv/historical` | ✅ historical | A + B |
| ETF net flows (BTC/ETH) | Agent Hub `get_global_metrics_latest` | ⚠️ latest only | A tilt / live |
| Funding, OI, liquidations (aggregate) | Agent Hub `get_global_crypto_derivatives_metrics` | ⚠️ latest only | Veto / live |
| Per-coin funding | CMC funding-rates data | ⚠️ latest only | B / live |
| RSI / MACD (per coin) | Agent Hub `get_crypto_technical_analysis` (`id`) for BTC/ETH, else computed from %-change proxy | ✅ live (Hub) | A + B |
| Exchange inflows/outflows | CMC exchange in/outflow data | ⚠️ mostly latest | B (sentiment divergence) |
| Trending narratives | Agent Hub `trending_crypto_narratives` | latest | B tilt (optional) |

**Backtest backbone = the historical-clean signals (F&G, dominance, reconstructed altseason, price).** This keeps the backtest honest on a free key, which has no historical OHLCV endpoint.

## 4. Layer A — Regime classifier

Two axes:
- **Risk appetite** = f(Fear & Greed, BTC trend vs 50/200 MA)
- **Leadership** = f(BTC Dominance trend, Altcoin Season Index)

Five regimes (thresholds are first-draft calibration parameters — see §9):

| Regime | F&G | Altseason | BTC Dominance | BTC trend | Play | Risk budget |
|---|---|---|---|---|---|---|
| **Alt Season Risk-On** | > 60 | > 75 | falling | up | alt/ETH momentum, trend-follow | 100% |
| **BTC-Led Risk-On** | > 55 | < 50 | rising | up | concentrate BTC, underweight alts | 80% |
| **Chop / Neutral** | 40–60 | 25–75 | flat | range | mean-reversion, cut size | 30% |
| **Risk-Off / Fear** | < 40 | < 40 | rising | down | defensive, contrarian + sentiment shorts | 20% |
| **Capitulation** | < 20 | any | spiking | sharp down | contrarian accumulation, scale in | 50% |

A confidence score (0–1) is emitted from how cleanly the inputs agree, so downstream sizing can scale with regime certainty.

**Agent-Hub context layer (live strengthening).** When the CMC Agent Hub is reachable, the regime is sharpened by Hub-native signals the REST tier cannot provide, all fed through `lib/cmc/hubEnrich.ts` into the classifier as *optional* inputs (pure no-op when absent, so the base engine never regresses):
- **Institutional ETF flows** (`get_global_metrics_latest`) — inflows confirming a risk-on regime raise conviction; outflows diverging from price flag distribution risk; inflows into weakness read as accumulation of the fear.
- **Whole-market technical posture** (`get_crypto_marketcap_technical_analysis`) — the total-market-cap RSI flags broad overbought (≥72, late-cycle caution in risk-on) or oversold (≤28, corroborates capitulation/risk-off).
- **Leverage & liquidation-cascade risk** (`get_global_crypto_derivatives_metrics`) — a flagged cascade tempers conviction and holds entries.
- **Real per-coin RSI/MACD** (`get_crypto_technical_analysis`, BTC/ETH) and **aggregate funding / OI** feed the per-coin scorer and the derivatives layer respectively.
- **CMC100 broad-market breadth** (`/v3/index/cmc100-historical`) — the 30-day trend of CoinMarketCap's top-100 index confirms or diverges from the regime: a rising index raises conviction in a risk-on call, a falling one tempers it and argues for caution. Optional and gated like the rest.

These adjust the regime's confidence (bounded) and reasons, so the conviction the dashboard shows reflects institutional demand and market-wide structure, not just sentiment and price.

**Optional extension — regime transitions:** detect state changes (e.g. Capitulation → Risk-Off) and trade the transition, not just the state.

## 5. Layer B — Per-coin scorer

For each coin in the regime's eligible universe, compute sub-signals, each normalized to [-100, +100] (short → long):

- **Momentum** — RSI/MACD trend + price vs MAs.
- **Mean-reversion** — RSI extremes (oversold → +, overbought → −).
- **Relative strength** — coin return vs BTC over lookback.
- **Per-coin flow** — exchange outflow → + (accumulation), inflow → − (distribution).
- **Per-coin funding** — extreme positive funding penalizes new longs (crowded), extreme negative supports contrarian longs.

**Market-wide tilts** (applied as multipliers to every coin's score):
- **ETF flow divergence** — z(5d net ETF flow) − z(5d BTC return). Flow strong + price flat → bullish tilt; outflows + price up → bearish tilt.
- **Sentiment divergence** — crowd leg (F&G / community sentiment) vs structure leg (aggregate exchange flow). Greedy + inflows → distribution warning (bearish tilt); fearful + outflows → bottom signal (bullish tilt).

### Regime-dependent weight profile

Per-coin composite = Σ (sub-signal × weight), where the weight profile is set by the regime:

| Sub-signal | AltRiskOn | BTCRiskOn | Chop | RiskOff | Capitulation |
|---|---|---|---|---|---|
| Momentum | high | high | low | low | low |
| Mean-reversion | low | low | high | mid | mid |
| Relative strength | high | mid | low | low | low |
| Per-coin flow | mid | mid | mid | high | high |
| Per-coin funding | mid | mid | mid | high | **high** |
| ETF divergence (tilt) | mid | mid | mid | high | **highest** |
| Sentiment divergence (tilt) | mid | low | mid | high | high |

**Eligibility filter by regime:** AltRiskOn → top-N alts + ETH; BTCRiskOn → BTC + a few large caps; Chop → reduced set, high-liquidity only; RiskOff → BTC + ETH only; Capitulation → BTC + ETH (highest-conviction core).

**Full-market scan mode** (`?scan=all`): overrides the regime universe filter and scores the *entire liquid market* (up to 5000 coins from a single `listings/latest` call, filtered by a minimum-volume floor), returning a large ranked table. The regime still sets the weight profile, tilts, and risk budget — so the scan is regime-aware, not raw TA. This is the scanner half of the hybrid; the focused universe is the allocation half.

## 6. Risk veto (live layer)

- Aggregate funding sustained extreme positive → block new longs (overheated).
- Liquidation cascade flag → pause new entries (don't catch the knife).
- Agent Hub risk flag → hard flat.

## 7. Skill output schema

```json
{
  "as_of": "2026-06-07T00:00:00Z",
  "market": {
    "regime": "Capitulation",
    "regime_confidence": 0.82,
    "fear_greed": 14,
    "altseason_index": 22,
    "btc_dominance": 58.4,
    "market_tilt": { "etf_divergence": +0.7, "sentiment_divergence": +0.55 },
    "risk_flags": []
  },
  "ranked_coins": [
    {
      "rank": 1, "symbol": "BTC", "score": +48, "direction": "LONG",
      "target_weight": 0.34,
      "signals": { "momentum": -40, "mean_reversion": +25, "rel_strength": 0,
                   "flow": +60, "funding": +30 },
      "rationale": "Extreme fear with accelerating ETF inflows and exchange outflows — institutional accumulation diverging from retail panic. Momentum negative but down-weighted in capitulation regime."
    },
    { "rank": 2, "symbol": "ETH", "score": +31, "direction": "LONG", "target_weight": 0.16, "...": "..." }
  ],
  "total_target_exposure": 0.50
}
```

The `rationale` field is what makes this an **LLM skill** rather than a script — it can be Claude-generated each cycle to explain the decision in plain language.

## 7b. Composable skill library (24 skills, `lib/skills.ts`, `/api/skills`)

Beyond the single composed `evaluate()`, the strategy is decomposed into **24 small, independent skills**. Each is a pure function with explicit entry/exit rules, evaluated live on **BTC and ETH**, returning a **BUY / SELL / NEUTRAL** verdict per coin with a one-line reason. Any one can be called on its own; the engine composes them. They are listed individually in `skill/manifest.json` (`skills[]`, each with `targets: ["BTC","ETH"]`).

- **Price & momentum:** Momentum (RSI·MACD·F&G), Trend Alignment, Momentum Cross (7d vs 30d), Momentum Acceleration (2nd-order pace), Trend Quality (consistency-weighted), Momentum Divergence (24h vs 7d early turns), Volatility Breakout.
- **Mean reversion & reversals:** Mean Reversion (RSI extremes), Dip Buyer (drawdown recovery), Capitulation / Euphoria Reversal (sentiment-extreme turning points), Capitulation Volume (volume-spike flush vs blow-off).
- **Volume & liquidity:** Volume / Turnover, Volume-Confirmed Trend, Liquidity Health (turnover-quality gate).
- **Sentiment & internals:** Fear & Greed Contrarian, Sentiment Divergence, Breadth Rotation.
- **Regime & rotation:** Regime Detection, Dominance Rotation (BTC↔ETH), ETH/BTC Relative Strength, Altcoin Season Gate, Flight to Majors.
- **Capital positioning:** Dry Powder (stablecoin supply), Drawdown Guard (capital-preservation filter on deep multi-timeframe drawdowns).

Each verdict carries the coin's CMC slug so the UI links straight to the CoinMarketCap page.


## 7c. Data source: CoinMarketCap AI Agent Hub (MCP)

The engine integrates the **CMC Agent Hub** — CoinMarketCap's agent-native MCP stack (`https://mcp.coinmarketcap.com/mcp`, auth header `X-CMC-MCP-API-KEY`, the standard CMC key). The client (`lib/cmc/agentHub.ts`) is a dependency-free JSON-RPC-over-HTTP implementation (handles both JSON and SSE) that runs `initialize` -> `tools/list` -> `tools/call`, discovering CMC's **12 decision-ready tools** at runtime: `get_crypto_quotes_latest`, `get_crypto_technical_analysis`, `get_crypto_marketcap_technical_analysis`, `get_global_metrics_latest`, `get_global_crypto_derivatives_metrics`, `get_crypto_metrics`, `trending_crypto_narratives`, `get_upcoming_macro_events`, `get_crypto_latest_news`, `search_cryptos`, `search_crypto_info`, `get_crypto_info`. `GET /api/agenthub` exposes the live connection and the discovered tool list with input schemas.

**The Hub is wired into the engine core, not just displayed.** `lib/cmc/hubEnrich.ts` pulls, best-effort, real **RSI + MACD** for BTC & ETH (`get_crypto_technical_analysis`, `id` = "1" / "1027") and real **funding / open interest** (`get_global_crypto_derivatives_metrics`), and feeds them into the skill library and the regime classifier — replacing the %-change proxies the free REST tier forces. When the Hub is live, the Skills tab surfaces the actual Hub RSI/MACD/funding feeding the 24 skills.

**Dedicated Agent-Hub engine** (`GET /api/agenthub-engine`, the *CMC Agent Hub* tab in the UI): a decision board where **every input comes from the Agent Hub** and nothing from REST. BTC & ETH BUY / SELL / NEUTRAL calls are computed purely from Hub technicals (RSI, MACD, SMA/EMA) plus the latest Hub quote; the regime is classified from Hub global metrics (Fear & Greed, alt-season, dominance) plus Hub derivatives; alongside Hub-sourced ETF demand, market leverage, BTC liquidations, total-market-cap technical analysis, and on-chain holder structure. This board is Hub-only and never falls back to mock decisions (it reports `unavailable` without a key).

A keyless **x402** pay-per-request path (`/x402/mcp`, USDC on Base) is also supported. The Agent Hub is a first-class data path, with the REST layer and a deterministic mock as graceful fallbacks so the demo never hard-fails.


## 7d. Skills Marketplace & x402 (agent-native distribution)

The skill is packaged to drop straight into the **CMC Skills Marketplace** pattern (smart routing / `find_skill` / agent-ready output):

- **Discover** — `GET /api/skill/describe` returns a `find_skill`-style descriptor: id, description, category (`strategy`), tags, capabilities (`cmc-data-api`, `cmc-agent-hub-mcp`), the invocation contract, and the full output schema with an example. An agent can route to this skill from a natural-language goal and know exactly how to call it.
- **Invoke** — `GET /api/skill` returns the canonical **agent-ready decision framework**: `{ regime, riskPosture{label,note}, marketState (strong/conflicted/weak/washout), signals[BTC/ETH {action,targetWeight,score,reason}], confirmingSignals[], invalidation[] (concrete conditions that flip the thesis), netExposure, inputs, dataFreshness, rationale }`. This is the verifiable *decision framework* shape CMC for Agent recommends — it answers "is this a risk day, is the market strong/weak/conflicted, what confirms the view, and what would invalidate it." Add `?format=md` or `?format=yaml` for **compact, timestamped** agent-ready output that cuts JSON bloat and hallucination risk. Stable shape, no auth, no dashboard noise.
- **Pay-per-call (x402)** — `GET /api/x402/skill` implements the x402 handshake: with no `X-PAYMENT` header it returns **HTTP 402** + an `accepts` block (scheme `exact`, network `base`, asset USDC `0x8335…2913`, price, `maxTimeoutSeconds`); with a payment header it returns the decision (`paid:true`). This is a faithful reference implementation of the protocol shape — production settlement requires an x402 facilitator to verify the on-chain payment before serving the resource (called out honestly in the response).

## 8. Backtest (implemented: `/api/backtest`, `lib/backtest.ts`)

A historical backtest-lite runs the **real engine** across a **~4-year window (1460 days)**, proving the regime-switching adds risk-adjusted value. On a free CMC key (no historical OHLCV endpoint) the series is **synthetic and clearly labeled** in the UI; the dashboard always shows the true day count of the replay.

- **Signals:** the historical-clean CMC stack only — Fear & Greed (`/v3/fear-and-greed/historical`), BTC Dominance (`/v1/global-metrics/quotes/historical`), and price (`/v2/cryptocurrency/ohlcv/historical`). ETF-flow / funding tilts are live-only and absent here (degrade to 0). Altcoin Season Index is approximated from ETH-vs-BTC relative strength (no top-100 history). Stated openly.
- **Universe:** BTC + ETH (the historical-clean core).
- **Frequency:** daily rebalance. **Costs:** 10 bps × turnover.
- **Benchmarks (the ablation):** regime strategy vs BTC buy & hold vs fixed 60/40 (no switching) — three lines on one chart. The fixed/buy&hold lines *are* the regime-off ablation: the marginal value of switching is the gap.
- **Metrics:** total return, Sharpe (annualized), max drawdown, win rate (active days).

Typical shape: the engine captures upside while sidestepping crashes (it flattens in capitulation/chop), producing a **higher Sharpe and far smaller max drawdown** than buy & hold even when buy & hold's raw return is higher — the risk-adjusted edge.


## 9. Open calibration parameters

To tune on historical data (this tuning *is* the quant work), all centralized in `lib/engine/weights.ts` and `lib/engine/regime.ts`:
- Regime thresholds (F&G cutpoints, altseason cutpoints, dominance trend window, MA periods).
- Sub-signal lookbacks (RSI/MACD periods, flow z-score baseline, divergence lookback).
- Weight profile magnitudes per regime.
- Top-N, entry/exit score thresholds, veto trigger levels.

## 10. Build status

1. ✅ Regime classifier (priority logic, 5 regimes, confidence).
2. ✅ Per-coin scorer with regime-dependent weights + availability-weighted normalization.
3. ✅ CMC data layer (latest + historical + listings up to 5000 + OHLCV RSI enrichment), with deterministic mock fallback.
4. ✅ Backtest-lite (historical, synthetic on free key).
5. ✅ Composable 24-skill library (BTC/ETH, BUY/SELL/NEUTRAL with reasons) + skill wrapper: structured output + natural-language rationale (LLM-swappable).
6. ⏳ Calibration of thresholds/weights on real history (ongoing quant work).
7. ⏳ Wire OHLCV/derivatives historical for a true dominance slope + funding history.

## 11. Additional capabilities

- **Full-market scanner** (`?scan=all`) — score the entire liquid market (up to 5000 coins), regime-aware, with JSON export.
- **Alerts** — webhook on regime shift or high-conviction signal; Telegram-compatible (`ALERT_WEBHOOK_URL` / `ALERT_CHAT_ID`).
- **RSI / MACD enrichment** — two-pass: rank the market on listing proxies, then enrich the top candidates with RSI and MACD from OHLCV (bounded calls).
- **Confidence-weighted sizing** — exposure scales with regime confidence, so low-conviction regimes carry a smaller book.
- **Graceful degradation** — keyless trial API and a deterministic mock so the app never hard-fails; signals unavailable on a Basic key drop out of the weight sum rather than zeroing the decision.
- **Agent-consumable output** — a single `evaluate()` entrypoint and JSON endpoint, ready to be wrapped as an MCP tool or CMC Agent Hub skill.
