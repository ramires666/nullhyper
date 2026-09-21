import type { Bar, Timeframe } from '../../types';
import { resampleBars } from '../resampler';
import { validateAndCleanBars } from '../validator';

// Import real 1m historical datasets exported from Binance, CME and NYSE/NASDAQ
import btc1m from '../../assets/real_data/btcusdt_1m.json';
import eth1m from '../../assets/real_data/ethusdt_1m.json';
import sol1m from '../../assets/real_data/solusdt_1m.json';
import nq1m from '../../assets/real_data/nq_1m.json';
import es1m from '../../assets/real_data/es_1m.json';
import spy1m from '../../assets/real_data/spy_1m.json';
import qqq1m from '../../assets/real_data/qqq_1m.json';
import gld1m from '../../assets/real_data/gld_1m.json';

const REAL_DATASETS: Record<string, any[]> = {
  BTCUSDT: btc1m,
  ETHUSDT: eth1m,
  SOLUSDT: sol1m,
  'NQ=F': nq1m,
  NQF: nq1m,
  NQ: nq1m,
  'ES=F': es1m,
  ESF: es1m,
  SPY: spy1m,
  QQQ: qqq1m,
  GLD: gld1m,
};

/**
 * Loads verified, authentic 1-minute historical market data
 * and resamples it to the requested timeframe.
 * ZERO synthetic or fabricated data.
 */
export function getRealMarketBars(symbol: string, timeframe: Timeframe = '1m'): Bar[] {
  const normSymbol = symbol.toUpperCase().replace(/\s+/g, '');
  const rawList = REAL_DATASETS[normSymbol] || REAL_DATASETS[normSymbol.replace('=', '')];

  if (!rawList || rawList.length === 0) {
    console.error(`[Data Integrity Error] No authentic dataset found for symbol: ${symbol}`);
    return [];
  }

  const { bars } = validateAndCleanBars(rawList);

  if (timeframe === '1m') {
    return bars;
  }

  return resampleBars(bars, timeframe);
}
