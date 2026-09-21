import React, { useEffect, useRef, useCallback } from 'react';
import { Vela } from '@luxalgo/vela';
import { PineWorkerEngine } from '@luxalgo/vela-pinets';
import { Settings, Eye, EyeOff, Zap } from 'lucide-react';
import type { Bar, Trade, StrategyLevel } from '../../types';
import { renderTradesAndLevelsOnChart } from '../../services/chartOverlayBridge';

function getTimeframeMs(tf: string): number {
  switch (tf) {
    case '1m': return 60 * 1000;
    case '3m': return 3 * 60 * 1000;
    case '5m': return 5 * 60 * 1000;
    case '15m': return 15 * 60 * 1000;
    case '30m': return 30 * 60 * 1000;
    case '1h': return 60 * 60 * 1000;
    case '4h': return 4 * 60 * 60 * 1000;
    case '1D': return 24 * 60 * 60 * 1000;
    case '1W': return 7 * 24 * 60 * 60 * 1000;
    default: return 60 * 1000;
  }
}

interface VelaChartProps {
  symbol: string;
  timeframe: string;
  bars: Bar[];
  pineScript?: string;
  trades?: Trade[];
  strategyLevels?: StrategyLevel[];
  showTradesOnChart?: boolean;
  showLevelsOnChart?: boolean;
  onIndicatorError?: (err: string) => void;
  onIndicatorSuccess?: (name: string) => void;
  onPrefetchHistory?: (targetOldestTimestamp: number, minBarsNeeded: number) => Promise<void>;
  isPrefetchingHistory?: boolean;
  strategyName?: string;
  onOpenInputs?: () => void;
  onToggleTrades?: () => void;
}

export const VelaChart: React.FC<VelaChartProps> = ({
  symbol,
  timeframe,
  bars,
  pineScript,
  trades,
  strategyLevels,
  showTradesOnChart = true,
  showLevelsOnChart = true,
  onIndicatorError,
  onIndicatorSuccess,
  onPrefetchHistory,
  isPrefetchingHistory = false,
  strategyName,
  onOpenInputs,
  onToggleTrades,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<Vela | null>(null);
  const indicatorHandleRef = useRef<any>(null);
  const overlayDrawingIdsRef = useRef<string[]>([]);
  const appliedScriptRef = useRef<string>('');
  const isPrefetchingRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<any>(null);
  const isDraggingRef = useRef<boolean>(false);
  const pendingBarsRef = useRef<any[] | null>(null);

  // Track the active market identity on the chart instance
  const activeSymbolRef = useRef<string>('');
  const activeTfRef = useRef<string>('');

  // Keep callback refs stable
  const onIndicatorErrorRef = useRef(onIndicatorError);
  onIndicatorErrorRef.current = onIndicatorError;
  const onIndicatorSuccessRef = useRef(onIndicatorSuccess);
  onIndicatorSuccessRef.current = onIndicatorSuccess;
  const onPrefetchHistoryRef = useRef(onPrefetchHistory);
  onPrefetchHistoryRef.current = onPrefetchHistory;

  // Apply any pending continuous data update without shifting camera position
  const applyPendingBars = useCallback(() => {
    if (!pendingBarsRef.current || !chartInstanceRef.current) return;
    const pending = pendingBarsRef.current;
    pendingBarsRef.current = null;

    const orchestrator = (chartInstanceRef.current as any)?.orchestrator;
    if (orchestrator && typeof orchestrator.setBarSeries === 'function') {
      try {
        orchestrator.setBarSeries(pending, { preserveView: true });
        orchestrator.notifySessionsBars?.('backfill');
      } catch (err) {
        console.warn('Deferred setBarSeries notice:', err);
      }
    }
  }, []);

  // Viewport-aware continuous prefetch engine:
  // Detects exactly how much history is visible on the canvas, detects empty space to the left,
  // and downloads enough bars to completely cover the visible field + extra buffer ("и еще немного для запаса").
  const checkPrefetchNeed = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const chart = chartInstanceRef.current;
      if (
        !chart ||
        !onPrefetchHistoryRef.current ||
        isPrefetchingRef.current ||
        isDraggingRef.current ||
        bars.length < 5
      ) {
        return;
      }

      try {
        const orchestrator = (chart as any).orchestrator;
        const coords = orchestrator?.renderer?.coords;
        if (!coords || typeof coords.visibleLogicalRange !== 'function') {
          return;
        }

        const vr = coords.visibleLogicalRange();
        if (!vr || vr.from == null || vr.to == null) {
          return;
        }

        const fromLogical = vr.from;
        const toLogical = vr.to;
        const visibleWidthBars = Math.max(10, Math.ceil(toLogical - fromLogical));

        // Threshold to trigger prefetch:
        // Either empty space is visible on the left (fromLogical < 0)
        // OR user is within buffer threshold (0.8 of visible screen width or 100 bars)
        const triggerThreshold = Math.max(100, Math.ceil(visibleWidthBars * 0.8));

        if (fromLogical <= triggerThreshold) {
          const emptyBarsOnLeft = fromLogical < 0 ? Math.ceil(-fromLogical) : 0;
          // Buffer: "и еще немного для запаса" - at least 1.5 visible screens or 600 bars
          const bufferBars = Math.max(600, Math.ceil(visibleWidthBars * 1.5));
          const totalBarsToFetch = emptyBarsOnLeft + bufferBars;

          const intervalMs = coords.intervalMs || getTimeframeMs(timeframe);
          const oldestBarTime = bars[0].time;
          const targetOldestTime = oldestBarTime - (totalBarsToFetch * intervalMs);

          if (targetOldestTime < oldestBarTime) {
            isPrefetchingRef.current = true;
            onPrefetchHistoryRef.current(targetOldestTime, totalBarsToFetch)
              .catch((err) => console.warn('Prefetch notice:', err))
              .finally(() => {
                setTimeout(() => {
                  isPrefetchingRef.current = false;
                  // Re-evaluate: if empty space is still exposed, continue prefetching next batch!
                  checkPrefetchNeed();
                }, 150);
              });
          }
        }
      } catch (err) {
        console.warn('checkPrefetchNeed notice:', err);
      }
    }, 100);
  }, [bars, timeframe]);

  // Unified Market Lifecycle & Continuous Update Engine
  useEffect(() => {
    if (!containerRef.current || bars.length === 0) return;

    const ohlcvBars = bars.map((b) => ({
      time: b.time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
    }));

    const isSameMarket =
      chartInstanceRef.current &&
      activeSymbolRef.current === symbol &&
      activeTfRef.current === timeframe;

    if (isSameMarket) {
      // If user is currently dragging with mouse, postpone applying bars until pointerup
      // so active gesture is NEVER interrupted or shifted!
      if (isDraggingRef.current) {
        pendingBarsRef.current = ohlcvBars;
        return;
      }

      // Continuous data update (prefetching older bars or live tick update):
      // We use orchestrator.setBarSeries with { preserveView: true }
      // This preserves the exact pixel X coordinates of all visible candles,
      // perfectly preserving empty space on the left WITHOUT snapping or shifting!
      const orchestrator = (chartInstanceRef.current as any)?.orchestrator;
      if (orchestrator && typeof orchestrator.setBarSeries === 'function') {
        try {
          orchestrator.setBarSeries(ohlcvBars, { preserveView: true });
          orchestrator.notifySessionsBars?.('backfill');
          setTimeout(checkPrefetchNeed, 60);
        } catch (err) {
          console.warn('orchestrator.setBarSeries notice:', err);
        }
      } else if (chartInstanceRef.current) {
        chartInstanceRef.current
          .setMarket({
            symbol,
            timeframe,
            data: ohlcvBars,
          })
          .catch(() => {});
      }

      // Re-apply indicator if script changed on same market
      if (pineScript && pineScript !== appliedScriptRef.current && chartInstanceRef.current) {
        if (indicatorHandleRef.current) {
          try {
            indicatorHandleRef.current.remove?.();
          } catch {}
          indicatorHandleRef.current = null;
        }
        // Clean up any other script indicators to ensure no duplicate legend rows
        try {
          const existingIndicators = (chartInstanceRef.current as any).indicators?.() || [];
          for (const ind of existingIndicators) {
            if (ind && ind.source) {
              try { ind.remove?.(); } catch {}
            }
          }
        } catch {}

        try {
          const isIndicatorOnly = pineScript.includes('indicator(') && !pineScript.includes('strategy(');
          if (isIndicatorOnly) {
            indicatorHandleRef.current = (chartInstanceRef.current as any).addIndicator?.(pineScript);
          }
          appliedScriptRef.current = pineScript;
          onIndicatorSuccess?.('Pine Script');
        } catch (e: any) {
          appliedScriptRef.current = pineScript;
          onIndicatorError?.(e instanceof Error ? e.message : String(e));
          console.warn('addIndicator update notice:', e);
        }
      }
      return;
    }

    // 2. Different market or initial mount: Full clean initialization
    if (chartInstanceRef.current) {
      try {
        chartInstanceRef.current.destroy?.();
      } catch (e) {
        console.warn('Error destroying previous Vela instance:', e);
      }
      chartInstanceRef.current = null;
      appliedScriptRef.current = '';
      indicatorHandleRef.current = null;
    }

    try {
      const chart = new Vela(containerRef.current, {
        symbol,
        timeframe,
        data: ohlcvBars,
        theme: 'dark',
        animations: false,
        currentPriceLine: true,
        drawings: false,
      });

      try {
        chart.registerEngine('pine', new PineWorkerEngine());
      } catch (err) {
        console.warn('PineWorkerEngine registration notice:', err);
      }

      chartInstanceRef.current = chart;
      (window as any).__velaChart = chart;
      activeSymbolRef.current = symbol;
      activeTfRef.current = timeframe;

      try {
        (chart as any).on?.('viewport:changed', () => {
          checkPrefetchNeed();
        });
      } catch (err) {
        console.warn('viewport:changed listener notice:', err);
      }
      setTimeout(checkPrefetchNeed, 100);

      try {
        (chart as any).drawings?.showToolbar?.(false);
        (chart as any).drawingsControl?.showToolbar?.(false);
      } catch {}

      try {
        chart.addNativeIndicator('volume');
      } catch {
        // volume optional
      }

      if (pineScript && pineScript.trim().length > 0) {
        const isIndicatorOnly = pineScript.includes('indicator(') && !pineScript.includes('strategy(');
        if (isIndicatorOnly) {
          try {
            const handle = chart.addIndicator(pineScript);
            indicatorHandleRef.current = handle;
            appliedScriptRef.current = pineScript;
            onIndicatorSuccess?.('Pine Script');
          } catch (err: any) {
            appliedScriptRef.current = pineScript;
            onIndicatorError?.(err);
            console.warn('Pine Script notice:', err);
          }
        } else {
          appliedScriptRef.current = pineScript;
          onIndicatorSuccess?.('Pine Script');
        }
      }
    } catch (err) {
      console.error('Failed to initialize LuxAlgo Vela chart:', err);
    }
  }, [symbol, timeframe, bars, pineScript, onIndicatorError, onIndicatorSuccess]);

  // Synchronize Trade and Strategy Level Overlays on Chart Canvas
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart || !chart.drawings) return;

    const timer = setTimeout(() => {
      if (!chartInstanceRef.current?.drawings) return;
      try {
        const newIds = renderTradesAndLevelsOnChart(
          chartInstanceRef.current,
          trades || [],
          strategyLevels || [],
          {
            showTrades: showTradesOnChart !== false,
            showLevels: showLevelsOnChart !== false,
          },
          overlayDrawingIdsRef.current
        );
        overlayDrawingIdsRef.current = newIds;
      } catch (err) {
        console.warn('Overlay rendering notice:', err);
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [trades, strategyLevels, showTradesOnChart, showLevelsOnChart, bars.length]);

  // Clean destruction on unmount
  useEffect(() => {
    return () => {
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.destroy?.();
        } catch (e) {
          console.warn('Error destroying Vela on unmount:', e);
        }
        chartInstanceRef.current = null;
        activeSymbolRef.current = '';
        activeTfRef.current = '';
        appliedScriptRef.current = '';
        indicatorHandleRef.current = null;
      }
    };
  }, []);

  // User Interaction Listeners: Pan & Zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handlePointerDown = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      isDraggingRef.current = true;
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      // 1. Apply any queued bars that arrived during active drag
      applyPendingBars();
      // 2. Check if prefetch is needed now that drag is finished
      checkPrefetchNeed();
    };

    const handlePointerCancel = () => {
      isDraggingRef.current = false;
      applyPendingBars();
    };

    const handleWheel = () => {
      checkPrefetchNeed();
    };

    el.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    el.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      el.removeEventListener('wheel', handleWheel);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [checkPrefetchNeed, applyPendingBars]);

  // Dynamic Auto-Resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.resize();
        } catch {
          // ignore
        }
      }
    });

    ro.observe(el);

    return () => {
      ro.disconnect();
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-[#131722] overflow-hidden select-none">
      {/* Chart Canvas Host */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Strategy Overlay Badge on Chart (TradingView Legend Style) */}
      {strategyName && (
        <div className="absolute top-12 left-4 z-20 flex items-center space-x-2.5 bg-[#1b202e]/90 backdrop-blur-sm border border-[#2f374a] rounded-lg px-3 py-1.5 text-sm shadow-xl">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          <Zap size={15} className="text-amber-400 flex-shrink-0" />
          <span className="font-bold text-sm text-white max-w-[320px] truncate" title={strategyName}>
            {strategyName}
          </span>
          {onOpenInputs && (
            <button
              onClick={onOpenInputs}
              className="p-1 rounded hover:bg-[#283247] text-gray-300 hover:text-blue-400 transition-colors"
              title="Настройки параметров стратегии"
            >
              <Settings size={15} />
            </button>
          )}
          {onToggleTrades && (
            <button
              onClick={onToggleTrades}
              className="p-1 rounded hover:bg-[#283247] text-gray-300 hover:text-white transition-colors"
              title={showTradesOnChart ? 'Скрыть сделки на графике' : 'Показать сделки на графике'}
            >
              {showTradesOnChart ? <Eye size={15} /> : <EyeOff size={15} className="text-gray-500" />}
            </button>
          )}
        </div>
      )}

      {/* Symbol Watermark (Positioned at bottom-left so it NEVER collides with Vela's top-left legend!) */}
      <div className="absolute bottom-8 left-8 pointer-events-none z-10 flex flex-col select-none">
        <span className="text-5xl font-black tracking-widest text-white/20">{symbol}</span>
        <div className="flex items-center space-x-2.5 mt-0.5">
          <span className="text-xs font-semibold tracking-wider text-slate-400">
            {timeframe} • Real Quotes ({bars.length.toLocaleString()} bars loaded)
          </span>
          {isPrefetchingHistory && (
            <span className="flex items-center space-x-1.5 text-amber-300 animate-pulse bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-500/50 shadow-lg text-xs font-semibold">
              <Zap size={12} className="text-amber-400 flex-shrink-0" />
              <span>Подкачка истории...</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
