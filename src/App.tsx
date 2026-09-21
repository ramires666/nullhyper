import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Bar, Timeframe, SymbolMetadata, BacktestReport, PineScriptTemplate } from './types';
import { TopNav } from './components/Header/TopNav';
import { Watchlist } from './components/Sidebar/Watchlist';
import { BottomDock } from './components/Dock/BottomDock';
import { VelaChart } from './components/Chart/VelaChart';
import { StrategySettingsModal } from './components/Modal/StrategySettingsModal';
import { PINE_TEMPLATES } from './services/pineTemplates';
import {
  fetchPineStrategies,
  savePineStrategy,
  subscribeToStrategiesChanges,
  setStoredCustomStrategiesDir,
} from './services/pineFileSystem';
import { executePineBacktest } from './services/pineBridge';
import { focusTradeOnChart } from './services/chartOverlayBridge';
import { getRealMarketBars } from './services/providers/realDataLoader';
import { fetchBinanceKlines } from './services/providers/binance';
import { fetchYahooQuotes } from './services/providers/yahoo';
import {
  db,
  saveBarsToDB,
  loadBarsFromDB,
  getDBStats,
} from './services/db';
import {
  insertBarsToDuckDB,
  queryBarsFromDuckDB,
  getDuckDBStats,
  clearDuckDBBars,
  type DuckDBStats,
} from './services/duckdb';
import {
  getStoredStrategyInputs,
  setStoredStrategyInputs,
  clearStoredStrategyInputs,
  getStoredSymbol,
  setStoredSymbol,
  getStoredTimeframe,
  setStoredTimeframe,
  getStoredActiveStrategyId,
  setStoredActiveStrategyId,
  getStoredTimezone,
  setStoredTimezone,
} from './services/settingsStorage';

const INITIAL_SYMBOLS: SymbolMetadata[] = [
  {
    symbol: 'BTCUSDT',
    name: 'Bitcoin / TetherUS',
    exchange: 'Binance',
    type: 'crypto',
    base: 'BTC',
    quote: 'USDT',
    minTick: 0.01,
    pointValue: 1,
    digits: 2,
    source: 'binance',
  },
  {
    symbol: 'ETHUSDT',
    name: 'Ethereum / TetherUS',
    exchange: 'Binance',
    type: 'crypto',
    base: 'ETH',
    quote: 'USDT',
    minTick: 0.01,
    pointValue: 1,
    digits: 2,
    source: 'binance',
  },
  {
    symbol: 'SOLUSDT',
    name: 'Solana / TetherUS',
    exchange: 'Binance',
    type: 'crypto',
    base: 'SOL',
    quote: 'USDT',
    minTick: 0.01,
    pointValue: 1,
    digits: 2,
    source: 'binance',
  },
  {
    symbol: 'NQ=F',
    name: 'E-mini Nasdaq-100 Futures',
    exchange: 'CME',
    type: 'futures',
    base: 'NQ',
    quote: 'USD',
    minTick: 0.25,
    pointValue: 20,
    digits: 2,
    source: 'yahoo',
  },
  {
    symbol: 'ES=F',
    name: 'E-mini S&P 500 Futures',
    exchange: 'CME',
    type: 'futures',
    base: 'ES',
    quote: 'USD',
    minTick: 0.25,
    pointValue: 50,
    digits: 2,
    source: 'yahoo',
  },
  {
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF Trust',
    exchange: 'NYSE',
    type: 'stock',
    base: 'SPY',
    quote: 'USD',
    minTick: 0.01,
    pointValue: 1,
    digits: 2,
    source: 'yahoo',
  },
  {
    symbol: 'QQQ',
    name: 'Invesco QQQ Trust ETF',
    exchange: 'NASDAQ',
    type: 'stock',
    base: 'QQQ',
    quote: 'USD',
    minTick: 0.01,
    pointValue: 1,
    digits: 2,
    source: 'yahoo',
  },
  {
    symbol: 'GLD',
    name: 'SPDR Gold Trust ETF',
    exchange: 'NYSE',
    type: 'stock',
    base: 'GLD',
    quote: 'USD',
    minTick: 0.01,
    pointValue: 1,
    digits: 2,
    source: 'yahoo',
  },
];

export const App: React.FC = () => {
  const [currentSymbol, setCurrentSymbol] = useState<string>(() => getStoredSymbol('NQ=F'));
  const [currentTimeframe, setCurrentTimeframe] = useState<Timeframe>(() => getStoredTimeframe('1m'));
  const [bars, setBars] = useState<Bar[]>(() => {
    const sym = getStoredSymbol('NQ=F');
    const tf = getStoredTimeframe('1m');
    return getRealMarketBars(sym, tf);
  });
  const [activeStrategyId, setActiveStrategyId] = useState<string>(() =>
    getStoredActiveStrategyId('strategy_nq_2am_breakout_orig')
  );
  const [strategyInputs, setStrategyInputs] = useState<Record<string, any>>(() => {
    const id = getStoredActiveStrategyId('strategy_nq_2am_breakout_orig');
    return getStoredStrategyInputs(id);
  });
  const [strategies, setStrategies] = useState<PineScriptTemplate[]>(PINE_TEMPLATES);
  const [activeScript, setActiveScript] = useState<string>(PINE_TEMPLATES[0].code);
  const [activeStrategiesFolder, setActiveStrategiesFolder] = useState<string>('strategies');
  const [backtestReport, setBacktestReport] = useState<BacktestReport | null>(null);
  const [compilerLogs, setCompilerLogs] = useState<string[]>([]);
  const [isBacktesting, setIsBacktesting] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [dbStats, setDbStats] = useState({ totalBars: 0, totalSymbols: 0, savedScripts: 0 });
  const [duckDBStats, setDuckDBStats] = useState<DuckDBStats>({
    totalBars: 0,
    symbolsCount: 0,
    details: [],
  });

  const [chartTimezone, setChartTimezone] = useState<string>(() =>
    getStoredTimezone('America/New_York')
  );

  const handleSelectTimezone = useCallback((tz: string) => {
    setChartTimezone(tz);
    setStoredTimezone(tz);
  }, []);

  const [showTradesOnChart, setShowTradesOnChart] = useState<boolean>(true);
  const [showLevelsOnChart] = useState<boolean>(true);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isPrefetchingHistory, setIsPrefetchingHistory] = useState<boolean>(false);
  const [isSettingsDocked, setIsSettingsDocked] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('nullhyper_settings_docked');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const isPrefetchingRef = useRef<boolean>(false);
  const pendingPrefetchTargetRef = useRef<{ targetOldestTimestamp: number; minBarsNeeded: number } | null>(null);
  const barsRef = useRef<Bar[]>(bars);
  barsRef.current = bars;
  const currentSymbolRef = useRef<string>(currentSymbol);
  const currentTimeframeRef = useRef<Timeframe>(currentTimeframe);
  const activeStrategyIdRef = useRef<string>(activeStrategyId);
  const activeScriptRef = useRef<string>(activeScript);
  const strategyInputsRef = useRef<Record<string, any>>(strategyInputs);

  currentSymbolRef.current = currentSymbol;
  currentTimeframeRef.current = currentTimeframe;
  activeStrategyIdRef.current = activeStrategyId;
  activeScriptRef.current = activeScript;
  strategyInputsRef.current = strategyInputs;

  const handleFocusTrade = useCallback((trade: any) => {
    const chart = (window as any).__velaChart;
    if (chart) {
      focusTradeOnChart(chart, trade);
    }
  }, []);

  // Load strategies from active folder & sync with disk in real time
  const loadStrategies = useCallback(async () => {
    try {
      const res = await fetchPineStrategies();
      setActiveStrategiesFolder(res.activeFolder);
      if (res.items && res.items.length > 0) {
        const folderIds = new Set(res.items.map((i) => i.id));
        const combined = [
          ...res.items,
          ...PINE_TEMPLATES.filter((b) => !folderIds.has(b.id)),
        ];
        setStrategies(combined);
        const currentId = activeStrategyIdRef.current;
        let matching = combined.find((t) => t.id === currentId || t.filename?.includes(currentId));
        if (!matching) {
          matching = combined.find(
            (t) =>
              t.filename?.includes('strategy_nq_2am_breakout_orig') ||
              t.filename?.includes('strategy_nq_2am_breakout') ||
              t.filename?.includes('nq_2am')
          );
        }
        if (matching) {
          setActiveStrategyId(matching.id);
          activeStrategyIdRef.current = matching.id;
          setActiveScript(matching.code);
          activeScriptRef.current = matching.code;
          const saved = getStoredStrategyInputs(matching.id);
          if (Object.keys(saved).length > 0) {
            strategyInputsRef.current = saved;
            setStrategyInputs(saved);
          }
        }
        return combined;
      } else {
        setStrategies(PINE_TEMPLATES);
        return PINE_TEMPLATES;
      }
    } catch (err) {
      console.warn('Could not load folder strategies:', err);
      return [];
    }
  }, []);

  useEffect(() => {
    loadStrategies();
    const unsub = subscribeToStrategiesChanges(async (data?: { event: string; filePath: string }) => {
      console.log('[App] Strategies changed on disk, refreshing strategy list...', data);
      const items = await loadStrategies();
      if (data?.filePath && items) {
        const currentId = activeStrategyIdRef.current;
        const matching = items.find(
          (t) => t.path === data.filePath || (t.filename && data.filePath.endsWith(t.filename))
        );
        if (matching && (matching.id === currentId || currentId.includes(matching.filename || ''))) {
          setActiveScript(matching.code);
          setCompilerLogs((prev) => [
            ...prev,
            `[Live Sync] File ${matching.filename} was updated on disk. Auto-recalculating strategy...`,
          ]);
        }
      }
    });
    return unsub;
  }, [loadStrategies]);

  const handleSaveStrategy = useCallback(
    async (filename: string, code: string) => {
      const result = await savePineStrategy(filename, code);
      setCompilerLogs((prev) => [
        ...prev,
        `[Pine Strategies] Successfully saved strategy file: ${result.path}`,
      ]);
      await loadStrategies();
    },
    [loadStrategies]
  );

  const handleChangeStrategiesDir = useCallback(
    async (newDir: string) => {
      setStoredCustomStrategiesDir(newDir);
      await loadStrategies();
      setCompilerLogs((prev) => [
        ...prev,
        `[Pine Strategies] Changed active strategies folder to: ${newDir || 'default (strategies/)'}`,
      ]);
    },
    [loadStrategies]
  );

  // Strategy Template Selection Handler
  const handleSelectTemplate = useCallback(
    (templateId: string) => {
      setActiveStrategyId(templateId);
      activeStrategyIdRef.current = templateId;
      setStoredActiveStrategyId(templateId);

      // Restore saved inputs for THIS template
      const savedInputs = getStoredStrategyInputs(templateId);
      strategyInputsRef.current = savedInputs;
      setStrategyInputs(savedInputs);

      const tmpl = strategies.find((t) => t.id === templateId);
      if (tmpl) {
        setActiveScript(tmpl.code);
        activeScriptRef.current = tmpl.code;
        if (bars.length > 0) {
          try {
            const { report, logs } = executePineBacktest(
              tmpl.code,
              currentSymbolRef.current,
              currentTimeframeRef.current,
              bars,
              100000,
              savedInputs
            );
            setBacktestReport(report);
            setCompilerLogs(logs);
          } catch (err: any) {
            console.warn('[Pine Backtest Error]', err);
          }
        }
      }
    },
    [strategies, bars]
  );

  // Live parameter update handler with instant auto-recalculation & persistence
  // Apply strategy parameters and recalculate strategy upon explicit confirmation ("Готово" / "Применить")
  const handleApplyStrategyParams = useCallback(
    (newParams: Record<string, any>) => {
      strategyInputsRef.current = newParams;
      setStrategyInputs(newParams);
      setStoredStrategyInputs(activeStrategyIdRef.current, newParams);

      if (bars.length > 0) {
        try {
          const { report, logs } = executePineBacktest(
            activeScriptRef.current,
            currentSymbolRef.current,
            currentTimeframeRef.current,
            bars,
            100000,
            newParams
          );
          setBacktestReport(report);
          setCompilerLogs(logs);
        } catch (err: any) {
          console.warn('[Pine Backtest Error]', err);
        }
      }
    },
    [bars]
  );

  // Single parameter update handler - saves to localStorage immediately WITHOUT triggering heavy recalculation
  const handleUpdateStrategyParam = useCallback(
    (paramId: string, value: any) => {
      const updated = { ...strategyInputsRef.current, [paramId]: value };
      strategyInputsRef.current = updated;
      setStrategyInputs(updated);
      setStoredStrategyInputs(activeStrategyIdRef.current, updated);
      // NOTE: DO NOT call executePineBacktest here!
      // User can adjust multiple parameters smoothly without freezing the main thread on 768k bars.
    },
    []
  );

  // Reset strategy parameters handler
  const handleResetStrategyParams = useCallback(() => {
    strategyInputsRef.current = {};
    setStrategyInputs({});
    clearStoredStrategyInputs(activeStrategyIdRef.current);

    if (bars.length > 0) {
      try {
        const { report, logs } = executePineBacktest(
          activeScriptRef.current,
          currentSymbolRef.current,
          currentTimeframeRef.current,
          bars,
          100000,
          {}
        );
        setBacktestReport(report);
        setCompilerLogs(logs);
      } catch (err: any) {
        console.warn('[Pine Backtest Error]', err);
      }
    }
  }, [bars]);

  // Reactive recalculation ONLY when script, bars, symbol, or timeframe changes
  useEffect(() => {
    if (bars.length === 0) return;
    const timer = setTimeout(() => {
      try {
        const { report, logs } = executePineBacktest(
          activeScript,
          currentSymbol,
          currentTimeframe,
          bars,
          100000,
          strategyInputsRef.current
        );
        setBacktestReport(report);
        setCompilerLogs(logs);
      } catch (err: any) {
        console.warn('[Pine Auto-Recalc Notice]:', err);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [activeScript, bars, currentSymbol, currentTimeframe]);


  // Keep refs updated
  currentSymbolRef.current = currentSymbol;
  currentTimeframeRef.current = currentTimeframe;

  // Update IndexedDB stats
  const refreshStats = useCallback(async () => {
    try {
      const stats = await getDBStats();
      setDbStats(stats);
    } catch {
      // ignore
    }
  }, []);

  // Update DuckDB stats
  const refreshDuckDBStats = useCallback(async () => {
    try {
      const stats = await getDuckDBStats();
      setDuckDBStats(stats);
    } catch {
      // ignore
    }
  }, []);

  // Load verified authentic market data (from DuckDB, local DB or live exchange feeds)
  const loadMarketData = useCallback(
    async (symbol: string, tf: Timeframe) => {
      // 1. For NQ (NQ=F / NQ / NQF): load the comprehensive continuous dataset (768k+ bars) from W:/algo/GEX
      const isNQ = symbol.toUpperCase().includes('NQ');
      if (isNQ) {
        try {
          const jsonPath = tf === '1m' ? '/data/nq_1m_compact.json' : `/data/nq_${tf}.json`;
          const res = await fetch(jsonPath);
          if (res.ok) {
            const raw = await res.json();
            let fullBars: Bar[] = [];
            if (tf === '1m' && Array.isArray(raw) && Array.isArray(raw[0])) {
              fullBars = raw.map((r: any[]) => ({
                time: r[0],
                open: r[1],
                high: r[2],
                low: r[3],
                close: r[4],
                volume: r[5] || 0,
              }));
            } else if (Array.isArray(raw)) {
              fullBars = raw;
            }

            if (fullBars.length > 0) {
              if (symbol === currentSymbolRef.current && tf === currentTimeframeRef.current) {
                setBars(fullBars);
              }
              insertBarsToDuckDB(symbol, tf, fullBars).then(refreshDuckDBStats).catch(() => {});
              saveBarsToDB(symbol, tf, fullBars).then(refreshStats).catch(() => {});
              return fullBars;
            }
          }
        } catch (err) {
          console.warn('[NQ GEX Dataset Loader Notice]:', err);
        }
      }

      // 2. Check DuckDB WASM in-browser columnar cache
      const duckBars = await queryBarsFromDuckDB(symbol, tf);
      if (duckBars && duckBars.length >= 200) {
        if (symbol === currentSymbolRef.current && tf === currentTimeframeRef.current) {
          setBars(duckBars);
        }
        return duckBars;
      }

      // 3. Try local IndexedDB cache
      const cached = await loadBarsFromDB(symbol, tf);
      if (cached && cached.length >= 200) {
        if (symbol === currentSymbolRef.current && tf === currentTimeframeRef.current) {
          setBars(cached);
        }
        insertBarsToDuckDB(symbol, tf, cached).then(refreshDuckDBStats).catch(() => {});
        return cached;
      }

      // 3. Fetch fresh live quotes from Binance or Yahoo Finance
      let fetched: Bar[] = [];
      try {
        const meta = INITIAL_SYMBOLS.find((s) => s.symbol === symbol);
        if (meta?.source === 'binance') {
          fetched = await fetchBinanceKlines(symbol, tf, 1000);
        } else if (meta?.source === 'yahoo') {
          fetched = await fetchYahooQuotes(symbol, tf);
        }
      } catch (err) {
        console.warn(`Could not reach live API for ${symbol}, loading verified local history:`, err);
      }

      // 4. If API is unreachable or rate limited, load verified real historical 1m data (NEVER synthetic)
      if (!fetched || fetched.length === 0) {
        fetched = getRealMarketBars(symbol, tf);
      }

      // 5. Ingest real bars into DuckDB columnar table and local DB
      if (fetched && fetched.length > 0) {
        await insertBarsToDuckDB(symbol, tf, fetched);
        await saveBarsToDB(symbol, tf, fetched);
        await Promise.all([refreshStats(), refreshDuckDBStats()]);
      }

      if (symbol === currentSymbolRef.current && tf === currentTimeframeRef.current) {
        setBars(fetched);
      }
      return fetched;
    },
    [refreshStats, refreshDuckDBStats]
  );

  // Synchronous and immediate symbol selection (ZERO delay, real bars instantly loaded)
  const handleSelectSymbol = useCallback(
    (sym: string) => {
      if (sym === currentSymbolRef.current) return;
      currentSymbolRef.current = sym;
      setCurrentSymbol(sym);
      setStoredSymbol(sym);

      // 1. Immediately switch bars to the authentic dataset for the new symbol
      const initialBars = getRealMarketBars(sym, currentTimeframeRef.current);
      setBars(initialBars);

      // 2. Run Pine Script backtest immediately on authentic bars with current strategy inputs!
      if (initialBars.length > 0) {
        const { report, logs } = executePineBacktest(
          activeScript,
          sym,
          currentTimeframeRef.current,
          initialBars,
          100000,
          strategyInputsRef.current
        );
        setBacktestReport(report);
        setCompilerLogs(logs);
      }

      // 3. Asynchronously load cached DB or fetch latest live quotes
      loadMarketData(sym, currentTimeframeRef.current);
    },
    [activeScript, loadMarketData]
  );

  // Synchronous and immediate timeframe selection
  const handleSelectTimeframe = useCallback(
    (tf: Timeframe) => {
      if (tf === currentTimeframeRef.current) return;
      currentTimeframeRef.current = tf;
      setCurrentTimeframe(tf);
      setStoredTimeframe(tf);

      // 1. Immediately resample authentic 1m data to new timeframe
      const initialBars = getRealMarketBars(currentSymbolRef.current, tf);
      setBars(initialBars);

      // 2. Asynchronously check DB / live (setBars inside loadMarketData triggers debounced backtest)
      loadMarketData(currentSymbolRef.current, tf);
    },
    [activeScript, loadMarketData]
  );

  // Proactive background prefetching when panning/zooming backwards
  const handlePrefetchHistory = useCallback(
    async (targetOldestTimestamp: number, minBarsNeeded: number = 1000) => {
      const currentBars = barsRef.current;
      if (
        currentBars.length === 0 ||
        currentBars.length >= 50000 ||
        currentSymbolRef.current.toUpperCase().includes('NQ')
      ) {
        return;
      }

      const currentOldestTime = currentBars[0].time;
      if (currentOldestTime <= targetOldestTimestamp) {
        return;
      }

      if (isPrefetchingRef.current) {
        if (
          !pendingPrefetchTargetRef.current ||
          targetOldestTimestamp < pendingPrefetchTargetRef.current.targetOldestTimestamp
        ) {
          pendingPrefetchTargetRef.current = { targetOldestTimestamp, minBarsNeeded };
        }
        return;
      }

      isPrefetchingRef.current = true;
      setIsPrefetchingHistory(true);

      try {
        let currentOldest = currentBars[0].time;
        const accumulatedBars: Bar[] = [];
        const sym = currentSymbolRef.current;
        const tf = currentTimeframeRef.current;
        const meta = INITIAL_SYMBOLS.find((s) => s.symbol === sym);
        const source = meta?.source || 'binance';
        let batchCount = 0;
        const MAX_BATCHES = 12; // Fetch up to 12,000 bars in a single continuous wave

        while (
          currentOldest > targetOldestTimestamp &&
          accumulatedBars.length < minBarsNeeded &&
          batchCount < MAX_BATCHES
        ) {
          let batch: Bar[] = [];
          if (source === 'binance') {
            batch = await fetchBinanceKlines(sym, tf, 1000, currentOldest - 1);
            if (!batch || batch.length === 0) {
              break;
            }
            for (const b of batch) accumulatedBars.push(b);
            let batchMinTime = batch[0].time;
            for (let i = 1; i < batch.length; i++) {
              if (batch[i].time < batchMinTime) batchMinTime = batch[i].time;
            }
            if (batchMinTime >= currentOldest) {
              break;
            }
            currentOldest = batchMinTime;
            batchCount++;
            if (batch.length < 1000) {
              break;
            }
          } else if (source === 'yahoo') {
            const fromMs = targetOldestTimestamp;
            const toMs = currentOldest - 1000;
            batch = await fetchYahooQuotes(sym, tf, fromMs, toMs);
            if (batch && batch.length > 0) {
              for (const b of batch) accumulatedBars.push(b);
              let minT = batch[0].time;
              for (let i = 1; i < batch.length; i++) {
                if (batch[i].time < minT) minT = batch[i].time;
              }
              currentOldest = minT;
            }
            break;
          } else {
            break;
          }
        }

        if (accumulatedBars.length > 0) {
          const byTime = new Map<number, Bar>();
          for (const b of accumulatedBars) byTime.set(b.time, b);
          for (const b of barsRef.current) byTime.set(b.time, b);

          const merged = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
          barsRef.current = merged;

          await insertBarsToDuckDB(sym, tf, merged);
          await saveBarsToDB(sym, tf, merged);
          await Promise.all([refreshStats(), refreshDuckDBStats()]);

          setBars(merged);
          setCompilerLogs((prev) => [
            ...prev.slice(-40),
            `[Continuous Data Engine] DuckDB ingested ${accumulatedBars.length} real bars. Total continuous depth: ${merged.length.toLocaleString()} bars.`,
          ]);

          // Re-calculate Pine Script strategy over extended history
          if (activeScriptRef.current && merged.length > 0) {
            try {
              const { report } = executePineBacktest(
                activeScriptRef.current,
                sym,
                tf,
                merged,
                100000,
                strategyInputsRef.current
              );
              setBacktestReport(report);
            } catch (err: any) {
              console.warn('Prefetch backtest error:', err);
            }
          }
        }
      } catch (err: any) {
        console.warn('Continuous history prefetch notice:', err);
      } finally {
        isPrefetchingRef.current = false;
        setIsPrefetchingHistory(false);

        // Process queued prefetch if user panned further while downloading
        if (pendingPrefetchTargetRef.current) {
          const next = pendingPrefetchTargetRef.current;
          pendingPrefetchTargetRef.current = null;
          if (barsRef.current.length > 0 && barsRef.current[0].time > next.targetOldestTimestamp) {
            handlePrefetchHistory(next.targetOldestTimestamp, next.minBarsNeeded);
          }
        }
      }
    },
    [refreshStats, refreshDuckDBStats]
  );

  const handleIndicatorError = useCallback((err: string) => {
    setCompilerLogs((p) => [...p.slice(-40), `[Vela Indicator Error] ${err}`]);
  }, []);

  const handleIndicatorSuccess = useCallback((name: string) => {
    // Stable no-op to avoid infinite re-render cycles
    console.log(`[Vela Engine] Attached indicator: ${name}`);
  }, []);

  // Initial load and DuckDB database seeding
  useEffect(() => {
    let isMounted = true;

    // Seed DuckDB table 'market_bars' with authentic data across all initial symbols
    const seedDuckDB = async () => {
      try {
        const currentStats = await getDuckDBStats();
        if (currentStats.totalBars < 5000) {
          console.log('[DuckDB Engine] Ingesting all authentic market symbols into market_bars table...');
          for (const sym of INITIAL_SYMBOLS) {
            const bars1m = getRealMarketBars(sym.symbol, '1m');
            if (bars1m.length > 0) {
              await insertBarsToDuckDB(sym.symbol, '1m', bars1m);
              await saveBarsToDB(sym.symbol, '1m', bars1m);
            }
            const bars1h = getRealMarketBars(sym.symbol, '1h');
            if (bars1h.length > 0) {
              await insertBarsToDuckDB(sym.symbol, '1h', bars1h);
              await saveBarsToDB(sym.symbol, '1h', bars1h);
            }
          }
        }
        if (isMounted) {
          await Promise.all([refreshStats(), refreshDuckDBStats()]);
          setCompilerLogs((prev) => [
            ...prev,
            `[DuckDB Engine] Operational. Market quotes ingested into in-browser table 'market_bars'.`,
          ]);
        }
      } catch (err) {
        console.warn('[DuckDB Seeding Notice]:', err);
      }
    };

    const seedTimer = setTimeout(seedDuckDB, 2000);

    const initialBars = getRealMarketBars(currentSymbol, currentTimeframe);
    if (initialBars.length > 0) {
      const { report, logs } = executePineBacktest(
        activeScript,
        currentSymbol,
        currentTimeframe,
        initialBars
      );
      setBacktestReport(report);
      setCompilerLogs(logs);
    }

    loadMarketData(currentSymbol, currentTimeframe);

    return () => {
      isMounted = false;
      clearTimeout(seedTimer);
    };
  }, []);

  // Execute Backtest on Demand
  const handleRunBacktest = useCallback(() => {
    if (bars.length === 0) return;
    setIsBacktesting(true);

    setTimeout(() => {
      try {
        const { report, logs } = executePineBacktest(
          activeScript,
          currentSymbol,
          currentTimeframe,
          bars,
          100000,
          strategyInputsRef.current
        );
        setBacktestReport(report);
        setCompilerLogs(logs);
      } catch (err: any) {
        setCompilerLogs((prev) => [...prev, `[Compiler Error] ${err?.message || String(err)}`]);
      } finally {
        setIsBacktesting(false);
      }
    }, 150);
  }, [bars, activeScript, currentSymbol, currentTimeframe]);


  // On-demand quote download into DuckDB
  const handleDownloadQuotes = async (symbol: string, source: 'binance' | 'yahoo', tf: string) => {
    setIsDownloading(true);
    setCompilerLogs((prev) => [
      ...prev,
      `[Data Ingestion] Requesting historical quotes for ${symbol} via ${source}...`,
    ]);

    try {
      let downloaded: Bar[] = [];
      if (source === 'binance') {
        downloaded = await fetchBinanceKlines(symbol, tf as Timeframe, 1000);
      } else {
        downloaded = await fetchYahooQuotes(symbol, tf as Timeframe);
      }

      if (downloaded.length > 0) {
        await insertBarsToDuckDB(symbol, tf as Timeframe, downloaded);
        await saveBarsToDB(symbol, tf as Timeframe, downloaded);
        await Promise.all([refreshStats(), refreshDuckDBStats()]);
        setCompilerLogs((prev) => [
          ...prev,
          `[Data Ingestion] Successfully cached ${downloaded.length} bars for ${symbol} (${tf}) into DuckDB table 'market_bars'.`,
        ]);
        if (symbol === currentSymbol) {
          setBars(downloaded);
        }
      }
    } catch (err: any) {
      setCompilerLogs((prev) => [
        ...prev,
        `[Data Ingestion Error] Failed to fetch quotes: ${err?.message || String(err)}`,
      ]);
    } finally {
      setIsDownloading(false);
    }
  };

  // Clear DuckDB and local DB cache
  const handleClearCache = async () => {
    if (confirm('Are you sure you want to clear DuckDB and local quote caches?')) {
      await Promise.all([db.bars.clear(), clearDuckDBBars()]);
      await Promise.all([refreshStats(), refreshDuckDBStats()]);
      setCompilerLogs((prev) => [...prev, '[Database] DuckDB and local quotes cache purged successfully.']);
      loadMarketData(currentSymbol, currentTimeframe);
    }
  };

  const latestBar = bars.length > 0 ? bars[bars.length - 1] : undefined;

  return (
    <div className="w-full h-full flex flex-col bg-[#131722] text-[#d1d4dc] overflow-hidden select-none">
      {/* 1. Top Navigation Bar */}
      <TopNav
        currentSymbol={currentSymbol}
        currentTimeframe={currentTimeframe}
        onSelectSymbol={handleSelectSymbol}
        onSelectTimeframe={handleSelectTimeframe}
        onRunBacktest={handleRunBacktest}
        availableSymbols={INITIAL_SYMBOLS}
        isBacktesting={isBacktesting}
        onOpenInputs={() => setIsSettingsModalOpen(true)}
        inputsCount={backtestReport?.inputs?.length}
        activeStrategyName={
          backtestReport?.strategyName ||
          strategies.find((s) => s.id === activeStrategyId)?.title ||
          strategies.find((s) => s.id === activeStrategyId)?.name
        }
        activeStrategyType={backtestReport?.strategyType}
        strategies={strategies}
        selectedTemplateId={activeStrategyId}
        onSelectTemplate={handleSelectTemplate}
        chartTimezone={chartTimezone}
        onSelectTimezone={handleSelectTimezone}
      />

      {/* 2. Middle Main Workspace (Vela Chart + Strategy Settings Panel + Watchlist) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Center: LuxAlgo Vela WebGL2 Chart Canvas */}
        <main className="flex-1 h-full relative overflow-hidden bg-[#131722]">
          <VelaChart
            symbol={currentSymbol}
            timeframe={currentTimeframe}
            bars={bars}
            pineScript={activeScript}
            trades={backtestReport?.trades}
            strategyLevels={backtestReport?.strategyLevels}
            showTradesOnChart={showTradesOnChart}
            showLevelsOnChart={showLevelsOnChart}
            onIndicatorError={handleIndicatorError}
            onIndicatorSuccess={handleIndicatorSuccess}
            onPrefetchHistory={handlePrefetchHistory}
            isPrefetchingHistory={isPrefetchingHistory}
            strategyName={
              backtestReport?.strategyName ||
              strategies.find((s) => s.id === activeStrategyId)?.title ||
              strategies.find((s) => s.id === activeStrategyId)?.name
            }
            onOpenInputs={() => setIsSettingsModalOpen(true)}
            onToggleTrades={() => setShowTradesOnChart((p) => !p)}
            timezone={chartTimezone}
          />
        </main>

        {/* Strategy Settings Docked Side Panel (100% visible chart, zero overlap) */}
        {isSettingsModalOpen && isSettingsDocked && (
          <StrategySettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            strategyName={
              backtestReport?.strategyName ||
              strategies.find((s) => s.id === activeStrategyId)?.title ||
              strategies.find((s) => s.id === activeStrategyId)?.name
            }
            strategyType={backtestReport?.strategyType}
            inputs={backtestReport?.inputs}
            strategyInputs={strategyInputs}
            onApplyStrategyParams={handleApplyStrategyParams}
            onUpdateStrategyParam={handleUpdateStrategyParam}
            onResetStrategyParams={handleResetStrategyParams}
            backtestReport={backtestReport}
            isDocked={true}
            onToggleDock={() => {
              setIsSettingsDocked(false);
              try { localStorage.setItem('nullhyper_settings_docked', 'false'); } catch {}
            }}
          />
        )}

        {/* Right Watchlist & Inspector */}
        <Watchlist
          symbols={INITIAL_SYMBOLS}
          activeSymbol={currentSymbol}
          onSelectSymbol={handleSelectSymbol}
          latestBar={latestBar}
        />
      </div>

      {/* 3. Bottom Collapsible Dock (Pine Editor, Strategy Tester, DuckDB Data Manager, Console) */}
      <BottomDock
        activeScript={activeScript}
        onChangeScript={setActiveScript}
        onRunBacktest={handleRunBacktest}
        backtestReport={backtestReport}
        compilerLogs={compilerLogs}
        dbStats={dbStats}
        duckDBStats={duckDBStats}
        onRefreshDuckDB={refreshDuckDBStats}
        onDownloadQuotes={handleDownloadQuotes}
        onClearCache={handleClearCache}
        isDownloading={isDownloading}
        currentSymbol={currentSymbol}
        onSelectSymbol={handleSelectSymbol}
        templates={strategies}
        activeFolder={activeStrategiesFolder}
        onRefreshStrategies={loadStrategies}
        onSaveStrategy={handleSaveStrategy}
        onChangeStrategiesDir={handleChangeStrategiesDir}
        strategyInputs={strategyInputs}
        onUpdateStrategyParam={handleUpdateStrategyParam}
        onResetStrategyParams={handleResetStrategyParams}
        onSelectTemplate={handleSelectTemplate}
        selectedTemplateId={activeStrategyId}
        showTradesOnChart={showTradesOnChart}
        onToggleShowTrades={() => setShowTradesOnChart((p) => !p)}
        onFocusTrade={handleFocusTrade}
        isSettingsOpen={isSettingsModalOpen}
        onToggleSettings={setIsSettingsModalOpen}
      />

      {/* 4. Strategy Settings Floating Window (NO dark backdrop, draggable anywhere, 100% visible chart) */}
      {isSettingsModalOpen && !isSettingsDocked && (
        <StrategySettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          strategyName={
            backtestReport?.strategyName ||
            strategies.find((s) => s.id === activeStrategyId)?.title ||
            strategies.find((s) => s.id === activeStrategyId)?.name
          }
          strategyType={backtestReport?.strategyType}
          inputs={backtestReport?.inputs}
          strategyInputs={strategyInputs}
          onApplyStrategyParams={handleApplyStrategyParams}
          onUpdateStrategyParam={handleUpdateStrategyParam}
          onResetStrategyParams={handleResetStrategyParams}
          backtestReport={backtestReport}
          isDocked={false}
          onToggleDock={() => {
            setIsSettingsDocked(true);
            try { localStorage.setItem('nullhyper_settings_docked', 'true'); } catch {}
          }}
        />
      )}
    </div>
  );
};


export default App;
