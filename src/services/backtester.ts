import type { Bar, Trade, EquityPoint, BacktestReport } from '../types';

export interface StrategyConfig {
  initialCapital?: number;
  commissionRate?: number; // e.g. 0.0005 for 0.05%
  slippageTicks?: number; // e.g. 1 tick
  tickSize?: number; // e.g. 0.25 or 0.01
  qty?: number;
  pyramiding?: number;
}

export interface Signal {
  index?: number;
  action: 'buy' | 'sell' | 'close' | 'exit';
  limitPrice?: number;
  stopPrice?: number;
  comment?: string;
}

/**
 * High-performance event-driven Strategy Backtesting Engine matching TradingView's
 * bar-by-bar execution model and performance reporting.
 */
export function runBacktest(
  strategyName: string,
  symbol: string,
  timeframe: string,
  bars: Bar[],
  generateSignals: (bars: Bar[], index: number, currentPosition: { type: 'none' | 'long' | 'short'; size: number; entryPrice: number }) => Signal | null,
  config: StrategyConfig = {}
): BacktestReport {
  const initialCapital = config.initialCapital ?? 100000;
  const commissionRate = config.commissionRate ?? 0.0005;
  const tickSize = config.tickSize ?? 0.01;
  const slippageValue = (config.slippageTicks ?? 1) * tickSize;
  const defaultQty = config.qty ?? 1;

  let equity = initialCapital;
  let peakEquity = initialCapital;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;

  const trades: Trade[] = [];
  const equityCurve: EquityPoint[] = [];

  let position: {
    type: 'none' | 'long' | 'short';
    qty: number;
    entryPrice: number;
    entryTime: number;
    entryBarIndex: number;
    stopLoss?: number;
    takeProfit?: number;
    highestPrice: number;
    lowestPrice: number;
  } = {
    type: 'none',
    qty: 0,
    entryPrice: 0,
    entryTime: 0,
    entryBarIndex: 0,
    highestPrice: 0,
    lowestPrice: 0,
  };

  let tradeCounter = 1;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];

    // 1. If in position, update excursion (run-up / drawdown) & check SL / TP
    if (position.type === 'long') {
      position.highestPrice = Math.max(position.highestPrice, bar.high);
      position.lowestPrice = Math.min(position.lowestPrice, bar.low);

      // Check Stop Loss
      if (position.stopLoss != null && bar.low <= position.stopLoss) {
        const exitPrice = Math.min(bar.open, position.stopLoss) - slippageValue;
        const grossPnl = (exitPrice - position.entryPrice) * position.qty;
        const comm = (exitPrice + position.entryPrice) * position.qty * commissionRate;
        const netPnl = grossPnl - comm;
        equity += netPnl;

        trades.push({
          id: tradeCounter++,
          entryTime: position.entryTime,
          exitTime: bar.time,
          type: 'long',
          entryPrice: position.entryPrice,
          exitPrice,
          qty: position.qty,
          pnl: Number(netPnl.toFixed(2)),
          pnlPercent: Number(((exitPrice / position.entryPrice - 1) * 100).toFixed(2)),
          commission: Number(comm.toFixed(2)),
          exitReason: 'Stop Loss',
          barsHeld: i - position.entryBarIndex,
          runup: Number(((position.highestPrice / position.entryPrice - 1) * 100).toFixed(2)),
          drawdown: Number(((position.lowestPrice / position.entryPrice - 1) * 100).toFixed(2)),
        });

        position = { type: 'none', qty: 0, entryPrice: 0, entryTime: 0, entryBarIndex: 0, highestPrice: 0, lowestPrice: 0 };
      }
      // Check Take Profit
      else if (position.takeProfit != null && bar.high >= position.takeProfit) {
        const exitPrice = Math.max(bar.open, position.takeProfit) - slippageValue;
        const grossPnl = (exitPrice - position.entryPrice) * position.qty;
        const comm = (exitPrice + position.entryPrice) * position.qty * commissionRate;
        const netPnl = grossPnl - comm;
        equity += netPnl;

        trades.push({
          id: tradeCounter++,
          entryTime: position.entryTime,
          exitTime: bar.time,
          type: 'long',
          entryPrice: position.entryPrice,
          exitPrice,
          qty: position.qty,
          pnl: Number(netPnl.toFixed(2)),
          pnlPercent: Number(((exitPrice / position.entryPrice - 1) * 100).toFixed(2)),
          commission: Number(comm.toFixed(2)),
          exitReason: 'Take Profit',
          barsHeld: i - position.entryBarIndex,
          runup: Number(((position.highestPrice / position.entryPrice - 1) * 100).toFixed(2)),
          drawdown: Number(((position.lowestPrice / position.entryPrice - 1) * 100).toFixed(2)),
        });

        position = { type: 'none', qty: 0, entryPrice: 0, entryTime: 0, entryBarIndex: 0, highestPrice: 0, lowestPrice: 0 };
      }
    } else if (position.type === 'short') {
      position.highestPrice = Math.max(position.highestPrice, bar.high);
      position.lowestPrice = Math.min(position.lowestPrice, bar.low);

      // Check Stop Loss
      if (position.stopLoss != null && bar.high >= position.stopLoss) {
        const exitPrice = Math.max(bar.open, position.stopLoss) + slippageValue;
        const grossPnl = (position.entryPrice - exitPrice) * position.qty;
        const comm = (exitPrice + position.entryPrice) * position.qty * commissionRate;
        const netPnl = grossPnl - comm;
        equity += netPnl;

        trades.push({
          id: tradeCounter++,
          entryTime: position.entryTime,
          exitTime: bar.time,
          type: 'short',
          entryPrice: position.entryPrice,
          exitPrice,
          qty: position.qty,
          pnl: Number(netPnl.toFixed(2)),
          pnlPercent: Number(((1 - exitPrice / position.entryPrice) * 100).toFixed(2)),
          commission: Number(comm.toFixed(2)),
          exitReason: 'Stop Loss',
          barsHeld: i - position.entryBarIndex,
          runup: Number(((1 - position.lowestPrice / position.entryPrice) * 100).toFixed(2)),
          drawdown: Number(((1 - position.highestPrice / position.entryPrice) * 100).toFixed(2)),
        });

        position = { type: 'none', qty: 0, entryPrice: 0, entryTime: 0, entryBarIndex: 0, highestPrice: 0, lowestPrice: 0 };
      }
      // Check Take Profit
      else if (position.takeProfit != null && bar.low <= position.takeProfit) {
        const exitPrice = Math.min(bar.open, position.takeProfit) + slippageValue;
        const grossPnl = (position.entryPrice - exitPrice) * position.qty;
        const comm = (exitPrice + position.entryPrice) * position.qty * commissionRate;
        const netPnl = grossPnl - comm;
        equity += netPnl;

        trades.push({
          id: tradeCounter++,
          entryTime: position.entryTime,
          exitTime: bar.time,
          type: 'short',
          entryPrice: position.entryPrice,
          exitPrice,
          qty: position.qty,
          pnl: Number(netPnl.toFixed(2)),
          pnlPercent: Number(((1 - exitPrice / position.entryPrice) * 100).toFixed(2)),
          commission: Number(comm.toFixed(2)),
          exitReason: 'Take Profit',
          barsHeld: i - position.entryBarIndex,
          runup: Number(((1 - position.lowestPrice / position.entryPrice) * 100).toFixed(2)),
          drawdown: Number(((1 - position.highestPrice / position.entryPrice) * 100).toFixed(2)),
        });

        position = { type: 'none', qty: 0, entryPrice: 0, entryTime: 0, entryBarIndex: 0, highestPrice: 0, lowestPrice: 0 };
      }
    }

    // 2. Evaluate Strategy Signal for this bar
    const signal = generateSignals(bars, i, {
      type: position.type,
      size: position.qty,
      entryPrice: position.entryPrice,
    });

    if (signal) {
      if (signal.action === 'close' && position.type !== 'none') {
        const exitPrice = (position.type === 'long' ? bar.close - slippageValue : bar.close + slippageValue);
        const grossPnl =
          position.type === 'long'
            ? (exitPrice - position.entryPrice) * position.qty
            : (position.entryPrice - exitPrice) * position.qty;
        const comm = (exitPrice + position.entryPrice) * position.qty * commissionRate;
        const netPnl = grossPnl - comm;
        equity += netPnl;

        trades.push({
          id: tradeCounter++,
          entryTime: position.entryTime,
          exitTime: bar.time,
          type: position.type,
          entryPrice: position.entryPrice,
          exitPrice,
          qty: position.qty,
          pnl: Number(netPnl.toFixed(2)),
          pnlPercent: Number(
            (position.type === 'long'
              ? (exitPrice / position.entryPrice - 1) * 100
              : (1 - exitPrice / position.entryPrice) * 100
            ).toFixed(2)
          ),
          commission: Number(comm.toFixed(2)),
          exitReason: signal.comment || 'Signal Close',
          barsHeld: i - position.entryBarIndex,
          runup: Number(((position.highestPrice / position.entryPrice - 1) * 100).toFixed(2)),
          drawdown: Number(((position.lowestPrice / position.entryPrice - 1) * 100).toFixed(2)),
        });

        position = { type: 'none', qty: 0, entryPrice: 0, entryTime: 0, entryBarIndex: 0, highestPrice: 0, lowestPrice: 0 };
      } else if (signal.action === 'buy' && position.type !== 'long') {
        // Close short if open
        if (position.type === 'short') {
          const exitPrice = bar.close + slippageValue;
          const grossPnl = (position.entryPrice - exitPrice) * position.qty;
          const comm = (exitPrice + position.entryPrice) * position.qty * commissionRate;
          equity += grossPnl - comm;
          trades.push({
            id: tradeCounter++,
            entryTime: position.entryTime,
            exitTime: bar.time,
            type: 'short',
            entryPrice: position.entryPrice,
            exitPrice,
            qty: position.qty,
            pnl: Number((grossPnl - comm).toFixed(2)),
            pnlPercent: Number(((1 - exitPrice / position.entryPrice) * 100).toFixed(2)),
            commission: Number(comm.toFixed(2)),
            exitReason: 'Reverse to Long',
            barsHeld: i - position.entryBarIndex,
            runup: Number(((1 - position.lowestPrice / position.entryPrice) * 100).toFixed(2)),
            drawdown: Number(((1 - position.highestPrice / position.entryPrice) * 100).toFixed(2)),
          });
        }

        // Open Long
        const entryPrice = bar.close + slippageValue;
        position = {
          type: 'long',
          qty: defaultQty,
          entryPrice,
          entryTime: bar.time,
          entryBarIndex: i,
          highestPrice: bar.high,
          lowestPrice: bar.low,
          stopLoss: signal.stopPrice,
          takeProfit: signal.limitPrice,
        };
      } else if (signal.action === 'sell' && position.type !== 'short') {
        // Close long if open
        if (position.type === 'long') {
          const exitPrice = bar.close - slippageValue;
          const grossPnl = (exitPrice - position.entryPrice) * position.qty;
          const comm = (exitPrice + position.entryPrice) * position.qty * commissionRate;
          equity += grossPnl - comm;
          trades.push({
            id: tradeCounter++,
            entryTime: position.entryTime,
            exitTime: bar.time,
            type: 'long',
            entryPrice: position.entryPrice,
            exitPrice,
            qty: position.qty,
            pnl: Number((grossPnl - comm).toFixed(2)),
            pnlPercent: Number(((exitPrice / position.entryPrice - 1) * 100).toFixed(2)),
            commission: Number(comm.toFixed(2)),
            exitReason: 'Reverse to Short',
            barsHeld: i - position.entryBarIndex,
            runup: Number(((position.highestPrice / position.entryPrice - 1) * 100).toFixed(2)),
            drawdown: Number(((position.lowestPrice / position.entryPrice - 1) * 100).toFixed(2)),
          });
        }

        // Open Short
        const entryPrice = bar.close - slippageValue;
        position = {
          type: 'short',
          qty: defaultQty,
          entryPrice,
          entryTime: bar.time,
          entryBarIndex: i,
          highestPrice: bar.high,
          lowestPrice: bar.low,
          stopLoss: signal.stopPrice,
          takeProfit: signal.limitPrice,
        };
      }
    }

    // 3. Mark-to-market Equity curve
    let openPnl = 0;
    if (position.type === 'long') {
      openPnl = (bar.close - position.entryPrice) * position.qty;
    } else if (position.type === 'short') {
      openPnl = (position.entryPrice - bar.close) * position.qty;
    }

    const currentTotalEquity = equity + openPnl;
    if (currentTotalEquity > peakEquity) {
      peakEquity = currentTotalEquity;
    }
    const currentDrawdown = peakEquity - currentTotalEquity;
    const currentDrawdownPercent = peakEquity > 0 ? (currentDrawdown / peakEquity) * 100 : 0;

    if (currentDrawdown > maxDrawdown) {
      maxDrawdown = currentDrawdown;
    }
    if (currentDrawdownPercent > maxDrawdownPercent) {
      maxDrawdownPercent = currentDrawdownPercent;
    }

    equityCurve.push({
      time: bar.time,
      equity: Number(currentTotalEquity.toFixed(2)),
      drawdown: Number(currentDrawdown.toFixed(2)),
      drawdownPercent: Number(currentDrawdownPercent.toFixed(2)),
    });
  }

  // Calculate Aggregated Metrics
  const netProfit = equity - initialCapital;
  const netProfitPercent = (netProfit / initialCapital) * 100;

  const winTradesList = trades.filter((t) => t.pnl > 0);
  const lossTradesList = trades.filter((t) => t.pnl < 0);

  const grossProfit = winTradesList.reduce((acc, t) => acc + t.pnl, 0);
  const grossLoss = Math.abs(lossTradesList.reduce((acc, t) => acc + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.9 : 0;
  const winRate = trades.length > 0 ? (winTradesList.length / trades.length) * 100 : 0;

  const avgTrade = trades.length > 0 ? netProfit / trades.length : 0;
  const avgWinTrade = winTradesList.length > 0 ? grossProfit / winTradesList.length : 0;
  const avgLossTrade = lossTradesList.length > 0 ? grossLoss / lossTradesList.length : 0;
  const winLossRatio = avgLossTrade > 0 ? avgWinTrade / avgLossTrade : avgWinTrade > 0 ? 99.9 : 0;

  // Sharpe & Sortino Ratios (from trade returns)
  const returns = trades.map((t) => t.pnlPercent / 100);
  const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance =
    returns.length > 1
      ? returns.reduce((acc, r) => acc + Math.pow(r - meanReturn, 2), 0) / (returns.length - 1)
      : 0;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0;

  const downReturns = returns.filter((r) => r < 0);
  const downVariance =
    downReturns.length > 1
      ? downReturns.reduce((acc, r) => acc + Math.pow(r, 2), 0) / downReturns.length
      : 0;
  const downStdDev = Math.sqrt(downVariance);
  const sortinoRatio = downStdDev > 0 ? (meanReturn / downStdDev) * Math.sqrt(252) : 0;

  // Consecutive wins / losses
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let currentWins = 0;
  let currentLosses = 0;

  for (const t of trades) {
    if (t.pnl > 0) {
      currentWins++;
      currentLosses = 0;
      if (currentWins > maxConsecutiveWins) maxConsecutiveWins = currentWins;
    } else if (t.pnl < 0) {
      currentLosses++;
      currentWins = 0;
      if (currentLosses > maxConsecutiveLosses) maxConsecutiveLosses = currentLosses;
    }
  }

  return {
    strategyName,
    symbol,
    timeframe,
    initialCapital,
    finalCapital: Number(equity.toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    netProfitPercent: Number(netProfitPercent.toFixed(2)),
    grossProfit: Number(grossProfit.toFixed(2)),
    grossLoss: Number(grossLoss.toFixed(2)),
    profitFactor: Number(profitFactor.toFixed(2)),
    totalTrades: trades.length,
    winTrades: winTradesList.length,
    lossTrades: lossTradesList.length,
    winRate: Number(winRate.toFixed(2)),
    maxDrawdown: Number(maxDrawdown.toFixed(2)),
    maxDrawdownPercent: Number(maxDrawdownPercent.toFixed(2)),
    sharpeRatio: Number(sharpeRatio.toFixed(2)),
    sortinoRatio: Number(sortinoRatio.toFixed(2)),
    avgTrade: Number(avgTrade.toFixed(2)),
    avgWinTrade: Number(avgWinTrade.toFixed(2)),
    avgLossTrade: Number(avgLossTrade.toFixed(2)),
    winLossRatio: Number(winLossRatio.toFixed(2)),
    maxConsecutiveWins,
    maxConsecutiveLosses,
    trades,
    equityCurve,
  };
}
