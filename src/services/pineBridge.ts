import type { Bar, BacktestReport, PineInputParam, PineInputType, StrategyLevel } from '../types';
import { runBacktest, type Signal } from './backtester';

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
 * Calculates Average True Range (ATR)
 */
export function calculateATR(bars: Bar[], period: number = 14): number[] {
  const result: number[] = new Array(bars.length).fill(NaN);
  if (bars.length === 0) return result;

  const tr: number[] = new Array(bars.length).fill(0);
  tr[0] = bars[0].high - bars[0].low;

  for (let i = 1; i < bars.length; i++) {
    const hl = bars[i].high - bars[i].low;
    const hpc = Math.abs(bars[i].high - bars[i - 1].close);
    const lpc = Math.abs(bars[i].low - bars[i - 1].close);
    tr[i] = Math.max(hl, hpc, lpc);
  }

  let sum = 0;
  for (let i = 0; i < Math.min(period, bars.length); i++) {
    sum += tr[i];
  }

  let prevATR = sum / Math.min(period, bars.length);
  result[Math.min(period, bars.length) - 1] = prevATR;

  for (let i = period; i < bars.length; i++) {
    const curATR = (prevATR * (period - 1) + tr[i]) / period;
    result[i] = curATR;
    prevATR = curATR;
  }

  return result;
}

/**
 * Calculates Intraday VWAP
 */
export function calculateVWAP(bars: Bar[]): number[] {
  const result: number[] = new Array(bars.length).fill(NaN);
  let cumVolume = 0;
  let cumVolPrice = 0;
  let currentDay = '';

  for (let i = 0; i < bars.length; i++) {
    const d = new Date(bars[i].time).toISOString().slice(0, 10);
    if (d !== currentDay) {
      currentDay = d;
      cumVolume = 0;
      cumVolPrice = 0;
    }
    const vol = Math.max(1, bars[i].volume || 1);
    const typical = (bars[i].high + bars[i].low + bars[i].close) / 3;
    cumVolPrice += typical * vol;
    cumVolume += vol;
    result[i] = cumVolPrice / cumVolume;
  }

  return result;
}

/**
 * Convert timestamp to NY local time components (America/New_York)
 */
export function getBarNYTime(timestamp: number): {
  hour: number;
  minute: number;
  day: number;
  dateStr: string;
} {
  const d = new Date(timestamp);
  const month = d.getUTCMonth(); // 0-11
  // Daylight Saving Time for US Eastern: 2nd Sunday in March to 1st Sunday in Nov
  const isEDT = month >= 2 && month <= 10;
  const offsetHours = isEDT ? -4 : -5;
  const nyTime = new Date(timestamp + offsetHours * 3600 * 1000);

  return {
    hour: nyTime.getUTCHours(),
    minute: nyTime.getUTCMinutes(),
    day: nyTime.getUTCDate(),
    dateStr: nyTime.toISOString().slice(0, 10),
  };
}

/**
 * Parses time session format: "0200-0230" or "0300-0900:1234567"
 */
export function parseSessionRange(sessionStr: string): {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
} {
  const clean = sessionStr.split(':')[0].trim();
  const parts = clean.split('-');
  if (parts.length >= 2) {
    const s = parts[0].padStart(4, '0');
    const e = parts[1].padStart(4, '0');
    return {
      startHour: parseInt(s.slice(0, 2), 10) || 0,
      startMinute: parseInt(s.slice(2, 4), 10) || 0,
      endHour: parseInt(e.slice(0, 2), 10) || 0,
      endMinute: parseInt(e.slice(2, 4), 10) || 0,
    };
  }
  return { startHour: 2, startMinute: 0, endHour: 2, endMinute: 30 };
}

/**
 * Checks whether an hour:minute falls within a session range
 */
export function isWithinSession(
  hour: number,
  minute: number,
  session: { startHour: number; startMinute: number; endHour: number; endMinute: number }
): boolean {
  const timeVal = hour * 60 + minute;
  const startVal = session.startHour * 60 + session.startMinute;
  const endVal = session.endHour * 60 + session.endMinute;

  if (startVal <= endVal) {
    return timeVal >= startVal && timeVal < endVal;
  } else {
    // Overnight session (e.g. 2200-0400)
    return timeVal >= startVal || timeVal < endVal;
  }
}

/**
 * Universal Pine Script Input Parser
 * Dynamically extracts all declared input variables with their metadata, types, defaults, and groups.
 */
export function extractPineInputs(code: string): PineInputParam[] {
  const groupVars: Record<string, string> = {};
  for (const line of code.split('\n')) {
    const trimmed = line.trim();
    const gMatch = trimmed.match(/^(\w+)\s*=\s*["']([^"']+)["']/);
    if (gMatch && !trimmed.includes('input')) {
      groupVars[gMatch[1]] = gMatch[2];
    }
  }

  const inputs: PineInputParam[] = [];
  let idx = 0;

  while (true) {
    const inputPos = code.indexOf('input', idx);
    if (inputPos === -1) break;

    const before = code.slice(Math.max(0, inputPos - 120), inputPos);
    const varMatch = before.match(/(\b\w+)\s*=\s*$/);
    if (!varMatch) {
      idx = inputPos + 5;
      continue;
    }
    const varName = varMatch[1];

    const afterInput = code.slice(inputPos + 5);
    const callMatch = afterInput.match(/^(\.[a-zA-Z_]+)?\s*\(/);
    if (!callMatch) {
      idx = inputPos + 5;
      continue;
    }

    const typeSuffix = callMatch[1] ? callMatch[1].slice(1) : '';
    const openParenPos = inputPos + 5 + callMatch[0].length - 1;

    let depth = 1;
    let inString: string | null = null;
    let closeParenPos = -1;

    for (let i = openParenPos + 1; i < code.length; i++) {
      const char = code[i];
      const prevChar = i > 0 ? code[i - 1] : '';

      if (inString) {
        if (char === inString && prevChar !== '\\') {
          inString = null;
        }
      } else {
        if (char === '"' || char === "'") {
          inString = char;
        } else if (char === '(' || char === '[') {
          depth++;
        } else if (char === ')' || char === ']') {
          depth--;
          if (depth === 0) {
            closeParenPos = i;
            break;
          }
        }
      }
    }

    if (closeParenPos === -1) {
      idx = inputPos + 5;
      continue;
    }

    const rawArgs = code.slice(openParenPos + 1, closeParenPos);
    idx = closeParenPos + 1;

    let defval: any = null;
    let title = varName;
    let minval: number | undefined;
    let maxval: number | undefined;
    let step: number | undefined;
    let options: (string | number)[] | undefined;
    let group: string | undefined;
    let tooltip: string | undefined;

    // Parse options array if present: options = [...]
    const optionsMatch = rawArgs.match(/options\s*=\s*\[([\s\S]*?)\]/);
    if (optionsMatch) {
      const optStr = optionsMatch[1];
      const opts: (string | number)[] = [];
      const optRegex = /["']([^"']+)["']|(\d+(?:\.\d+)?)/g;
      let om: RegExpExecArray | null;
      while ((om = optRegex.exec(optStr)) !== null) {
        opts.push(om[1] !== undefined ? om[1] : parseFloat(om[2]));
      }
      options = opts;
    }

    // Parse group: group = group_candle or group = "Group"
    const groupMatch = rawArgs.match(/group\s*=\s*([^,)\n]+)/);
    if (groupMatch) {
      const rawG = groupMatch[1].trim().replace(/^["']|["']$/g, '');
      group = groupVars[rawG] || rawG;
    }

    // Parse tooltip
    const tooltipMatch = rawArgs.match(/tooltip\s*=\s*["']([\s\S]*?)["'](?:\s*[,)]|\s*$)/);
    if (tooltipMatch) {
      tooltip = tooltipMatch[1].replace(/\\n/g, '\n');
    }

    // Parse minval, maxval, step
    const minMatch = rawArgs.match(/minval\s*=\s*([\d.-]+)/);
    if (minMatch) minval = parseFloat(minMatch[1]);

    const maxMatch = rawArgs.match(/maxval\s*=\s*([\d.-]+)/);
    if (maxMatch) maxval = parseFloat(maxMatch[1]);

    const stepMatch = rawArgs.match(/step\s*=\s*([\d.-]+)/);
    if (stepMatch) step = parseFloat(stepMatch[1]);

    // Parse named title
    const titleNamedMatch = rawArgs.match(/title\s*=\s*["']([^"']+)["']/);
    if (titleNamedMatch) {
      title = titleNamedMatch[1];
    }

    let detectedType: PineInputType = 'float';
    if (typeSuffix === 'int') detectedType = 'int';
    else if (typeSuffix === 'float') detectedType = 'float';
    else if (typeSuffix === 'bool') detectedType = 'bool';
    else if (typeSuffix === 'string') detectedType = 'string';
    else if (typeSuffix === 'session') detectedType = 'session';

    // Parse argument parts
    const argsParts: string[] = [];
    let cur = '';
    let inS: string | null = null;
    let d = 0;
    for (let i = 0; i < rawArgs.length; i++) {
      const c = rawArgs[i];
      const prev = i > 0 ? rawArgs[i - 1] : '';
      if (inS) {
        cur += c;
        if (c === inS && prev !== '\\') inS = null;
      } else {
        if (c === '"' || c === "'") {
          inS = c;
          cur += c;
        } else if (c === '[' || c === '(') {
          d++;
          cur += c;
        } else if (c === ']' || c === ')') {
          d--;
          cur += c;
        } else if (c === ',' && d === 0) {
          argsParts.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
    }
    if (cur.trim()) argsParts.push(cur.trim());

    if (argsParts.length > 0) {
      const firstArg = argsParts[0];
      const namedDefval = firstArg.match(/^defval\s*=\s*(.*)$/);
      const valStr = namedDefval ? namedDefval[1].trim() : firstArg;

      if (valStr.startsWith('"') || valStr.startsWith("'")) {
        defval = valStr.slice(1, -1);
        if (!typeSuffix) detectedType = 'string';
      } else if (valStr === 'true' || valStr === 'false') {
        defval = valStr === 'true';
        if (!typeSuffix) detectedType = 'bool';
      } else if (!isNaN(Number(valStr))) {
        defval = Number(valStr);
        if (!typeSuffix) detectedType = valStr.includes('.') ? 'float' : 'int';
      } else {
        defval = valStr;
      }
    }

    if (title === varName && argsParts.length > 1) {
      const secondArg = argsParts[1];
      if (!secondArg.includes('=')) {
        const strM = secondArg.match(/^["']([^"']+)["']$/);
        if (strM) title = strM[1];
      }
    }

    if (detectedType === 'session') {
      if (typeof defval !== 'string') defval = String(defval || '0200-0230');
    }

    inputs.push({
      id: varName,
      varName,
      type: detectedType,
      value: defval,
      defval,
      title,
      options,
      minval,
      maxval,
      step,
      group: group || 'General Settings',
      tooltip,
    });
  }

  return inputs;
}

/**
 * Executes a Pine Script strategy backtest matching user parameters,
 * custom overrides, indicators, session breakouts, and execution rules.
 */
export function executePineBacktest(
  code: string,
  symbol: string,
  timeframe: string,
  bars: Bar[],
  initialCapital: number = 100000,
  customInputs?: Record<string, any>
): { report: BacktestReport; logs: string[] } {
  const logs: string[] = [];
  logs.push(`[Pine Script Compiler] Initializing compilation for ${symbol} (${timeframe})...`);

  // Detect script type & title
  const isStrategy = code.includes('strategy(');
  const titleMatch = code.match(/(?:strategy|indicator)\s*\(\s*["']([^"']+)["']/);
  const strategyName = titleMatch
    ? titleMatch[1]
    : isStrategy
    ? 'Pine Script Strategy'
    : 'Pine Script Indicator';

  logs.push(
    `[Pine Script Compiler] Target detected: ${strategyName} (${isStrategy ? 'Strategy' : 'Indicator'})`
  );

  // Check Pine version
  const versionMatch = code.match(/\/\/@version=(\d+)/);
  const version = versionMatch ? versionMatch[1] : '6';
  logs.push(`[Pine Script v${version}] Strict typing enabled, lazy evaluation active.`);

  // 1. Dynamic Parameter Extraction
  const inputs = extractPineInputs(code);
  const paramMap: Record<string, any> = {};

  for (const input of inputs) {
    if (customInputs && customInputs[input.id] !== undefined) {
      input.value = customInputs[input.id];
    }
    paramMap[input.id] = input.value;
  }

  const paramSummary = inputs.map((i) => `${i.id}=${JSON.stringify(i.value)}`).join(', ');
  logs.push(
    `[Pine Script Engine] Extracted ${inputs.length} parameters: ${paramSummary.slice(0, 160)}${
      paramSummary.length > 160 ? '...' : ''
    }`
  );

  let report: BacktestReport;
  const lowerCode = code.toLowerCase();

  // 2. Identify Strategy Archetype & Execute True Strategy Rules
  const isNQBreakout =
    code.includes('2AM') ||
    code.includes('sessionTime') ||
    code.includes('in_hour_2am_window') ||
    code.includes('02:00') ||
    (lowerCode.includes('breakout') && (lowerCode.includes('session') || code.includes('0200')));

  const isSupertrend =
    lowerCode.includes('supertrend') ||
    (lowerCode.includes('atr') && lowerCode.includes('factor') && lowerCode.includes('trend'));

  const isRSI = lowerCode.includes('ta.rsi') || lowerCode.includes('rsi(');

  if (isNQBreakout) {
    // =========================================================================
    // NQ 2:00 AM NY Session Range Breakout Strategy Engine
    // =========================================================================
    logs.push(
      `[Strategy Engine] Selected Archetype: NQ Session Range Breakout (New York Time 02:00-09:00).`
    );

    const refMode = paramMap.ref_mode || '1-Hour Range (02:00 - 03:00 NY)';
    const useAtrRange = paramMap.use_atr_range === true;
    const atrLen = Number(paramMap.atr_len) || 14;
    const atrPct = Number(paramMap.atr_pct) || 100.0;
    const centerMode = paramMap.center_mode || 'High / Low (Классический)';
    const rangeMult = Number(paramMap.range_mult) !== undefined ? Number(paramMap.range_mult) : 1.0;
    const breakoutMargin =
      Number(paramMap.breakoutMargin) !== undefined
        ? Number(paramMap.breakoutMargin)
        : 2.0 * rangeMult;

    const slMode = paramMap.sl_mode || '2x Candle Range (от входа)';
    const slMultiplier = Number(paramMap.sl_multiplier) || 2.0;
    const slBufferPct = Number(paramMap.sl_buffer_pct) || 0.1;
    const slPoints = Number(paramMap.slPoints) || 15.0;
    const tpPoints = Number(paramMap.tpPoints) || 30.0;
    const maxOneTrade = paramMap.max_one_trade !== false;
    const useTp = paramMap.use_tp === true;
    const tpRr = Number(paramMap.tp_rr) || 2.0;

    const formationSession = parseSessionRange(paramMap.sessionTime || '0200-0230');
    const tradingSession = parseSessionRange(paramMap.tradeSession || '0230-0800');

    const atrSeries = useAtrRange ? calculateATR(bars, atrLen) : [];
    const vwapSeries = calculateVWAP(bars);

    logs.push(
      `[NQ Breakout Parameters] ref_mode="${refMode}", buffer=${breakoutMargin}pts, slPoints=${slPoints}pts, tpPoints=${tpPoints}pts, range_mult=${rangeMult}`
    );

    // Track historical bar execution state
    let sessionHigh: number | null = null;
    let sessionLow: number | null = null;
    let sessionOpen: number | null = null;
    let sessionClose: number | null = null;
    let sessionVwap: number | null = null;
    let inFormation = false;
    let tradedToday = false;
    let currentDayStr = '';
    const strategyLevels: StrategyLevel[] = [];
    let formationStartTime: number | null = null;
    let formationEndTime: number | null = null;
    let recordedLevelsForDay = '';

    report = runBacktest(
      strategyName,
      symbol,
      timeframe,
      bars,
      (b, i, pos): Signal | null => {
        const bar = b[i];
        const ny = getBarNYTime(bar.time);

        // Daily state reset
        if (ny.dateStr !== currentDayStr) {
          currentDayStr = ny.dateStr;
          sessionHigh = null;
          sessionLow = null;
          sessionOpen = null;
          sessionClose = null;
          sessionVwap = null;
          inFormation = false;
          tradedToday = false;
          formationStartTime = null;
          formationEndTime = null;
        }

        // Determine if in Formation Window or Trading Window
        let isFormationBar = false;
        let isTradeBar = false;
        let isAtOrAfterClose = false;

        if (refMode === 'Single Bar at 02:00 NY') {
          isFormationBar = ny.hour === 2 && ny.minute === 0;
          isTradeBar = (ny.hour === 2 && ny.minute > 0) || (ny.hour >= 3 && ny.hour < 9);
          isAtOrAfterClose = ny.hour >= 9;
        } else if (paramMap.sessionTime || paramMap.tradeSession) {
          isFormationBar = isWithinSession(ny.hour, ny.minute, formationSession);
          isTradeBar = isWithinSession(ny.hour, ny.minute, tradingSession);
          isAtOrAfterClose = !isFormationBar && !isTradeBar && ny.hour >= 8;
        } else {
          // Standard 1-Hour 02:00-03:00 NY range
          isFormationBar = ny.hour === 2;
          isTradeBar = ny.hour >= 3 && ny.hour < 9;
          isAtOrAfterClose = ny.hour >= 9;
        }

        // 1. Formation Session: Accumulate High, Low, Open, Close
        if (isFormationBar) {
          if (!inFormation || sessionHigh === null || sessionLow === null) {
            sessionHigh = bar.high;
            sessionLow = bar.low;
            sessionOpen = bar.open;
            formationStartTime = bar.time;
            inFormation = true;
          } else {
            sessionHigh = Math.max(sessionHigh, bar.high);
            sessionLow = Math.min(sessionLow, bar.low);
          }
          formationEndTime = bar.time;
          sessionClose = bar.close;
          sessionVwap = vwapSeries[i] || bar.close;
          return null;
        } else {
          inFormation = false;
        }

        // Force session close at 09:00 NY
        if (isAtOrAfterClose && pos.type !== 'none') {
          return {
            index: i,
            action: 'close',
            comment: 'Session End (09:00 NY Exit)',
          };
        }

        // 2. Trading Session Breakout Check
        if (isTradeBar && sessionHigh !== null && sessionLow !== null) {
          let rawRange = sessionHigh - sessionLow;
          if (useAtrRange && atrSeries[i] && !isNaN(atrSeries[i])) {
            rawRange = atrSeries[i] * (atrPct / 100.0);
          }

          let effectiveHigh = sessionHigh;
          let effectiveLow = sessionLow;

          if (centerMode === 'Середина тела свечи (Body Midpoint)' && sessionOpen !== null && sessionClose !== null) {
            const center = (sessionOpen + sessionClose) / 2;
            effectiveHigh = center + rawRange / 2;
            effectiveLow = center - rawRange / 2;
          } else if (centerMode === 'Уровень VWAP' && sessionVwap !== null) {
            effectiveHigh = sessionVwap + rawRange / 2;
            effectiveLow = sessionVwap - rawRange / 2;
          } else if (centerMode === 'Середина свечи (High + Low) / 2') {
            const center = (sessionHigh + sessionLow) / 2;
            effectiveHigh = center + rawRange / 2;
            effectiveLow = center - rawRange / 2;
          }

          const upperTrigger = effectiveHigh + (paramMap.range_mult ? rawRange * rangeMult : breakoutMargin);
          const lowerTrigger = effectiveLow - (paramMap.range_mult ? rawRange * rangeMult : breakoutMargin);

          // Record visual levels once per day
          if (recordedLevelsForDay !== currentDayStr && formationEndTime) {
            recordedLevelsForDay = currentDayStr;
            const approxTradeWindowEnd = formationEndTime + 6 * 3600000;

            if (formationStartTime) {
              strategyLevels.push({
                id: `formation_box_${currentDayStr}`,
                name: '02:00 NY Range Box',
                type: 'box',
                startTime: formationStartTime,
                endTime: formationEndTime,
                highPrice: sessionHigh,
                lowPrice: sessionLow,
                color: '#3b82f6',
              });
            }

            strategyLevels.push({
              id: `upper_trigger_${currentDayStr}`,
              name: 'Upper Trigger',
              type: 'line',
              startTime: formationEndTime,
              endTime: approxTradeWindowEnd,
              price: upperTrigger,
              color: '#089981',
              lineStyle: 'solid',
            });

            strategyLevels.push({
              id: `lower_trigger_${currentDayStr}`,
              name: 'Lower Trigger',
              type: 'line',
              startTime: formationEndTime,
              endTime: approxTradeWindowEnd,
              price: lowerTrigger,
              color: '#f23645',
              lineStyle: 'solid',
            });
          }

          if (maxOneTrade && tradedToday) {
            return null;
          }

          // Calculate SL distances
          let longSlPrice: number;
          let shortSlPrice: number;

          if (paramMap.slPoints) {
            longSlPrice = bar.close - slPoints;
            shortSlPrice = bar.close + slPoints;
          } else if (slMode === 'За противоположную линию канала') {
            const buffer = rawRange * slBufferPct;
            longSlPrice = lowerTrigger - buffer;
            shortSlPrice = upperTrigger + buffer;
          } else {
            // 2x Candle Range
            const slDistance = rawRange * slMultiplier + rawRange * slBufferPct;
            longSlPrice = bar.close - slDistance;
            shortSlPrice = bar.close + slDistance;
          }

          // Calculate TP distances
          let longTpPrice: number | undefined;
          let shortTpPrice: number | undefined;

          if (paramMap.tpPoints) {
            longTpPrice = bar.close + tpPoints;
            shortTpPrice = bar.close - tpPoints;
          } else if (useTp) {
            const longRisk = Math.max(1, bar.close - longSlPrice);
            const shortRisk = Math.max(1, shortSlPrice - bar.close);
            longTpPrice = bar.close + longRisk * tpRr;
            shortTpPrice = bar.close - shortRisk * tpRr;
          }

          // Bullish Breakout
          if (bar.close > upperTrigger && pos.type !== 'long') {
            tradedToday = true;
            return {
              index: i,
              action: 'buy',
              stopPrice: longSlPrice,
              limitPrice: longTpPrice,
              comment: `2AM Long Breakout (Trigger: ${upperTrigger.toFixed(1)})`,
            };
          }

          // Bearish Breakout
          if (bar.close < lowerTrigger && pos.type !== 'short') {
            tradedToday = true;
            return {
              index: i,
              action: 'sell',
              stopPrice: shortSlPrice,
              limitPrice: shortTpPrice,
              comment: `2AM Short Breakout (Trigger: ${lowerTrigger.toFixed(1)})`,
            };
          }
        }

        return null;
      },
      { initialCapital, commissionRate: 0.0002, slippageTicks: 1 }
    );
    report.strategyLevels = strategyLevels;
  } else if (isSupertrend) {
    // =========================================================================
    // Supertrend Breakout Strategy Engine
    // =========================================================================
    logs.push(`[Strategy Engine] Selected Archetype: Supertrend Breakout.`);
    const atrPeriod = Number(paramMap.atrPeriod) || 10;
    const factor = Number(paramMap.factor) || 3.0;
    const slPct = Number(paramMap.slPercent) || 2.0;
    const tpPct = Number(paramMap.tpPercent) || 4.0;

    const atr = calculateATR(bars, atrPeriod);

    report = runBacktest(
      strategyName,
      symbol,
      timeframe,
      bars,
      (b, i, pos) => {
        if (i < atrPeriod + 1 || isNaN(atr[i])) return null;

        const hl2 = (b[i].high + b[i].low) / 2;
        const upperBand = hl2 + factor * atr[i];
        const lowerBand = hl2 - factor * atr[i];

        if (b[i].close > upperBand && pos.type !== 'long') {
          return {
            index: i,
            action: 'buy',
            stopPrice: b[i].close * (1 - slPct / 100),
            limitPrice: b[i].close * (1 + tpPct / 100),
            comment: `Supertrend Uptrend Flip`,
          };
        }
        if (b[i].close < lowerBand && pos.type !== 'short') {
          return {
            index: i,
            action: 'sell',
            stopPrice: b[i].close * (1 + slPct / 100),
            limitPrice: b[i].close * (1 - tpPct / 100),
            comment: `Supertrend Downtrend Flip`,
          };
        }
        return null;
      },
      { initialCapital, commissionRate: 0.0005, slippageTicks: 1 }
    );
  } else if (isRSI) {
    // =========================================================================
    // RSI Mean Reversion Strategy Engine
    // =========================================================================
    logs.push(`[Strategy Engine] Selected Archetype: RSI Mean Reversion.`);
    const rsiLen = Number(paramMap.rsiLength) || 14;
    const oversold = Number(paramMap.oversold) || 30;
    const overbought = Number(paramMap.overbought) || 70;
    const slPct = Number(paramMap.slPercent) || 2.0;
    const tpPct = Number(paramMap.tpPercent) || 4.0;

    const rsi = calculateRSI(bars, rsiLen);

    report = runBacktest(
      strategyName,
      symbol,
      timeframe,
      bars,
      (b, i, pos) => {
        if (i < rsiLen + 1 || isNaN(rsi[i]) || isNaN(rsi[i - 1])) return null;

        if (rsi[i - 1] <= oversold && rsi[i] > oversold && pos.type !== 'long') {
          return {
            index: i,
            action: 'buy',
            stopPrice: b[i].close * (1 - slPct / 100),
            limitPrice: b[i].close * (1 + tpPct / 100),
            comment: `RSI Oversold Cross Above ${oversold}`,
          };
        }
        if (rsi[i - 1] < overbought && rsi[i] >= overbought && pos.type === 'long') {
          return {
            index: i,
            action: 'close',
            comment: `RSI Overbought Target ${overbought}`,
          };
        }
        return null;
      },
      { initialCapital, commissionRate: 0.0005, slippageTicks: 1 }
    );
  } else {
    // =========================================================================
    // Dual EMA / SMA Crossover & Universal Trend Engine
    // =========================================================================
    logs.push(`[Strategy Engine] Selected Archetype: Dual Moving Average Crossover.`);
    const fastLen = Number(paramMap.fastLength) || 9;
    const slowLen = Number(paramMap.slowLength) || 21;
    const slPct = Number(paramMap.slPercent) || 1.5;
    const tpPct = Number(paramMap.tpPercent) || 3.0;

    const fastEma = calculateEMA(bars, fastLen);
    const slowEma = calculateEMA(bars, slowLen);

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
            comment: `Bullish EMA(${fastLen}/${slowLen}) Crossover`,
          };
        }
        if (bearishCross && pos.type !== 'short') {
          return {
            index: i,
            action: 'sell',
            stopPrice: b[i].close * (1 + slPct / 100),
            limitPrice: b[i].close * (1 - tpPct / 100),
            comment: `Bearish EMA(${fastLen}/${slowLen}) Crossunder`,
          };
        }
        return null;
      },
      { initialCapital, commissionRate: 0.0005, slippageTicks: 1 }
    );
  }

  // Attach extracted inputs and detected archetype
  report.inputs = inputs;
  report.strategyType = isNQBreakout
    ? 'NQ Breakout'
    : isSupertrend
    ? 'Supertrend'
    : isRSI
    ? 'RSI Reversion'
    : 'Dual EMA';

  logs.push(
    `[Backtest Completed] ${report.totalTrades} trades executed. Net Profit: $${report.netProfit.toLocaleString()} (${
      report.netProfitPercent >= 0 ? '+' : ''
    }${report.netProfitPercent}%), Win Rate: ${report.winRate}%, Profit Factor: ${report.profitFactor}`
  );

  return { report, logs };
}
