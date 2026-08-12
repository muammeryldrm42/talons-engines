// Canonical, agent-ready output for the Talons Regime Engine Skill.
// Shaped as a verifiable market DECISION FRAMEWORK (the form CMC for Agent
// recommends): risk posture, market state, confirming signals, and the
// conditions that would INVALIDATE the thesis — plus compact Markdown/YAML
// agent-ready serializations to cut JSON bloat and hallucination risk.
import { runEngine } from "./engine";
import { buildInputs } from "./cmc/signals";
import { buildRationale, coinRationale } from "./rationale";
import { regimePlain } from "./labels";

const r4 = (n: number) => Math.round(n * 1e4) / 1e4;
const pctI = (n: number) => Math.round(n * 100);
const actionOf = (d: string) => (d === "LONG" ? "BUY" : d === "SHORT" ? "SELL" : "HOLD");

const RISK_ON = new Set(["ALT_SEASON_RISK_ON", "BTC_LED_RISK_ON"]);

export interface AgentSignal { symbol: string; action: string; direction: string; targetWeight: number; score: number; reason: string }
export interface AgentSkillOutput {
  skill: string; version: string; asOf: string;
  dataSource: string; agentHubLive: boolean;
  regime: { key: string; name: string; meaning: string; confidence: number; riskBudget: number; universe: string; directionBias: string };
  riskPosture: { label: string; note: string };
  marketState: string;
  netExposure: number;
  signals: AgentSignal[];
  confirmingSignals: string[];
  invalidation: string[];
  inputs: Record<string, number | null>;
  rationale: string;
  dataFreshness: { asOf: string; source: string; agentHubLive: boolean };
  capabilities: string[];
}

function riskPostureFor(regime: string): { label: string; note: string } {
  if (RISK_ON.has(regime)) return { label: "Favorable", note: "Constructive backdrop — the engine is allocating risk." };
  if (regime === "CHOP") return { label: "Mixed", note: "Range-bound and conflicted — selective, lighter risk." };
  if (regime === "CAPITULATION") return { label: "Contrarian", note: "Washout — defensive, with selective contrarian entries only." };
  return { label: "Defensive", note: "Risk-off — capital preservation, minimal exposure." };
}

function marketStateFor(regime: string, confidence: number): string {
  if (confidence < 0.45) return "conflicted";
  if (RISK_ON.has(regime)) return "strong";
  if (regime === "CHOP") return "conflicted";
  if (regime === "CAPITULATION") return "washout";
  return "weak";
}

// What would flip the thesis — concrete, data-referenced triggers.
function invalidationFor(regime: string, inp: Record<string, number | null>): string[] {
  const fg = Number(inp.fearGreed ?? 50);
  const r7 = Number(inp.btcReturn7d ?? 0);
  const r30 = Number(inp.btcReturn30d ?? 0);
  const fund = inp.aggFundingRate;
  const out: string[] = [];
  if (RISK_ON.has(regime)) {
    out.push(`Fear & Greed dropping below 30 (now ${fg}) — sentiment rolling over`);
    out.push(`BTC 7d return turning below -8% (now ${r7.toFixed(1)}%) — trend break`);
    out.push(fund != null ? `Funding flipping sharply negative below -0.01% (now ${Number(fund).toFixed(4)}) — leverage flush` : `Aggregate funding flipping sharply negative — leverage flush`);
  } else if (regime === "CHOP") {
    out.push(`Breakout: Fear & Greed > 65 with BTC 7d > +8% (now ${fg} / ${r7.toFixed(1)}%) — regime turns risk-on`);
    out.push(`Breakdown: Fear & Greed < 30 with BTC 7d < -8% (now ${fg} / ${r7.toFixed(1)}%) — regime turns risk-off`);
  } else if (regime === "CAPITULATION") {
    out.push(`Fear & Greed lifting past 35 (now ${fg}) — washout exhausting`);
    out.push(`BTC 30d return turning positive (now ${r30.toFixed(1)}%) — basing into recovery`);
  } else { // RISK_OFF
    out.push(`Fear & Greed reclaiming 50+ (now ${fg}) with BTC above its 30d trend (now ${r30.toFixed(1)}%) — risk can re-engage`);
    out.push(`BTC 7d return turning positive (now ${r7.toFixed(1)}%) — downtrend stalling`);
  }
  return out;
}

export async function runAgentSkill(): Promise<AgentSkillOutput> {
  const { market, coins, source, hubEnriched } = await buildInputs({ scanLimit: 200 });
  const decision = runEngine({ asOf: new Date().toISOString(), market, coins, opts: { confidenceScaling: true, includeFlat: true } });
  decision.rationale = buildRationale(decision);
  const m = decision.market;
  const plain = regimePlain(m.regime);

  const signals: AgentSignal[] = decision.rankedCoins
    .filter((c) => c.symbol === "BTC" || c.symbol === "ETH")
    .map((c) => ({
      symbol: c.symbol, action: actionOf(c.direction), direction: c.direction,
      targetWeight: r4(c.targetWeight), score: Math.round(c.score),
      reason: coinRationale(c.symbol, c.signals),
    }));

  const inputs: Record<string, number | null> = {
    fearGreed: m.fearGreed, btcDominance: m.btcDominance, altseasonIndex: m.altseasonIndex,
    btcReturn7d: m.signals.btcReturn7d, btcReturn30d: m.signals.btcReturn30d,
    aggFundingRate: m.signals.aggFundingRate, openInterestChange: m.signals.openInterestChange,
  };

  return {
    skill: "talons-regime-engine", version: "1.1", asOf: decision.asOf,
    dataSource: source, agentHubLive: !!hubEnriched,
    regime: {
      key: m.regime, name: plain.name, meaning: plain.meaning,
      confidence: m.regimeConfidence, riskBudget: m.playbook.riskBudget,
      universe: m.playbook.universe, directionBias: m.playbook.directionBias,
    },
    riskPosture: riskPostureFor(m.regime),
    marketState: marketStateFor(m.regime, m.regimeConfidence),
    netExposure: r4(signals.reduce((a, s) => a + s.targetWeight, 0)),
    signals,
    confirmingSignals: m.regimeReasons ?? [],
    invalidation: invalidationFor(m.regime, inputs),
    inputs,
    rationale: decision.rationale ?? "",
    dataFreshness: { asOf: decision.asOf, source, agentHubLive: !!hubEnriched },
    capabilities: ["CMC Data API (REST)", "CMC Agent Hub (Data MCP)"],
  };
}

// ---- agent-ready serializations (compact, timestamped) ----
const esc = (s: string) => String(s).replace(/"/g, "'").replace(/\s+/g, " ").trim();

export function toMarkdown(o: AgentSkillOutput): string {
  const L: string[] = [];
  L.push(`# Talons Regime Engine — ${o.regime.name}`);
  L.push(`_as of ${o.asOf} · source ${o.dataSource} · Agent Hub ${o.agentHubLive ? "live" : "offline"}_`);
  L.push("");
  L.push(`**Risk posture:** ${o.riskPosture.label} — ${o.riskPosture.note}`);
  L.push(`**Market state:** ${o.marketState}`);
  L.push(`**Regime confidence:** ${pctI(o.regime.confidence)}% · **Net exposure:** ${pctI(o.netExposure)}% · **Risk budget:** ${pctI(o.regime.riskBudget)}%`);
  L.push("");
  L.push(`## Signals`);
  for (const s of o.signals) L.push(`- **${s.symbol}: ${s.action}** (weight ${pctI(s.targetWeight)}%, score ${s.score}) — ${s.reason}`);
  L.push("");
  L.push(`## Confirming signals`);
  for (const c of o.confirmingSignals) L.push(`- ${c}`);
  L.push("");
  L.push(`## Invalidation — thesis flips if`);
  for (const i of o.invalidation) L.push(`- ${i}`);
  L.push("");
  L.push(`## Rationale`);
  L.push(o.rationale);
  return L.join("\n");
}

export function toYaml(o: AgentSkillOutput): string {
  const L: string[] = [];
  L.push(`skill: ${o.skill}`);
  L.push(`version: "${o.version}"`);
  L.push(`asOf: ${o.asOf}`);
  L.push(`dataSource: ${o.dataSource}`);
  L.push(`agentHubLive: ${o.agentHubLive}`);
  L.push(`regime:`);
  L.push(`  key: ${o.regime.key}`);
  L.push(`  name: "${esc(o.regime.name)}"`);
  L.push(`  confidence: ${o.regime.confidence}`);
  L.push(`  riskBudget: ${o.regime.riskBudget}`);
  L.push(`  directionBias: ${o.regime.directionBias}`);
  L.push(`riskPosture: "${esc(o.riskPosture.label)}"`);
  L.push(`marketState: ${o.marketState}`);
  L.push(`netExposure: ${o.netExposure}`);
  L.push(`signals:`);
  for (const s of o.signals) {
    L.push(`  - symbol: ${s.symbol}`);
    L.push(`    action: ${s.action}`);
    L.push(`    targetWeight: ${s.targetWeight}`);
    L.push(`    score: ${s.score}`);
    L.push(`    reason: "${esc(s.reason)}"`);
  }
  L.push(`confirmingSignals:`);
  for (const c of o.confirmingSignals) L.push(`  - "${esc(c)}"`);
  L.push(`invalidation:`);
  for (const i of o.invalidation) L.push(`  - "${esc(i)}"`);
  L.push(`inputs:`);
  for (const [k, v] of Object.entries(o.inputs)) L.push(`  ${k}: ${v}`);
  L.push(`rationale: "${esc(o.rationale)}"`);
  return L.join("\n");
}
