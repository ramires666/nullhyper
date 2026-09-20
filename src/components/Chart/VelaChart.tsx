import React, { useEffect, useRef, useCallback } from 'react';
import { Vela } from '@luxalgo/vela';
import { PineWorkerEngine } from '@luxalgo/vela-pinets';
import type { Bar } from '../../types';

interface VelaChartProps {
  symbol: string;
  timeframe: string;
  bars: Bar[];
  pineScript?: string;
  onIndicatorError?: (err: string) => void;
  onIndicatorSuccess?: (name: string) => void;
  onPrefetchHistory?: (oldestTimestamp: number) => Promise<void>;
}

export const VelaChart: React.FC<VelaChartProps> = ({
  symbol,
  timeframe,
  bars,
  pineScript,
  onIndicatorError,
  onIndicatorSuccess,
  onPrefetchHistory,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<Vela | null>(null);
  const indicatorHandleRef = useRef<any>(null);
  const appliedScriptRef = useRef<string>('');
  const isPrefetchingRef = useRef<boolean>(false);
  const lastPrefetchedTimeRef = useRef<number>(0);
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

  // Debounced prefetch check: ONLY checks when user is NOT actively dragging
  const checkPrefetchNeed = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const chart = chartInstanceRef.current;
      if (!chart || !onPrefetchHistoryRef.current || isPrefetchingRef.current || isDraggingRef.current || bars.length < 50) {
        return;
      }

      try {
        const orchestrator = (chart as any).orchestrator;
        const coords = orchestrator?.renderer?.coords;
        const oldestBarTime = bars[0].time;
        let shouldPrefetch = false;

        // Check exact coordinate system logical range (includes empty space to the left!)
        if (coords && typeof coords.visibleLogicalRange === 'function') {
          const vr = coords.visibleLogicalRange();
          // vr.from <= 30 means within 30 bars of the oldest loaded bar or empty space on left!
          if (vr && vr.from <= 30) {
            shouldPrefetch = true;
          }
        } else {
          const range = chart.getVisibleRange?.();
          if (range && range.from != null && range.to != null) {
            const windowWidth = range.to - range.from;
            if (range.from <= oldestBarTime + windowWidth * 0.25) {
              shouldPrefetch = true;
            }
          }
        }

        if (shouldPrefetch && oldestBarTime !== lastPrefetchedTimeRef.current) {
          isPrefetchingRef.current = true;
          lastPrefetchedTimeRef.current = oldestBarTime;

          onPrefetchHistoryRef.current(oldestBarTime)
            .catch((err) => console.warn('Prefetch notice:', err))
            .finally(() => {
              setTimeout(() => {
                isPrefetchingRef.current = false;
              }, 300);
            });
        }
      } catch {
        // ignore
      }
    }, 180);
  }, [bars]);

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
            (chartInstanceRef.current as any).removeIndicator?.(indicatorHandleRef.current);
          } catch {}
        }
        try {
          indicatorHandleRef.current = (chartInstanceRef.current as any).addIndicator?.(pineScript);
          appliedScriptRef.current = pineScript;
        } catch (e) {
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
      });

      try {
        chart.registerEngine('pine', new PineWorkerEngine());
      } catch (err) {
        console.warn('PineWorkerEngine registration notice:', err);
      }

      chartInstanceRef.current = chart;
      activeSymbolRef.current = symbol;
      activeTfRef.current = timeframe;

      try {
        chart.addNativeIndicator('volume');
      } catch {
        // volume optional
      }

      if (pineScript && pineScript.trim().length > 0) {
        try {
          const handle = chart.addIndicator(pineScript);
          indicatorHandleRef.current = handle;
          appliedScriptRef.current = pineScript;
        } catch (err: any) {
          console.error('Pine Script Error:', err);
        }
      }
    } catch (err) {
      console.error('Failed to initialize LuxAlgo Vela chart:', err);
    }
  }, [symbol, timeframe, bars, pineScript]);

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

      {/* Symbol Watermark (Positioned at bottom-left so it NEVER collides with Vela's top-left legend!) */}
      <div className="absolute bottom-8 left-8 pointer-events-none z-10 flex flex-col opacity-20 select-none">
        <span className="text-5xl font-black tracking-widest text-white">{symbol}</span>
        <span className="text-xs font-semibold tracking-wider text-slate-300">
          {timeframe} • Real Quotes ({bars.length.toLocaleString()} bars loaded)
        </span>
      </div>
    </div>
  );
};
