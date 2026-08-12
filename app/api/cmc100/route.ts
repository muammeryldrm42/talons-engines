// GET /api/cmc100 — CMC100 Index (CoinMarketCap's official top-100 benchmark).
// Latest value + historical trend + derived changes. Free data; graceful fallback.
import { NextResponse } from "next/server";
import { getCmc100Latest, getCmc100Historical, hasKey } from "@/lib/cmc/client";

export const revalidate = 300;

const num = (v: unknown): number | null => (typeof v === "number" && isFinite(v) ? v : null);

export async function GET() {
  try {
    const [latest, hist] = await Promise.all([
      getCmc100Latest().catch(() => null),
      getCmc100Historical(120).catch(() => null),
    ]);

    const series = (hist?.data ?? [])
      .map((p) => ({ date: (p.update_time || p.timestamp || "").slice(0, 10), value: num(p.value) }))
      .filter((p): p is { date: string; value: number } => !!p.date && p.value != null)
      .sort((a, b) => a.date.localeCompare(b.date));

    const value = num(latest?.data?.value) ?? (series.length ? series[series.length - 1].value : null);
    const change24h = num(latest?.data?.value_24h_percentage_change);
    const chg = (n: number) => {
      if (series.length <= n || value == null) return null;
      const past = series[series.length - 1 - n].value;
      return past ? ((value - past) / past) * 100 : null;
    };
    const change7d = chg(7), change30d = chg(30);

    if (value == null && series.length === 0) {
      return NextResponse.json({ source: "unavailable", note: "CMC100 not available on this key/endpoint right now." });
    }
    return NextResponse.json({
      source: hasKey() ? "cmc" : "trial",
      value, change24h, change7d, change30d,
      trendUp: (change30d ?? 0) >= 0,
      series,
      asOf: latest?.data?.last_update ?? (series.length ? series[series.length - 1].date : null),
    });
  } catch {
    return NextResponse.json({ source: "unavailable" });
  }
}
