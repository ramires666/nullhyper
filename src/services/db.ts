import Dexie, { type Table } from 'dexie';
import type { Bar, Timeframe, SymbolMetadata, BacktestReport } from '../types';

export interface StoredBar extends Bar {
  id?: number;
  symbol: string;
  timeframe: string;
}

export interface StoredScript {
  id: string;
  name: string;
  type: 'indicator' | 'strategy';
  code: string;
  version: number;
  updatedAt: number;
}

export interface StoredBacktest {
  id?: number;
  strategyName: string;
  symbol: string;
  timeframe: string;
  netProfit: number;
  profitFactor: number;
  winRate: number;
  totalTrades: number;
  createdAt: number;
  report: BacktestReport;
}

export class AppDatabase extends Dexie {
  symbols!: Table<SymbolMetadata, string>;
  bars!: Table<StoredBar, number>;
  scripts!: Table<StoredScript, string>;
  backtests!: Table<StoredBacktest, number>;

  constructor() {
    super('NullHyperTV_DB_v2');
    this.version(1).stores({
      symbols: 'symbol, exchange, type',
      bars: '++id, [symbol+timeframe], [symbol+timeframe+time], time',
      scripts: 'id, name, type, updatedAt',
      backtests: '++id, strategyName, symbol, createdAt',
    });
  }
}

export const db = new AppDatabase();

/**
 * Validates that cached bars plausibly belong to the symbol
 * (prevents poisoned DB entries where Bitcoin bars or sine waves were cached under other symbols).
 */
function isPlausibleForSymbol(symbol: string, bar: Bar): boolean {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.startsWith('BTC')) return bar.close > 10000;
  if (s.startsWith('ETH')) return bar.close > 500 && bar.close < 15000;
  if (s.startsWith('SOL')) return bar.close > 10 && bar.close < 2000;
  if (s.startsWith('NQ')) return bar.close > 10000 && bar.close < 60000;
  if (s.startsWith('ES')) return bar.close > 2000 && bar.close < 15000;
  if (s.startsWith('SPY')) return bar.close > 200 && bar.close < 2000;
  if (s.startsWith('QQQ')) return bar.close > 100 && bar.close < 2000;
  if (s.startsWith('GLD')) return bar.close > 50 && bar.close < 1000;
  return true;
}

/**
 * Saves or updates a batch of bars in the local database.
 */
export async function saveBarsToDB(
  symbol: string,
  timeframe: Timeframe,
  bars: Bar[]
): Promise<number> {
  // Only save bars that plausibly belong to this symbol
  const validBars = bars.filter((b) => isPlausibleForSymbol(symbol, b));
  if (validBars.length === 0) return 0;

  const records: StoredBar[] = validBars.map((b) => ({
    symbol,
    timeframe,
    ...b,
  }));

  // Clean old overlapping bars before insert
  const minTime = validBars[0].time;
  const maxTime = validBars[validBars.length - 1].time;
  
  await db.bars
    .where('[symbol+timeframe+time]')
    .between([symbol, timeframe, minTime], [symbol, timeframe, maxTime], true, true)
    .delete();

  await db.bars.bulkAdd(records);
  return records.length;
}

/**
 * Loads cached bars for a symbol and timeframe from local database.
 */
export async function loadBarsFromDB(
  symbol: string,
  timeframe: Timeframe,
  from?: number,
  to?: number
): Promise<Bar[]> {
  const query = db.bars.where('[symbol+timeframe]').equals([symbol, timeframe]);
  let stored = await query.sortBy('time');

  // Verify plausibility - purge contaminated bars if price is wildly wrong
  if (stored.length > 0 && !isPlausibleForSymbol(symbol, stored[0])) {
    console.warn(`[Data Integrity] Purging contaminated bars for ${symbol} in DB`);
    await db.bars.where('[symbol+timeframe]').equals([symbol, timeframe]).delete();
    return [];
  }

  if (from != null) {
    stored = stored.filter((b) => b.time >= from);
  }
  if (to != null) {
    stored = stored.filter((b) => b.time <= to);
  }

  return stored.map((s) => ({
    time: s.time,
    open: s.open,
    high: s.high,
    low: s.low,
    close: s.close,
    volume: s.volume,
    vwap: s.vwap,
    transactions: s.transactions,
  }));
}

/**
 * Retrieves counts and stats about stored data in the database.
 */
export async function getDBStats(): Promise<{
  totalBars: number;
  totalSymbols: number;
  savedScripts: number;
  backtestHistory: number;
}> {
  const [totalBars, totalSymbols, savedScripts, backtestHistory] = await Promise.all([
    db.bars.count(),
    db.symbols.count(),
    db.scripts.count(),
    db.backtests.count(),
  ]);

  return { totalBars, totalSymbols, savedScripts, backtestHistory };
}
