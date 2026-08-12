# Talons Regime Engine

**Read the market's regime. Pick the play. Rank the names.**

A regime-adaptive crypto **Strategy Skill** built entirely on CoinMarketCap data. It classifies the market into one of five regimes, hands you the right playbook for that regime, and runs a library of **24 strategy skills** that each give a plain-English **BUY / SELL / NEUTRAL** call on BTC and ETH — with the reasoning shown, not hidden.

Built for **BNB HACK: AI Trading Agent Edition — Track 2 (Strategy Skills)**.

🔗 **Live demo:** deployed on Vercel · **Repo:** github.com/muammeryldrm42/talons-engines

---

## The idea in one paragraph

Most strategies fail because they run the *same* logic in every market. Momentum that prints in a bull run gets chopped to pieces in a range; mean-reversion that works in a range gets run over by a trend. A good trader reads the *room* first, then picks the play. **Talons Regime Engine does exactly that, automatically** — and because it's a pure `evaluate(snapshot) → decision` function with a machine-readable manifest, an AI agent or MCP client can call it as a tool.

---

## For the judges — what makes this a Strategy Skill

- **A real, callable skill.** The core is a pure, deterministic function: `evaluate(snapshot) → decision` (`lib/skill.ts`). Same input, same output, no hidden state — fully replayable and testable. A manifest (`skill/manifest.json`) describes its inputs, outputs, and the 24 sub-skills so any agent router can discover and call it. It also runs its **own MCP server** at `POST /api/mcp` (Streamable HTTP) exposing the skill as a callable tool.
- **Built on the CMC Agent Hub.** The engine connects to CoinMarketCap's **AI Agent Hub over MCP** (`mcp.coinmarketcap.com/mcp`) and discovers its data tools at runtime via `tools/list` — the same agent-native stack the hackathon is built around — with the standard CMC REST layer and a deterministic mock as fallbacks. A keyless **x402** path is supported too. The Overview is **auto-enriched** with live derivatives metrics (funding / open interest), ETF flows and real RSI/MACD pulled from the Hub and fed into the engine — data the raw REST layer on a free key doesn't expose. An independent Hub-only regime read is at `GET /api/agenthub-engine`. `GET /api/agenthub` exposes the raw connection + discovered tools.
- **Skills-Marketplace ready, agent-native output.** The skill exposes a clean, stable, agent-ready decision at `GET /api/skill` and a `find_skill`-style descriptor at `GET /api/skill/describe` (no auth) — so an agent can discover it, understand its I/O, and invoke it directly. A working **x402** pay-per-call wrapper (`GET /api/x402/skill`, USDC on Base) demonstrates the agent-native pay-per-request handshake. The skill also runs its **own MCP server** at `POST /api/mcp` (Streamable HTTP) — point any MCP client (Claude, MCP Inspector, the CMC "Connect MCP" flow) at it and call any of its **9 tools** (get_strategy_decision, describe_strategy, scan_altcoins, get_narrative_rotation, get_macro_events, coin_lookup, skill_consensus, skill_backtest, altcoin_backtest).
- **Composable, not monolithic.** The strategy isn't one black box. It's **24 small, independent skills** — each its own pure function with explicit entry/exit rules — that the engine *composes*. You can read, test, or call any single skill on its own.
- **Regime-adaptive.** The same coin is scored differently depending on the market regime. The engine detects the regime, then applies a regime-specific risk budget, universe, bias, and signal weights.
- **Honest about its data.** It runs on **any CoinMarketCap key** and degrades gracefully without one. Where a data source is unavailable on a given plan, the README and the UI say so plainly — no faked data, no overstated backtest. (Details below.)
- **Explainable.** Every skill returns a one-line reason. The engine produces a plain-English rationale. Nothing is a mystery number.

## For users — what you actually get

- A dashboard that tells you, right now: **what regime we're in**, what the **play** is (how much risk, which assets, which direction), and **what 20 different strategies independently say about BTC and ETH**.
- A **live BTC vs ETH price chart**, a **sector-rotation** view, market internals, a Fear & Greed gauge, and a ranked table.
- A **4-year backtest** so you can see how the regime logic would have behaved.
- Clickable tickers that jump straight to the coin's CoinMarketCap page.

---

## How it works

```
CoinMarketCap snapshot
        │
        ▼
  Regime detection ──► one of 5 regimes
        │              (Alt-Season Risk-On · BTC-Led Risk-On · Chop · Risk-Off · Capitulation)
        ▼
  Regime playbook  ──► risk budget · tradable universe · directional bias · signal weights
        │
        ▼
  20 strategy skills ──► BUY / SELL / NEUTRAL on BTC & ETH, each with a reason
        │
        ▼
  Ranked decision + plain-English rationale  (JSON, agent-consumable)
```

**Regime detection** fuses Fear & Greed, BTC dominance and its trend, top-100 breadth, and an altcoin-season read into one of five regimes. **The playbook** then sets posture: in Risk-Off the budget shrinks and the universe narrows to majors; in Alt-Season Risk-On it widens and tilts toward beta. **The skills** run on that snapshot and the engine composes their output into a single decision.

---

## The skill library (24 skills, BTC & ETH)

Each skill is a pure function with explicit entry/exit rules, evaluated live on BTC and ETH, returning **BUY / SELL / NEUTRAL** plus a reason.

**Price & momentum**
1. **Momentum** — RSI · MACD · Fear & Greed-gated trend following.
2. **Trend Alignment** — agreement across 24h / 7d / 30d / 90d.
3. **Momentum Cross** — 7d vs 30d pace (a moving-average-cross proxy).
4. **Momentum Acceleration** — second-order: is the trend speeding up or fading?
5. **Trend Quality** — rewards clean, consistent trends over choppy ones.
6. **Volatility Breakout** — outsized 24h move vs the weekly pace.

**Mean reversion & reversals**
7. **Mean Reversion** — fades RSI extremes in range-bound markets.
8. **Dip Buyer** — beaten-down assets that are starting to stabilize.
9. **Capitulation / Euphoria Reversal** — turning points at sentiment extremes.

**Volume & liquidity**
10. **Volume / Turnover** — accumulation vs distribution from turnover.
11. **Volume-Confirmed Trend** — a trend only counts if volume backs it.

**Sentiment & internals**
12. **Fear & Greed Contrarian** — buy extreme fear, sell extreme greed.
13. **Sentiment Divergence** — sentiment vs market breadth disagreeing.
14. **Breadth Rotation** — broad participation vs a narrowing tape.

**Regime & rotation**
15. **Regime Detection** — the five-regime classifier as a standalone call.
16. **Dominance Rotation** — BTC ↔ ETH based on BTC dominance trend.
17. **ETH / BTC Relative Strength** — which of the two is stronger now.
18. **Altcoin Season Gate** — favors ETH or BTC by the altseason index.
19. **Flight to Majors** — capital concentrating in BTC & ETH as a safe-haven bid.

**Capital positioning**
20. **Dry Powder** — high stablecoin supply during fear = fuel for upside.

---

## The dashboard

Five tabs:

- **Overview** — Today's Call, the regime banner, a **skill-consensus** meter (how the 24 skills line up for BTC/ETH), then **three backtests** (real ~90-day on live CMC data, a 500-path **Monte Carlo** robustness study, and a synthetic ~4-year run — all net of fee + slippage, benchmarked against the CMC100 index, with a regime-transition timeline), plus the Fear & Greed gauge, BTC vs ETH price chart, live technicals, playbook, market tilts and rationale.
- **Backtest** — every skill as a standalone long-only **spot** strategy, ranked by risk-adjusted return: the 24 ETH/BTC skills and the 14 altcoin skills, each vs buy & hold, live-CMC or synthetic.
- **CMC 100 Index** — CoinMarketCap's top-100 benchmark (wired into the regime engine as a breadth confirmation) plus market internals, Market/Bubble/Sector maps, **Narrative Rotation**, **Upcoming Macro Events** and a **BTC news feed** — all from the CMC Agent Hub.
- **ETH BTC Skills** — all 24 core skills, each with its rules and live BTC/ETH verdicts and Agent Hub status.
- **Altcoin Skills** — 14 Agent-Hub-powered altcoin skills, a live **Coin Lookup** (any ticker → price, RSI/MACD, skill signals and news), and a **Top Altcoin Setups** scanner ranking coins by skill consensus.

---

## Data & honesty (important)

The app runs on **any CoinMarketCap key** and degrades gracefully without one:

- ✅ **Live:** latest listings, quotes, global metrics (dominance, market caps), categories (sectors), Fear & Greed, the **CMC100 index**, and — through the **Agent Hub** — real RSI/MACD, funding, open interest, liquidations and ETF flows.
- 📈 **Backtests, three ways:** a **real ~90-day** run on live CMC historical data (length adapts to the plan's historical window), a **Monte Carlo** robustness study across 500 regime-switching paths, and a **synthetic ~4-year** run — clearly labelled as proof of logic, not a live track record. All returns are **net of fee + slippage**.
- ⚠️ **Plan-gated:** long historical OHLCV / Fear & Greed depend on the CMC plan, so a genuine multi-year replay isn't always available — hence the synthetic + Monte Carlo studies alongside the real recent slice.
- 🧪 **No key?** Every live panel falls back to deterministic mock data (tagged "mock" in the UI) so the demo never breaks.

Nothing is dressed up as something it isn't.

---

## Quick start

```bash
npm install
cp .env.example .env.local      # add your CMC_API_KEY (any CMC key works)
npm run dev                     # http://localhost:3000
```

```bash
npm run build && npm start      # production — MCP server live at POST /api/mcp
npm test                        # run the engine test suite
```

**Deploy (Vercel):** import the repo, set **`CMC_API_KEY`** in Project → Settings → Environment Variables (Production), and deploy. Without the key the app serves mock data; with it, every panel shows live CMC data and the historical backtest, CMC100 and Agent Hub signals populate.

---

## API (agent-consumable JSON)

| Endpoint | What it returns |
|---|---|
| `GET /api/regime` | Live regime + ranked coins + rationale. `?scan=all` full market, `?coin=SOL` single ticker. |
| `GET /api/skills` | All 24 skills run live, with BTC/ETH verdicts. |
| `GET /api/backtest` | Strategy vs buy-and-hold vs no-regime baseline, walk-forward split. |
| `GET /api/prices` | BTC & ETH price trajectory (reconstructed, indexed). |
| `GET /api/sectors` | Sector rotation from CMC categories. |
| `GET /api/movers` | Gainers / losers / most-active. |
| `GET /api/agenthub` | Live CMC Agent Hub (MCP) connection + discovered data tools (with schemas). |
| `GET /api/agenthub-engine` | Independent regime read computed entirely from Agent Hub data. |
| `GET /api/cmc100` | CMC100 index — value, 24h/7d/30d change, historical trend. |
| `GET /api/montecarlo` | Monte Carlo robustness across 500 regime-switching paths (distribution of return / Sharpe / drawdown). |
| `GET /api/skill` | **Agent-ready decision framework** — regime + risk posture + market state + BTC/ETH BUY/SELL/HOLD + confirming signals + **invalidation conditions** + rationale. `?format=md\|yaml` for compact, timestamped output. |
| `GET /api/skill/describe` | **find_skill descriptor** — what the skill does, how to invoke it, output schema. |
| `GET /api/x402/skill` | **x402 pay-per-call** — 402 handshake (USDC on Base) then the decision. |
| `POST /api/mcp` | **MCP server** (Streamable HTTP, JSON-RPC) — 9 agent-callable tools (strategy decision, altcoin scan, narratives, macro events, coin lookup, consensus, backtests). |
| `GET /api/altcoin-skills` | 14 Agent-Hub altcoin skills + top-setup scanner over a live altcoin set. |
| `GET /api/skill-backtest` · `/api/altcoin-backtest` | Per-skill spot backtests (ETH/BTC and altcoins), ranked. |
| `GET /api/consensus` · `/api/narratives` · `/api/macro` · `/api/news` · `/api/lookup` | Skill consensus, trending narratives, macro events, news, coin lookup (Agent Hub). |
| `GET /api/manifest` | The machine-readable skill manifest. |

---

## Tech stack

Next.js 14 (App Router) · TypeScript · custom dark terminal UI · Recharts · a clean CoinMarketCap data layer with in-memory caching · **CMC Agent Hub (MCP) client** + an MCP server of its own · deployed on Vercel.

---

## Project status

The engine, the CMC data layer, the API skill, the 20-skill library, the MCP server, and the dashboard are all implemented and runnable. The regime thresholds and signal weights (`lib/engine/weights.ts`, `lib/engine/regime.ts`) are first-draft calibration parameters — tuning them is the ongoing quant work, documented in `skill/SKILL.md`.

---

*Strategy skill · data provided by CoinMarketCap. Not financial advice.*
