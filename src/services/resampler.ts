import type { Bar, Timeframe } from '../types';

export const TIMEFRAME_TO_MS: Record<Timeframe, number> = {
  '1m': 60 * 1000,
  '3m': 3 * 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1D': 24 * 60 * 60 * 1000,
  '1W': 7 * 24 * 60 * 60 * 1000,
};

/**
 * Resamples a stream or array of granular bars (typically 1m) into
 * higher timeframe candles (e.g. 5m, 15m, 1h, 1D).
 */
export function resampleBars(bars: Bar[], targetTimeframe: Timeframe): Bar[] {
  const periodMs = TIMEFRAME_TO_MS[targetTimeframe];
  if (!periodMs || periodMs === 60000 || bars.length === 0) {
    return bars;
  }

  const buckets = new Map<number, Bar[]>();

  for (const bar of bars) {
    const bucketKey = Math.floor(bar.time / periodMs) * periodMs;
    let group = buckets.get(bucketKey);
    if (!group) {
      group = [];
      buckets.set(bucketKey, group);
    }
    group.push(bar);
  }

  const resampled: Bar[] = [];

  for (const [bucketTime, bucketBars] of buckets.entries()) {
    if (bucketBars.length === 0) continue;

    let open = bucketBars[0].open;
    let high = -Infinity;
    let low = Infinity;
    let close = bucketBars[bucketBars.length - 1].close;
    let volume = 0;
    let vwapSum = 0;
    let transactions = 0;

    for (const b of bucketBars) {
      if (b.high > high) high = b.high;
      if (b.low < low) low = b.low;
      volume += b.volume;
      if (b.vwap) {
        vwapSum += b.vwap * b.volume;
      }
      if (b.transactions) {
        transactions += b.transactions;
      }
    }

    const vwap = volume > 0 && vwapSum > 0 ? vwapSum / volume : undefined;

    resampled.push({
      time: bucketTime,
      open,
      high,
      low,
      close,
      volume,
      vwap,
      transactions: transactions > 0 ? transactions : undefined,
    });
  }

  return resampled.sort((a, b) => a.time - b.time);
}
