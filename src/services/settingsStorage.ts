import type { Timeframe } from '../types';

const STRATEGY_INPUTS_PREFIX = 'nullhyper_strategy_inputs_';
const LAST_INPUTS_KEY = 'nullhyper_last_strategy_inputs';
const SYMBOL_KEY = 'nullhyper_current_symbol';
const TIMEFRAME_KEY = 'nullhyper_current_timeframe';
const STRATEGY_ID_KEY = 'nullhyper_active_strategy_id';

/**
 * Get persisted inputs for a specific strategy, with fallback to last used inputs
 */
export function getStoredStrategyInputs(strategyId: string): Record<string, any> {
  try {
    if (typeof window === 'undefined') return {};
    const specific = localStorage.getItem(`${STRATEGY_INPUTS_PREFIX}${strategyId}`);
    if (specific) {
      return JSON.parse(specific);
    }
    const last = localStorage.getItem(LAST_INPUTS_KEY);
    if (last) {
      return JSON.parse(last);
    }
  } catch (err) {
    console.warn('[settingsStorage] Error reading strategy inputs:', err);
  }
  return {};
}

/**
 * Persist strategy inputs to localStorage both for this specific strategy and as last used
 */
export function setStoredStrategyInputs(strategyId: string, inputs: Record<string, any>): void {
  try {
    if (typeof window === 'undefined') return;
    const serialized = JSON.stringify(inputs);
    localStorage.setItem(`${STRATEGY_INPUTS_PREFIX}${strategyId}`, serialized);
    localStorage.setItem(LAST_INPUTS_KEY, serialized);
  } catch (err) {
    console.warn('[settingsStorage] Error saving strategy inputs:', err);
  }
}

/**
 * Remove stored inputs for a strategy (used on reset)
 */
export function clearStoredStrategyInputs(strategyId: string): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(`${STRATEGY_INPUTS_PREFIX}${strategyId}`);
    localStorage.removeItem(LAST_INPUTK);
  } catch (err) {
    console.warn('[settingsStorage] Error clearing strategy inputs:', err);
  }
}

const LAST_INPUTK = LAST_INPUTS_KEY;

/**
 * Symbol persistence
 */
export function getStoredSymbol(defaultSymbol: string = 'NQ=F'): string {
  try {
    if (typeof window === 'undefined') return defaultSymbol;
    return localStorage.getItem(SYMBOL_KEY) || defaultSymbol;
  } catch {
    return defaultSymbol;
  }
}

export function setStoredSymbol(symbol: string): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SYMBOL_KEY, symbol);
  } catch {}
}

/**
 * Timeframe persistence
 */
export function getStoredTimeframe(defaultTf: Timeframe = '1m'): Timeframe {
  try {
    if (typeof window === 'undefined') return defaultTf;
    const tf = localStorage.getItem(TIMEFRAME_KEY) as Timeframe;
    if (tf && ['1m', '5m', '15m', '1h', '4h', '1D', '1W'].includes(tf)) {
      return tf;
    }
    return defaultTf;
  } catch {
    return defaultTf;
  }
}

export function setStoredTimeframe(tf: Timeframe): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TIMEFRAME_KEY, tf);
  } catch {}
}

/**
 * Active strategy ID persistence
 */
export function getStoredActiveStrategyId(defaultId: string = 'strategy_nq_2am_breakout_orig'): string {
  try {
    if (typeof window === 'undefined') return defaultId;
    return localStorage.getItem(STRATEGY_ID_KEY) || defaultId;
  } catch {
    return defaultId;
  }
}

export function setStoredActiveStrategyId(id: string): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STRATEGY_ID_KEY, id);
  } catch {}
}

const TIMEZONE_KEY = 'nullhyper_chart_timezone';

export function getStoredTimezone(defaultTz: string = 'America/New_York'): string {
  try {
    if (typeof window === 'undefined') return defaultTz;
    return localStorage.getItem(TIMEZONE_KEY) || defaultTz;
  } catch {
    return defaultTz;
  }
}

export function setStoredTimezone(tz: string): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TIMEZONE_KEY, tz);
  } catch {}
}
