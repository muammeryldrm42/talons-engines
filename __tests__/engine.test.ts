import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyRegime } from "../lib/engine/regime";
import { isStable } from "../lib/engine/config";
import { rsi, macdHistogram } from "../lib/indicators";
import { evaluate } from "../lib/skill";
import { runSkills } from "../lib/skills";
import { mockInputs } from "../lib/cmc/signals";
import type { MarketSignals } from "../lib/engine/types";

const base: MarketSignals = {
  fearGreed: 50, altseasonIndex: 50, btcDominance: 57,
  btcDominanceTrend: 0, btcReturn7d: 0, btcReturn30d: 0,
};

test("regime: extreme fear + sharp drop → CAPITULATION", () => {
  const r = classifyRegime({ ...base, fearGreed: 12, btcReturn7d: -14 });
  assert.equal(r.regime, "CAPITULATION");
});

test("regime: greed + uptrend + alts leading → ALT_SEASON_RISK_ON", () => {
  const r = classifyRegime({ ...base, fearGreed: 70, btcReturn7d: 6, altseasonIndex: 80, btcDominanceTrend: -1 });
  assert.equal(r.regime, "ALT_SEASON_RISK_ON");
});

test("regime: greed + uptrend + BTC leading → BTC_LED_RISK_ON", () => {
  const r = classifyRegime({ ...base, fearGreed: 62, btcReturn7d: 5, altseasonIndex: 35 });
  assert.equal(r.regime, "BTC_LED_RISK_ON");
});

test("regime: neutral → CHOP", () => {
  const r = classifyRegime({ ...base, fearGreed: 50, btcReturn7d: 0.5 });
  assert.equal(r.regime, "CHOP");
});

test("regime: derivatives leverage washout escalates RISK_OFF → CAPITULATION", () => {
  const off = classifyRegime({ ...base, fearGreed: 35, btcReturn7d: -7 });
  assert.equal(off.regime, "RISK_OFF");
  const washout = classifyRegime({ ...base, fearGreed: 35, btcReturn7d: -7, aggFundingRate: -0.0005 });
  assert.equal(washout.regime, "CAPITULATION");
});

test("stablecoins excluded (incl name-based)", () => {
  for (const [s, n] of [["USDT", "Tether"], ["USDG", "Global Dollar"], ["RLUSD", "Ripple USD"], ["EURC", "Euro Coin"], ["U", "U"]] as const) {
    assert.equal(isStable(s, n), true, `${s} should be stable`);
  }
  for (const [s, n] of [["BTC", "Bitcoin"], ["SOL", "Solana"], ["EUL", "Euler"]] as const) {
    assert.equal(isStable(s, n), false, `${s} should not be stable`);
  }
});

test("RSI: rising series is overbought, falling is oversold", () => {
  const up = Array.from({ length: 20 }, (_, i) => 100 + i);
  const down = Array.from({ length: 20 }, (_, i) => 100 - i);
  assert.ok((rsi(up) ?? 0) > 70);
  assert.ok((rsi(down) ?? 100) < 30);
});

test("MACD histogram defined for sufficient series", () => {
  const series = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i / 3) * 5 + i * 0.3);
  assert.equal(typeof macdHistogram(series), "number");
});

test("skill: mock capitulation yields contrarian LONG on BTC/ETH", () => {
  const { market, coins } = mockInputs();
  const d = evaluate({ asOf: "t", market, coins });
  assert.equal(d.market.regime, "CAPITULATION");
  assert.ok(d.rankedCoins.length > 0);
  assert.ok(d.rankedCoins.every((c) => c.direction === "LONG"));
  assert.ok(d.market.playbook.weights.length === 7);
});

test("skill library: 24 skills, all verdicts BTC/ETH with BUY/SELL/NEUTRAL", () => {
  const { market, coins } = mockInputs();
  const out = runSkills({ market, coins, globals: null });
  assert.equal(out.length, 24);
  for (const s of out) {
    assert.ok(s.entry.length > 0 && s.exit.length > 0);
    for (const v of s.verdicts) {
      assert.ok(["BTC", "ETH"].includes(v.symbol), `${s.id} verdict for non-target ${v.symbol}`);
      assert.ok(["BUY", "SELL", "NEUTRAL"].includes(v.signal));
      assert.ok(v.reason.length > 0);
    }
  }
});

test("skill library: capitulation mock → momentum SELL, regime SELL on BTC", () => {
  const { market, coins } = mockInputs();
  const out = runSkills({ market, coins, globals: null });
  const mom = out.find((s) => s.id === "momentum")!;
  const reg = out.find((s) => s.id === "regime-detection")!;
  assert.equal(mom.verdicts.find((v) => v.symbol === "BTC")!.signal, "SELL");
  assert.equal(reg.verdicts.find((v) => v.symbol === "BTC")!.signal, "SELL");
});
