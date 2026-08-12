// Alerts — fire a webhook (Telegram-compatible) on regime shifts or strong signals.
// Set ALERT_WEBHOOK_URL in env. No-op if unset. Generic JSON POST.

import type { EngineDecision } from "./engine/types";

export async function maybeAlert(d: EngineDecision): Promise<boolean> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return false;

  const triggers: string[] = [];
  if (d.market.regimeShift) {
    triggers.push(`🔀 REGIME SHIFT: ${d.market.prevRegime} → ${d.market.regime}`);
  }
  const strong = d.rankedCoins.filter((c) => Math.abs(c.score) >= 60);
  for (const c of strong) {
    triggers.push(`⚡ ${c.symbol} ${c.direction} (score ${c.score})`);
  }
  if (triggers.length === 0) return false;

  const text = [
    `*Talons Regime Engine*`,
    `Regime: ${d.market.regimeLabel} (${(d.market.regimeConfidence * 100).toFixed(0)}%)`,
    ...triggers,
    d.rationale ?? "",
  ].join("\n");

  try {
    // Telegram sendMessage shape if a bot URL is used; falls back to generic {text}.
    const isTelegram = url.includes("api.telegram.org");
    const body = isTelegram
      ? { chat_id: process.env.ALERT_CHAT_ID, text, parse_mode: "Markdown" }
      : { text, decision: d };
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return true;
  } catch (err) {
    console.warn("[alert] failed:", (err as Error).message);
    return false;
  }
}
