// Lightweight technical indicators computed from a close-price series.

/** Wilder's RSI. Returns 0-100, or undefined if not enough data. */
export function rsi(closes: number[], period = 14): number | undefined {
  if (closes.length < period + 1) return undefined;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

/** Simple MACD histogram sign from closes (EMA12-EMA26, signal 9). */
export function macdHistogram(closes: number[]): number | undefined {
  if (closes.length < 35) return undefined;
  const ema = (arr: number[], p: number) => {
    const k = 2 / (p + 1);
    let e = arr[0];
    const out: number[] = [e];
    for (let i = 1; i < arr.length; i++) {
      e = arr[i] * k + e * (1 - k);
      out.push(e);
    }
    return out;
  };
  const e12 = ema(closes, 12);
  const e26 = ema(closes, 26);
  const macdLine = closes.map((_, i) => e12[i] - e26[i]);
  const signal = ema(macdLine, 9);
  const hist = macdLine[macdLine.length - 1] - signal[signal.length - 1];
  return hist;
}
