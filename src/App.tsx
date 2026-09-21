import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Bar, Timeframe, SymbolMetadata, BacktestReport, PineScriptTemplate } from './types';
import { TopNav } from './components/Header/TopNav';
import { Watchlist } from './components/Sidebar/Watchlist';
import { BottomDock } from './components/Dock/BottomDock';
import { VelaChart } from './components/Chart/VelaChart';
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
  const [currentSymbol, setCurrentSymbol] = useState<string>('BTCUSDT');
  const [currentTimeframe, setCurrentTimeframe] = useState<Timeframe>('1h');
  const [bars, setBars] = useState<Bar[]>(() => getRealMarketBars('BTCUSDT', '1h'));
  const [activeScript, setActiveScript] = useState<string>(PINE_TEMPLATES[0].code);
  const [activeStrategyId, setActiveStrategyId] = useState<string>(PINE_TEMPLATES[0].id);
  const [strategyInputs, setStrategyInputs] = useState<Record<string, any>>({});
  const [strategies, setStrategies] = useState<PineScriptTemplate[]>(PINE_TEMPLATES);
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

  const [showTradesOnChart, setShowTradesOnChart] = useState<boolean>(true);
  const [showLevelsOnChart, setShowLevelsOnChart] = useState<boolean>(true);

  const isPrefetchingRef = useRef<boolean>(false);
  const currentSymbolRef = useRef<string>('BTCUSDT');
  const currentTimeframeRef = useRef<Timeframe>('1h');
  const activeStrategyIdRef = useRef<string>(PINE_TEMPLATES[0].id);
  const strategyInputsRef = useRef<Record<string, any>>({});

  activeStrategyIdRef.current = activeStrategyId;
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
      setStrategyInputs({});
      const tmpl = strategies.find((t) => t.id === templateId);
      if (tmpl) {
        setActiveScript(tmpl.code);
        if (bars.length > 0) {
          try {
            const { report, logs } = executePineBacktest(
              tmpl.code,
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
      }
    },
    [strategies, bars]
  );

  // Live parameter update handler with instant auto-recalculation
  const handleUpdateStrategyParam = useCallback(
    (paramId: string, value: any) => {
      setStrategyInputs((prev) => {
        const updated = { ...prev, [paramId]: value };
        if (bars.length > 0) {
          try {
            const { report, logs } = executePineBacktest(
              activeScript,
              currentSymbolRef.current,
              currentTimeframeRef.current,
              bars,
              100000,
              updated
            );
            setBacktestReport(report);
            setCompilerLogs(logs);
          } catch (err: any) {
            console.warn('[Pine Backtest Error]', err);
          }
        }
        return updated;
      });
    },
    [activeScript, bars]
  );

  // Reset strategy parameters handler
  const handleResetStrategyParams = useCallback(() => {
    setStrategyInputs({});
    if (bars.length > 0) {
      try {
        const { report, logs } = executePineBacktest(
          activeScript,
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
  }, [activeScript, bars]);

  // Debounced auto-recalculation when activeScript or bars change
  useEffect(() => {
    if (bars.length === 0) return;
    const timer = setTimeout(() => {
      try {
        const { report, logs } = executePineBacktest(
          activeScript,
          currentSymbolRef.current,
          currentTimeframeRef.current,
          bars,
          100000,
          strategyInputsRef.current
        );
        setBacktestReport(report);
        setCompilerLogs(logs);
      } catch (err: any) {
        console.warn('[Pine Debounce Auto-Recalc Notice]:', err);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [activeScript, bars]);


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
      // 1. First check DuckDB WASM in-browser columnar cache
      const duckBars = await queryBarsFromDuckDB(symbol, tf);
      if (duckBars && duckBars.length >= 200) {
        if (symbol === currentSymbolRef.current && tf === currentTimeframeRef.current) {
          setBars(duckBars);
        }
        return duckBars;
      }

      // 2. Try local IndexedDB cache
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

      // 1. Immediately switch bars to the authentic dataset for the new symbol
      const initialBars = getRealMarketBars(sym, currentTimeframeRef.current);
      setBars(initialBars);

      // 2. Run Pine Script backtest immediately on authentic bars
      if (initialBars.length > 0) {
        const { report, logs } = executePineBacktest(
          activeScript,
          sym,
          currentTimeframeRef.current,
          initialBars
        );
        setBacktestReport(report);
        setCompilerLogs(logs);
      }

      // 3. Asynchronously load cached DB or fetch latest live quotes
      loadMarketData(sym, currentTimeframeRef.current).then((freshBars) => {
        if (freshBars && freshBars.length > 0 && currentSymbolRef.current === sym) {
          const { report, logs } = executePineBacktest(
            activeScript,
            sym,
            currentTimeframeRef.current,
            freshBars
          );
          setBacktestReport(report);
          setCompilerLogs(logs);
        }
      });
    },
    [activeScript, loadMarketData]
  );

  // Synchronous and immediate timeframe selection
  const handleSelectTimeframe = useCallback(
    (tf: Timeframe) => {
      if (tf === currentTimeframeRef.current) return;
      currentTimeframeRef.current = tf;
      setCurrentTimeframe(tf);

      // 1. Immediately resample authentic 1m data to new timeframe
      const initialBars = getRealMarketBars(currentSymbolRef.current, tf);
      setBars(initialBars);

      // 2. Run backtest
      if (initialBars.length > 0) {
        const { report, logs } = executePineBacktest(
          activeScript,
          currentSymbolRef.current,
          tf,
          initialBars
        );
        setBacktestReport(report);
        setCompilerLogs(logs);
      }

      // 3. Asynchronously check DB / live
      loadMarketData(currentSymbolRef.current, tf).then((freshBars) => {
        if (freshBars && freshBars.length > 0 && currentTimeframeRef.current === tf) {
          const { report, logs } = executePineBacktest(
            activeScript,
            currentSymbolRef.current,
            tf,
            freshBars
          );
          setBacktestReport(report);
          setCompilerLogs(logs);
        }
      });
    },
    [activeScript, loadMarketData]
  );

  // Proactive background prefetching when panning/zooming backwards
  const handlePrefetchHistory = useCallback(
    async (oldestTimestamp: number) => {
      if (isPrefetchingRef.current || bars.length === 0) return;
      isPrefetchingRef.current = true;

      try {
        let olderBars: Bar[] = [];
        const meta = INITIAL_SYMBOLS.find((s) => s.symbol === currentSymbol);

        if (meta?.source === 'binance') {
          // Fetch previous 1,000 bars from Binance
          olderBars = await fetchBinanceKlines(currentSymbol, currentTimeframe, 1000, oldestTimestamp - 1);
        } else if (meta?.source === 'yahoo') {
          const windowMs = 30 * 86400 * 1000;
          olderBars = await fetchYahooQuotes(
            currentSymbol,
            currentTimeframe,
            oldestTimestamp - windowMs,
            oldestTimestamp - 1000
          );
        }

        if (olderBars && olderBars.length > 0) {
          // Merge and deduplicate
          const byTime = new Map<number, Bar>();
          for (const b of olderBars) byTime.set(b.time, b);
          for (const b of bars) byTime.set(b.time, b);

          const merged = Array.from(byTime.values()).sort((a, b) => a.time - b.time);

          await insertBarsToDuckDB(currentSymbol, currentTimeframe, merged);
          await saveBarsToDB(currentSymbol, currentTimeframe, merged);
          await Promise.all([refreshStats(), refreshDuckDBStats()]);

          setBars(merged);
          setCompilerLogs((prev) => [
            ...prev.slice(-40),
            `[Continuous Data Engine] DuckDB ingested ${olderBars.length} real bars. Total continuous depth: ${merged.length.toLocaleString()} bars.`,
          ]);
        }
      } catch (err: any) {
        console.warn('Continuous history prefetch notice:', err);
      } finally {
        isPrefetchingRef.current = false;
      }
    },
    [bars, currentSymbol, currentTimeframe, refreshStats, refreshDuckDBStats]
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

    seedDuckDB();

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

    loadMarketData(currentSymbol, currentTimeframe).then((loadedBars) => {
      if (loadedBars && loadedBars.length > 0) {
        const { report, logs } = executePineBacktest(
          activeScript,
          currentSymbol,
          currentTimeframe,
          loadedBars
        );
        setBacktestReport(report);
        setCompilerLogs(logs);
      }
    });

    return () => {
      isMounted = false;
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
      />

      {/* 2. Middle Main Workspace (Vela Chart + Watchlist) */}
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
          />
        </main>

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
      />
    </div>
  );
};


export default App;
