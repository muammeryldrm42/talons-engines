import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Talons Regime Engine — regime-adaptive CMC strategy skill";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const REGIMES: [string, string][] = [
  ["Alt Risk-On", "#34e0a1"],
  ["BTC Risk-On", "#5cc8ff"],
  ["Chop", "#ffb454"],
  ["Risk-Off", "#ff8a5c"],
  ["Capitulation", "#ff5d6c"],
];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "center", padding: "72px", background: "#0a0e12",
          fontFamily: "monospace", color: "#e8eef3",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 26, letterSpacing: 2, color: "#34e0a1" }}>
          ● CMC STRATEGY SKILL
        </div>
        <div style={{ display: "flex", fontSize: 84, fontWeight: 800, marginTop: 18, lineHeight: 1.05 }}>
          TALONS REGIME ENGINE
        </div>
        <div style={{ display: "flex", fontSize: 34, color: "#8a9aa8", marginTop: 18 }}>
          Read the room · pick the play · rank the names
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 56, flexWrap: "wrap" }}>
          {REGIMES.map(([label, color]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", border: `2px solid ${color}`, color, borderRadius: 999, padding: "10px 22px", fontSize: 24 }}>
              {label}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#54636f", marginTop: 56 }}>
          regime classifier → regime-aware scorer → position-sized, backtestable, agent-consumable
        </div>
      </div>
    ),
    size,
  );
}
