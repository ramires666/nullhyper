import * as duckdb from '@duckdb/duckdb-wasm';
import type { Bar } from '../types';

let dbInstance: duckdb.AsyncDuckDB | null = null;
let connInstance: duckdb.AsyncDuckDBConnection | null = null;
let initPromise: Promise<duckdb.AsyncDuckDBConnection> | null = null;

export function getDuckDBInstance(): duckdb.AsyncDuckDB | null {
  return dbInstance;
}

/**
 * Initializes the embedded in-browser DuckDB-WASM OLAP engine.
 */
export async function getDuckDBConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  if (connInstance) return connInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const bundles = duckdb.getJsDelivrBundles();
      const bundle = await duckdb.selectBundle(bundles);

      const worker = await duckdb.createWorker(bundle.mainWorker!);
      const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
      const db = new duckdb.AsyncDuckDB(logger, worker);

      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      const conn = await db.connect();

      // Initialize high-performance columnar table for market bars
      await conn.query(`
        CREATE TABLE IF NOT EXISTS market_bars (
          symbol VARCHAR,
          timeframe VARCHAR,
          time BIGINT,
          open DOUBLE,
          high DOUBLE,
          low DOUBLE,
          close DOUBLE,
          volume DOUBLE,
          PRIMARY KEY (symbol, timeframe, time)
        );
        CREATE INDEX IF NOT EXISTS idx_market_bars_lookup ON market_bars (symbol, timeframe, time);
      `);

      dbInstance = db;
      connInstance = conn;
      console.log('[DuckDB] Columnar engine initialized successfully.');
      return conn;
    } catch (err) {
      console.error('[DuckDB Initialization Error]:', err);
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

let queryQueue: Promise<any> = Promise.resolve();

/**
 * Runs a function against DuckDB sequentially, avoiding 'Query already in progress' errors.
 */
export async function runExclusiveDuckDB<T>(
  fn: (conn: duckdb.AsyncDuckDBConnection) => Promise<T>
): Promise<T> {
  const conn = await getDuckDBConnection();
  const execute = async () => {
    return await fn(conn);
  };
  const next = queryQueue.then(execute, execute);
  queryQueue = next.then(() => {}, () => {});
  return next;
}

/**
 * Ingests bars directly into DuckDB tables using batched columnar insert.
 */
export async function insertBarsToDuckDB(
  symbol: string,
  timeframe: string,
  bars: Bar[]
): Promise<number> {
  if (bars.length === 0) return 0;
  return runExclusiveDuckDB(async (conn) => {
    const minTime = bars[0].time;
    const maxTime = bars[bars.length - 1].time;

    // Delete overlapping range to support idempotent continuous data ingestion
    await conn.query(`
      DELETE FROM market_bars
      WHERE symbol = '${symbol}'
        AND timeframe = '${timeframe}'
        AND time >= ${minTime}
        AND time <= ${maxTime};
    `);

    // Insert in batches of 1,000 rows
    const batchSize = 1000;
    for (let i = 0; i < bars.length; i += batchSize) {
      const chunk = bars.slice(i, i + batchSize);
      const valueStrings = chunk.map(
        (b) =>
          `('${symbol}', '${timeframe}', ${b.time}, ${b.open}, ${b.high}, ${b.low}, ${b.close}, ${b.volume || 0})`
      );

      const sql = `INSERT INTO market_bars (symbol, timeframe, time, open, high, low, close, volume) VALUES ${valueStrings.join(', ')};`;
      await conn.query(sql);
    }

    return bars.length;
  });
}

/**
 * Queries bars from DuckDB using SQL.
 */
export async function queryBarsFromDuckDB(
  symbol: string,
  timeframe: string,
  from?: number,
  to?: number
): Promise<Bar[]> {
  return runExclusiveDuckDB(async (conn) => {
    try {
      let sql = `
        SELECT time, open, high, low, close, volume
        FROM market_bars
        WHERE symbol = '${symbol}' AND timeframe = '${timeframe}'
      `;

      if (from != null) {
        sql += ` AND time >= ${from}`;
      }
      if (to != null) {
        sql += ` AND time <= ${to}`;
      }

      sql += ` ORDER BY time ASC;`;

      const result = await conn.query(sql);
      const rows = result.toArray();

      return rows.map((r: any) => ({
        time: Number(r.time),
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close),
        volume: Number(r.volume),
      }));
    } catch (err) {
      console.warn(`[DuckDB query notice for ${symbol}]:`, err);
      return [];
    }
  });
}

export interface DuckDBSQLResult {
  columns: string[];
  rows: Record<string, any>[];
  executionTimeMs: number;
}

/**
 * Executes an arbitrary SQL query against DuckDB and returns the columns, rows, and execution time.
 */
export async function executeDuckDBSQL(sql: string): Promise<DuckDBSQLResult> {
  return runExclusiveDuckDB(async (conn) => {
    const startTime = performance.now();
    const result = await conn.query(sql);
    const executionTimeMs = Math.round((performance.now() - startTime) * 10) / 10;

    const columns = result.schema?.fields?.map((f) => f.name) || [];
    const rows = result.toArray().map((r: any) => {
      const obj: Record<string, any> = {};
      for (const col of columns) {
        const val = r[col];
        obj[col] = typeof val === 'bigint' ? Number(val) : val;
      }
      return obj;
    });

    return { columns, rows, executionTimeMs };
  });
}

export interface DuckDBStats {
  totalBars: number;
  symbolsCount: number;
  details: {
    symbol: string;
    timeframe: string;
    count: number;
    minTime: number;
    maxTime: number;
  }[];
}

/**
 * Returns summary statistics across all datasets stored in DuckDB.
 */
export async function getDuckDBStats(): Promise<DuckDBStats> {
  return runExclusiveDuckDB(async (conn) => {
    try {
      const result = await conn.query(`
        SELECT symbol, timeframe, count(*) as count, min(time) as minTime, max(time) as maxTime
        FROM market_bars
        GROUP BY symbol, timeframe
        ORDER BY symbol, timeframe;
      `);

      const rows = result.toArray();
      let totalBars = 0;
      const details = rows.map((r: any) => {
        const count = Number(r.count);
        totalBars += count;
        return {
          symbol: String(r.symbol),
          timeframe: String(r.timeframe),
          count,
          minTime: Number(r.minTime),
          maxTime: Number(r.maxTime),
        };
      });

      const uniqueSymbols = new Set(details.map((d) => d.symbol)).size;
      return { totalBars, symbolsCount: uniqueSymbols, details };
    } catch (err) {
      console.warn('[DuckDB getDuckDBStats warning]:', err);
      return { totalBars: 0, symbolsCount: 0, details: [] };
    }
  });
}

/**
 * Purges all bars from DuckDB tables.
 */
export async function clearDuckDBBars(): Promise<void> {
  return runExclusiveDuckDB(async (conn) => {
    try {
      await conn.query(`DELETE FROM market_bars;`);
    } catch (err) {
      console.error('[DuckDB clear error]:', err);
    }
  });
}
