export interface Bar {
  time: number; // Unix epoch in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  transactions?: number;
}

export type AssetType = 'crypto' | 'stock' | 'futures' | 'forex';

export interface SymbolMetadata {
  symbol: string;
  name: string;
  exchange: string;
  type: AssetType;
  base: string;
  quote: string;
  minTick: number;
  pointValue: number;
  digits: number;
  source: 'binance' | 'yahoo' | 'massive' | 'firstrate' | 'custom';
}

export type Timeframe = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1D' | '1W';

export interface Trade {
  id: number;
  entryTime: number;
  exitTime: number;
  type: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  qty: number;
  pnl: number;
  pnlPercent: number;
  commission: number;
  exitReason: string;
  barsHeld: number;
  runup: number;
  drawdown: number;
}

export interface EquityPoint {
  time: number;
  equity: number;
  drawdown: number;
  drawdownPercent: number;
}

export interface BacktestReport {
  strategyName: string;
  symbol: string;
  timeframe: string;
  initialCapital: number;
  finalCapital: number;
  netProfit: number;
  netProfitPercent: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  winRate: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  sortinoRatio: number;
  avgTrade: number;
  avgWinTrade: number;
  avgLossTrade: number;
  winLossRatio: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  trades: Trade[];
  equityCurve: EquityPoint[];
}

export interface PineScriptTemplate {
  id: string;
  title: string;
  type: 'indicator' | 'strategy';
  description: string;
  code: string;
  filename?: string;
  path?: string;
  source?: 'folder' | 'builtin';
}
