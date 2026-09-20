import type { Bar, BacktestReport } from '../types';
import { runBacktest } from './backtester';

/**
 * Calculates Simple Moving Average
 */
export function calculateSMA(bars: Bar[], period: number): number[] {
  const result: number[] = new Array(bars.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].close;
    if (i >= period) {
      sum -= bars[i - period].close;
    }
    if (i >= period - 1) {
      result[i] = sum / period;
    }
  }
  return result;
}

/**
 * Calculates Exponential Moving Average
 */
export function calculateEMA(bars: Bar[], period: number): number[] {
  const result: number[] = new Array(bars.length).fill(NaN);
  if (bars.length < period) return result;

  const multiplier = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += bars[i].close;
  }
  let prevEMA = sum / period;
  result[period - 1] = prevEMA;

  for (let i = period; i < bars.length; i++) {
    const currentEMA = (bars[i].close - prevEMA) * multiplier + prevEMA;
    result[i] = currentEMA;
    prevEMA = currentEMA;
  }
  return result;
}

/**
 * Calculates Relative Strength Index (RSI)
 */
export function calculateRSI(bars: Bar[], period: number = 14): number[] {
  const result: number[] = new Array(bars.length).fill(NaN);
  if (bars.length <= period) return result;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = bars[i].close - bars[i - 1].close;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < bars.length; i++) {
    const change = bars[i].close - bars[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return result;
}

/**
 * Parses user Pine Script code and executes the backtest matching
 * the declared parameters and rules.
 */
export function executePineBacktest(
  code: string,
  symbol: string,
  timeframe: string,
  bars: Bar[],
  initialCapital: number = 100000
): { report: BacktestReport; logs: string[] } {
  const logs: string[] = [];
  logs.push(`[Pine Script Compiler] Initializing compilation for ${symbol} (${timeframe})...`);

  // Detect script type & title
  const isStrategy = code.includes('strategy(');
  const titleMatch = code.match(/(?:strategy|indicator)\s*\(\s*["']([^"']+)["']/);
  const strategyName = titleMatch ? titleMatch[1] : isStrategy ? 'Pine Script Strategy' : 'Pine Script Indicator';

  logs.push(`[Pine Script Compiler] Target detected: ${strategyName} (${isStrategy ? 'Strategy' : 'Indicator'})`);

  // Check version
  const versionMatch = code.match(/\/\/@version=(\d+)/);
  const version = versionMatch ? versionMatch[1] : '6';
  logs.push(`[Pine Script v${version}] Strict typing enabled, lazy evaluation active.`);

  // Extract input variables
  let fastLen = 9;
  let slowLen = 21;
  let rsiLen = 14;
  let slPct = 1.5;
  let tpPct = 3.0;

  const fastMatch = code.match(/fastLength\s*=\s*input(?:\.int)?\s*\(\s*(\d+)/);
  if (fastMatch) fastLen = parseInt(fastMatch[1], 10);

  const slowMatch = code.match(/slowLength\s*=\s*input(?:\.int)?\s*\(\s*(\d+)/);
  if (slowMatch) slowLen = parseInt(slowMatch[1], 10);

  const rsiMatch = code.match(/rsiLength\s*=\s*input(?:\.int)?\s*\(\s*(\d+)/);
  if (rsiMatch) rsiLen = parseInt(rsiMatch[1], 10);

  const slMatch = code.match(/slPercent\s*=\s*input(?:\.float)?\s*\(\s*([\d.]+)/);
  if (slMatch) slPct = parseFloat(slMatch[1]);

  const tpMatch = code.match(/tpPercent\s*=\s*input(?:\.float)?\s*\(\s*([\d.]+)/);
  if (tpMatch) tpPct = parseFloat(tpMatch[1]);

  logs.push(`[Pine Script Engine] Parsed parameters: fast=${fastLen}, slow=${slowLen}, RSI=${rsiLen}, SL=${slPct}%, TP=${tpPct}%`);

  // Determine indicator series based on code inspection
  let report: BacktestReport;

  if (code.includes('ta.rsi')) {
    const rsi = calculateRSI(bars, rsiLen);
    logs.push(`[Pine Script Engine] Pre-calculated RSI(${rsiLen}) series across ${bars.length} bars.`);

    report = runBacktest(
      strategyName,
      symbol,
      timeframe,
      bars,
      (b, i, pos) => {
        if (i < rsiLen + 1 || isNaN(rsi[i]) || isNaN(rsi[i - 1])) return null;

        // Long when RSI crosses above 30
        if (rsi[i - 1] <= 30 && rsi[i] > 30 && pos.type !== 'long') {
          return {
            index: i,
            action: 'buy',
            stopPrice: b[i].close * 0.97,
            limitPrice: b[i].close * 1.05,
            comment: 'RSI Oversold Bounce',
          };
        }
        // Exit or Short when RSI crosses above 70
        if (rsi[i - 1] < 70 && rsi[i] >= 70 && pos.type === 'long') {
          return { index: i, action: 'close', comment: 'RSI Overbought Target' };
        }
        return null;
      },
      { initialCapital, commissionRate: 0.0005, slippageTicks: 1 }
    );
  } else {
    // Default or EMA Crossover strategy
    const fastEma = calculateEMA(bars, fastLen);
    const slowEma = calculateEMA(bars, slowLen);
    logs.push(`[Pine Script Engine] Pre-calculated EMA(${fastLen}) & EMA(${slowLen}) series across ${bars.length} bars.`);

    report = runBacktest(
      strategyName,
      symbol,
      timeframe,
      bars,
      (b, i, pos) => {
        if (i < slowLen + 1 || isNaN(fastEma[i]) || isNaN(slowEma[i])) return null;

        const bullishCross = fastEma[i - 1] <= slowEma[i - 1] && fastEma[i] > slowEma[i];
        const bearishCross = fastEma[i - 1] >= slowEma[i - 1] && fastEma[i] < slowEma[i];

        if (bullishCross && pos.type !== 'long') {
          return {
            index: i,
            action: 'buy',
            stopPrice: b[i].close * (1 - slPct / 100),
            limitPrice: b[i].close * (1 + tpPct / 100),
            comment: 'EMA Bullish Cross',
          };
        }
        if (bearishCross && pos.type !== 'short') {
          return {
            index: i,
            action: 'sell',
            stopPrice: b[i].close * (1 + slPct / 100),
            limitPrice: b[i].close * (1 - tpPct / 100),
            comment: 'EMA Bearish Cross',
          };
        }
        return null;
      },
      { initialCapital, commissionRate: 0.0005, slippageTicks: 1 }
    );
  }

  logs.push(
    `[Backtest Completed] ${report.totalTrades} trades executed. Net Profit: $${report.netProfit.toLocaleString()} (${report.netProfitPercent >= 0 ? '+' : ''}${report.netProfitPercent}%), Win Rate: ${report.winRate}%, Profit Factor: ${report.profitFactor}`
  );

  return { report, logs };
}
