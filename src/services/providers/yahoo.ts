import type { Bar, Timeframe } from '../../types';
import { validateAndCleanBars } from '../validator';

const TIMEFRAME_MAP: Record<Timeframe, { interval: string; defaultRange: string }> = {
  '1m': { interval: '1m', defaultRange: '7d' },
  '3m': { interval: '2m', defaultRange: '7d' },
  '5m': { interval: '5m', defaultRange: '30d' },
  '15m': { interval: '15m', defaultRange: '60d' },
  '30m': { interval: '30m', defaultRange: '60d' },
  '1h': { interval: '60m', defaultRange: '730d' },
  '4h': { interval: '60m', defaultRange: '730d' },
  '1D': { interval: '1d', defaultRange: '10y' },
  '1W': { interval: '1wk', defaultRange: '10y' },
};

/**
 * Fetches real historical quotes from the Yahoo Finance chart API using the exact endpoint
 * used in W:/algo/GEX (https://query1.finance.yahoo.com/v8/finance/chart/{symbol}).
 * Supports bounded historical windows via period1 / period2 for prefetching.
 */
export async function fetchYahooQuotes(
  symbol: string,
  timeframe: Timeframe = '1D',
  from?: number,
  to?: number
): Promise<Bar[]> {
  const config = TIMEFRAME_MAP[timeframe] || { interval: '1d', defaultRange: '5y' };
  
  let targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${config.interval}&includePrePost=true&events=div%2Csplits`;
  
  if (from != null && to != null) {
    const p1 = Math.floor(from / 1000);
    const p2 = Math.floor(to / 1000);
    targetUrl += `&period1=${p1}&period2=${p2}`;
  } else {
    targetUrl += `&range=${config.defaultRange}`;
  }

  // Use local Vite proxy first (no CORS), followed by direct and public proxies
  const pathPart = targetUrl.replace('https://query1.finance.yahoo.com', '/api/yahoo');
  const urlsToTry = [
    pathPart,
    targetUrl,
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
  ];

  let payload: any = null;
  let lastError: any = null;

  for (const url of urlsToTry) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        payload = await response.json();
        if (payload?.chart?.result?.[0]?.timestamp?.length) {
          break;
        }
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!payload?.chart?.result?.[0]) {
    throw new Error(
      `Failed to fetch Yahoo Finance data for ${symbol}. ${lastError ? lastError.message : ''}`
    );
  }

  const result = payload.chart.result[0];
  const timestamps: number[] = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const opens: (number | null)[] = quote.open || [];
  const highs: (number | null)[] = quote.high || [];
  const lows: (number | null)[] = quote.low || [];
  const closes: (number | null)[] = quote.close || [];
  const volumes: (number | null)[] = quote.volume || [];

  const rawBars: Partial<Bar>[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (
      opens[i] != null &&
      highs[i] != null &&
      lows[i] != null &&
      closes[i] != null
    ) {
      rawBars.push({
        time: timestamps[i] * 1000,
        open: Number(opens[i]!.toFixed(2)),
        high: Number(highs[i]!.toFixed(2)),
        low: Number(lows[i]!.toFixed(2)),
        close: Number(closes[i]!.toFixed(2)),
        volume: volumes[i] ?? 0,
      });
    }
  }

  const { bars } = validateAndCleanBars(rawBars);
  return bars;
}
