import type { Bar, Timeframe } from '../../types';
import { validateAndCleanBars } from '../validator';

const TIMEFRAME_MAP: Record<Timeframe, string> = {
  '1m': '1m',
  '3m': '3m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '4h': '4h',
  '1D': '1d',
  '1W': '1w',
};

export async function fetchBinanceKlines(
  symbol: string,
  timeframe: Timeframe = '1h',
  limit: number = 500,
  endTime?: number
): Promise<Bar[]> {
  const formattedSymbol = symbol.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const interval = TIMEFRAME_MAP[timeframe] || '1h';

  let directUrl = `https://api.binance.com/api/v3/klines?symbol=${formattedSymbol}&interval=${interval}&limit=${Math.min(limit, 1000)}`;
  let proxyUrl = `/api/binance/api/v3/klines?symbol=${formattedSymbol}&interval=${interval}&limit=${Math.min(limit, 1000)}`;
  if (endTime) {
    directUrl += `&endTime=${endTime}`;
    proxyUrl += `&endTime=${endTime}`;
  }

  let response: Response | null = null;
  try {
    response = await fetch(proxyUrl);
    if (!response.ok) response = null;
  } catch {
    // try direct
  }
  if (!response) {
    response = await fetch(directUrl);
  }
  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
  }

  const data: [
    number, // Open time
    string, // Open
    string, // High
    string, // Low
    string, // Close
    string, // Volume
    number, // Close time
    string, // Quote asset volume
    number, // Number of trades
    string, // Taker buy base asset volume
    string, // Taker buy quote asset volume
    string  // Ignore
  ][] = await response.json();

  const rawBars: Partial<Bar>[] = data.map((item) => ({
    time: item[0],
    open: parseFloat(item[1]),
    high: parseFloat(item[2]),
    low: parseFloat(item[3]),
    close: parseFloat(item[4]),
    volume: parseFloat(item[5]),
    transactions: item[8],
  }));

  const { bars } = validateAndCleanBars(rawBars);
  return bars;
}
