import type { PineScriptTemplate } from '../types';

export const PINE_TEMPLATES: PineScriptTemplate[] = [
  {
    id: 'ema_crossover_v6',
    title: 'Dual EMA Crossover Strategy',
    type: 'strategy',
    description: 'Classic trend-following strategy using fast and slow exponential moving averages with stop loss and take profit.',
    code: `//@version=6
strategy("Dual EMA Crossover Strategy", overlay=true, margin_long=100, margin_short=100)

// Inputs
fastLength = input.int(9, "Fast EMA Length", minval=1)
slowLength = input.int(21, "Slow EMA Length", minval=1)
slPercent  = input.float(1.5, "Stop Loss %", minval=0.1)
tpPercent  = input.float(3.0, "Take Profit %", minval=0.1)

// Indicators
fastEMA = ta.ema(close, fastLength)
slowEMA = ta.ema(close, slowLength)

// Plots
plot(fastEMA, "Fast EMA", color=color.new(#2962FF, 0), linewidth=2)
plot(slowEMA, "Slow EMA", color=color.new(#FF6D00, 0), linewidth=2)

// Crossover Conditions
bullishCross = ta.crossover(fastEMA, slowEMA)
bearishCross = ta.crossunder(fastEMA, slowEMA)

// Entry & Exit Orders
if (bullishCross)
    sl = close * (1 - slPercent / 100)
    tp = close * (1 + tpPercent / 100)
    strategy.entry("Long", strategy.long)
    strategy.exit("Exit Long", "Long", stop=sl, limit=tp)

if (bearishCross)
    sl = close * (1 + slPercent / 100)
    tp = close * (1 - tpPercent / 100)
    strategy.entry("Short", strategy.short)
    strategy.exit("Exit Short", "Short", stop=sl, limit=tp)
`,
  },
  {
    id: 'rsi_mean_reversion_v6',
    title: 'RSI Mean Reversion Strategy',
    type: 'strategy',
    description: 'Buys when RSI dips below oversold threshold and sells when it surges above overbought threshold.',
    code: `//@version=6
strategy("RSI Mean Reversion", overlay=false)

rsiLength  = input.int(14, "RSI Length")
oversold   = input.int(30, "Oversold Level")
overbought = input.int(70, "Overbought Level")

rsiVal = ta.rsi(close, rsiLength)

plot(rsiVal, "RSI", color=color.new(#7E57C2, 0), linewidth=2)
h1 = hline(70, "Overbought", color=color.red, linestyle=hline.style_dashed)
h2 = hline(30, "Oversold", color=color.green, linestyle=hline.style_dashed)
fill(h1, h2, color=color.new(#7E57C2, 90))

// Execution logic
if (ta.crossover(rsiVal, oversold))
    strategy.entry("RSI Long", strategy.long)

if (ta.crossunder(rsiVal, overbought))
    strategy.close("RSI Long", comment="Overbought Exit")
`,
  },
  {
    id: 'supertrend_strategy_v6',
    title: 'Supertrend Volatility Breakout',
    type: 'strategy',
    description: 'ATR-based volatility trailing band strategy popular in crypto and futures trend trading.',
    code: `//@version=6
strategy("Supertrend Strategy", overlay=true)

atrPeriod  = input.int(10, "ATR Period")
multiplier = input.float(3.0, "Multiplier", step=0.1)

[superTrend, direction] = ta.supertrend(multiplier, atrPeriod)

plot(direction < 0 ? superTrend : na, "Up Trend", color=color.green, style=plot.style_linebr)
plot(direction > 0 ? superTrend : na, "Down Trend", color=color.red, style=plot.style_linebr)

// Strategy Entries
if (ta.change(direction) and direction < 0)
    strategy.entry("ST Long", strategy.long)

if (ta.change(direction) and direction > 0)
    strategy.entry("ST Short", strategy.short)
`,
  },
  {
    id: 'ema_ribbon_indicator_v6',
    title: 'Multi-EMA Ribbon Indicator',
    type: 'indicator',
    description: 'Visual momentum ribbon constructed with 5 exponential moving averages.',
    code: `//@version=6
indicator("Multi-EMA Ribbon", overlay=true)

len1 = input.int(20, "EMA 1")
len2 = input.int(50, "EMA 2")
len3 = input.int(100, "EMA 3")
len4 = input.int(200, "EMA 4")

e1 = ta.ema(close, len1)
e2 = ta.ema(close, len2)
e3 = ta.ema(close, len3)
e4 = ta.ema(close, len4)

p1 = plot(e1, "EMA 20", color=color.new(#00E676, 0))
p2 = plot(e2, "EMA 50", color=color.new(#00B0FF, 0))
p3 = plot(e3, "EMA 100", color=color.new(#FFD600, 0))
p4 = plot(e4, "EMA 200", color=color.new(#FF1744, 0))

fill(p1, p4, color=e1 > e4 ? color.new(color.green, 85) : color.new(color.red, 85))
`,
  },
];
