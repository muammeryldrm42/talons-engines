# Talons Regime Engine

**A regime-adaptive crypto strategy skill for the CMC Strategy Skills track.**
It reads CoinMarketCap signals, classifies the market into one of five regimes, and emits a backtestable BTC/ETH decision framework that any agent can discover, call, and pay for.

| | |
|---|---|
| **Track** | Track 2 · Strategy Skills (backtestable spec, not a live agent) |
| **Live demo** | https://talons-engines.vercel.app |
| **Repository** | https://github.com/muammeryldrm42/talons-engines |
| **BUIDL** | https://dorahacks.io/buidl/44556 |
| **Special prize targeted** | Best Use of CoinMarketCap Data & Signal |

---

## TL;DR for judges

- **What:** five-regime market classifier → BTC/ETH `BUY / SELL / HOLD` with risk budget, net exposure, confirming signals, and explicit **invalidation conditions**.
- **Built from:** 24 composable, single-purpose skills (momentum, mean-reversion, breadth, dominance rotation, fear-greed contrarian, drawdown guard, capitulation volume, and more).
- **Universe: BTC/ETH by design** — the cleanest, most liquid, most backtestable expression of regime; altcoin conditions are *read* through breadth, dominance and altcoin-season signals, not traded blind.
- **Plus a 14-skill altcoin layer** — Agent-Hub-powered altcoin skills (RSI/MACD, whale & holder structure, trending narratives), a live coin lookup, a top-setup scanner and their own spot backtest.
- **Uses all four CMC capabilities:** Data API · Agent Hub (Data MCP) · Skills Marketplace (`find_skill`) · x402 — plus the CMC100 index.
- **Validated three ways:** synthetic 4-year, live ~90-day on real CMC data, and a 500-path Monte Carlo robustness study.
- **Agent-native:** one discovery endpoint, one invoke endpoint (JSON / Markdown / YAML), one x402 pay-per-call endpoint.
- **Honest by construction:** every number is reproducible, every data gap is shown, nothing is faked.

---

## What it is

The engine answers a single question an allocator actually cares about: **is this a day to take risk, and where?** It does this in three steps:

1. **Classify the regime** — `ALT_SEASON_RISK_ON`, `BTC_LED_RISK_ON`, `CHOP`, `RISK_OFF`, or `CAPITULATION` — from Fear & Greed, BTC dominance and its trend, altcoin-season strength, 7d/30d returns, and (when the Agent Hub is live) derivatives and ETF flows.
2. **Run the 24 skills** — each returns a BUY/SELL/NEUTRAL view with a reason; the regime sets the risk budget, tradable universe, and direction bias.
3. **Size and explain** — produce position-sized BTC/ETH calls, a net exposure, a plain-English rationale, and the conditions that would **invalidate** the thesis.

The output is a verifiable **decision framework**, not raw data — the form CMC's own agent guidance recommends.

---

## CMC capabilities used

| Capability | How the engine uses it | Where to see it |
|---|---|---|
| **Data API (REST)** | Fear & Greed, global metrics, dominance, listings, categories, OHLCV + global-metrics historical, CMC100 | `/api/regime`, `/api/backtest`, `/api/cmc100` |
| **Agent Hub (Data MCP)** | Dependency-free MCP client (`initialize → tools/list → tools/call`) for live RSI/MACD, funding, open interest, liquidations, ETF flows, total-market technicals | `/api/agenthub` (connection proof), `/api/agenthub-engine` (Hub-only regime) |
| **Skills Marketplace (`find_skill`)** | Discoverable descriptor + stable agent-ready decision (JSON / Markdown / YAML) | `/api/skill/describe`, `/api/skill` |
| **x402 (optional)** | Pay-per-call handshake — HTTP 402 + payment requirements (USDC on Base), resource on payment | `/api/x402/skill` |
| **Own MCP server** | The skill runs its **own MCP server** (Streamable HTTP, JSON-RPC) with **9 agent-callable tools** — strategy decision, altcoin scan, narratives, macro events, coin lookup, consensus, and both backtests | `POST /api/mcp` |
| **CMC100 Index** | Broad-market breadth benchmark wired into the regime engine (rising confirms risk-on, falling argues caution) | `/api/cmc100`, CMC 100 Index tab |

Pre-computed CMC signals consumed: Fear & Greed, Bitcoin Dominance, Altcoin Season, RSI, MACD, Funding Rates, Open Interest, Liquidations, ETF Flows, CMC100.

---

## Validation — three backtests

| Backtest | Window | What it proves | Honest caveat |
|---|---|---|---|
| **Synthetic** | ~4 years (~1,429d) | The logic: regime gating and drawdown control across full cycles | Generated series — proof of logic, not a live track record (labelled as such in the UI) |
| **Live** | ~90 days | Real-data validation on actual CMC OHLCV + Fear & Greed | Length adapts to the API plan's historical window |
| **Monte Carlo** | 500 paths | Robustness: the edge holds across hundreds of regime-switching markets, not one lucky run | Reported as a distribution (median, p5–p95, worst-case drawdown), not a single number |

**Methodology note.** All returns are **net of transaction costs** (6 bps fee + 4 bps slippage on every rebalance's turnover). The live run benchmarks against **CoinMarketCap's CMC100 index**, not just BTC, and surfaces a **regime-transition timeline** plus a walk-forward in/out-of-sample split. The strategy is risk-managed: it trades some upside for far smaller drawdowns, so in a pure up-only window it can trail buy & hold by design — the Monte Carlo study is the fair read, showing consistent downside control across scenarios. No data is ever faked; unavailable sources are shown and gracefully handled.

---

## 60-second demo

```bash
# 1 · Discover the skill (find_skill descriptor)
curl https://talons-engines.vercel.app/api/skill/describe

# 2 · Invoke it — agent-ready decision framework, compact Markdown
curl "https://talons-engines.vercel.app/api/skill?format=md"

# 3 · x402 pay-per-call handshake (returns HTTP 402 + payment requirements)
curl -i https://talons-engines.vercel.app/api/x402/skill

# 4 · Prove the live Agent Hub (MCP) connection + discovered tools
curl https://talons-engines.vercel.app/api/agenthub

# 5 · Connect to OUR MCP server and list its tools (Streamable HTTP, JSON-RPC)
curl -X POST https://talons-engines.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

To use it as a live MCP tool, point any MCP client (Claude, MCP Inspector, the CMC "Connect MCP" flow) at `https://talons-engines.vercel.app/api/mcp` and call `get_strategy_decision`.

## Use it from an agent

**Python — call the MCP tool:**

```python
import requests

MCP = "https://talons-engines.vercel.app/api/mcp"
r = requests.post(MCP, json={
    "jsonrpc": "2.0", "id": 1, "method": "tools/call",
    "params": {"name": "get_strategy_decision", "arguments": {"format": "markdown"}},
})
print(r.json()["result"]["content"][0]["text"])
```

**JavaScript — call the REST endpoint:**

```js
const res = await fetch("https://talons-engines.vercel.app/api/skill");
const decision = await res.json();
console.log(decision.regime.name, decision.signals, decision.invalidation);
```

**UI tour:** **Overview** (today's call, regime, regime cross-check, the three backtests, core signals) → **CMC Agent Hub** (live MCP regime + BTC/ETH signals) → **CMC 100 Index** (broad-market benchmark + market/sector maps) → **Skills** (all 24, each showing its live Agent Hub status).

---

## Architecture

```
CMC Data API ─┐
CMC Agent Hub ─┼─▶ signals ─▶ regime classifier ─▶ 24 skills ─▶ sizing ─▶ decision framework
CMC100 Index ─┘                                                              │
                                                          ┌──────────────────┼───────────────────┐
                                                       /api/skill      /api/skill/describe   /api/x402/skill
                                                      (JSON/MD/YAML)     (find_skill)         (pay-per-call)
```

The same decision is exposed as a pure function, an HTTP endpoint, and an MCP-discoverable skill. Backtests replay the identical engine, so what you see live is what gets tested.

---

## Tech stack

Next.js 14 · TypeScript · Recharts · deployed on Vercel · data from CoinMarketCap (Data API + Agent Hub MCP). Engine is pure and unit-tested (11 tests). No paid third-party data; CMC100 is free.

## Why it fits "Best Use of CoinMarketCap Data & Signal"

It uses CMC end to end — Data API, Agent Hub MCP, Skills Marketplace packaging, x402, the CMC100 index, and CMC's full pre-computed signal stack — and turns them into one agent-callable, backtested, honestly-validated decision framework.
