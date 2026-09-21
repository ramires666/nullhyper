import React, { useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import {
  Code,
  LineChart,
  Database,
  Terminal,
  Play,
  TrendingUp,
  TrendingDown,
  ChevronUp,
  ChevronDown,
  Trash2,
  Download,
  Maximize2,
  Minimize2,
  RefreshCw,
  FolderOpen,
  Save,
  Settings,
} from 'lucide-react';
import type { BacktestReport, PineScriptTemplate, Trade } from '../../types';
import { PINE_TEMPLATES } from '../../services/pineTemplates';
import {
  executeDuckDBSQL,
  type DuckDBSQLResult,
  type DuckDBStats,
} from '../../services/duckdb';

interface BottomDockProps {
  activeScript: string;
  onChangeScript: (code: string) => void;
  onRunBacktest: () => void;
  backtestReport: BacktestReport | null;
  compilerLogs: string[];
  dbStats: { totalBars: number; totalSymbols: number; savedScripts: number };
  duckDBStats?: DuckDBStats;
  onRefreshDuckDB?: () => void;
  onDownloadQuotes: (symbol: string, source: 'binance' | 'yahoo', tf: string) => void;
  onClearCache: () => void;
  isDownloading?: boolean;
  currentSymbol?: string;
  onSelectSymbol?: (symbol: string) => void;
  templates?: PineScriptTemplate[];
  activeFolder?: string;
  onRefreshStrategies?: () => void;
  onSaveStrategy?: (filename: string, code: string) => Promise<void>;
  onChangeStrategiesDir?: (dir: string) => void;
  strategyInputs?: Record<string, any>;
  onUpdateStrategyParam?: (paramId: string, value: any) => void;
  onResetStrategyParams?: () => void;
  onSelectTemplate?: (templateId: string) => void;
  selectedTemplateId?: string;
  showTradesOnChart?: boolean;
  onToggleShowTrades?: () => void;
  onFocusTrade?: (trade: any) => void;
  isSettingsOpen?: boolean;
  onToggleSettings?: (open: boolean) => void;
}


type DockTab = 'editor' | 'tester' | 'datamanager' | 'logs';
type TesterSubTab = 'overview' | 'trades' | 'metrics';

export const BottomDock: React.FC<BottomDockProps> = ({
  activeScript,
  onChangeScript,
  onRunBacktest,
  backtestReport,
  compilerLogs,
  dbStats,
  duckDBStats,
  onRefreshDuckDB,
  onDownloadQuotes,
  onClearCache,
  isDownloading = false,
  currentSymbol = 'BTCUSDT',
  onSelectSymbol: _onSelectSymbol,
  templates = PINE_TEMPLATES,
  activeFolder = 'strategies',
  onRefreshStrategies,
  onSaveStrategy,
  onChangeStrategiesDir,
  strategyInputs: _strategyInputs = {},
  onUpdateStrategyParam: _onUpdateStrategyParam,
  onResetStrategyParams: _onResetStrategyParams,
  onSelectTemplate,
  selectedTemplateId,
  showTradesOnChart = true,
  onToggleShowTrades,
  onFocusTrade,
  isSettingsOpen,
  onToggleSettings,
}) => {
  const [activeTab, setActiveTab] = useState<DockTab>('tester');
  const [testerSubTab, setTesterSubTab] = useState<TesterSubTab>('overview');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const isSettingsModalOpen = Boolean(isSettingsOpen);
  const setIsSettingsModalOpen = (open: boolean) => {
    onToggleSettings?.(open);
  };
  const [saveFilename, setSaveFilename] = useState('strategy_custom.pine');
  const [customDirInput, setCustomDirInput] = useState('');
  const [isSavingScript, setIsSavingScript] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dockHeight, setDockHeight] = useState(() =>
    typeof window !== 'undefined'
      ? Math.min(480, Math.max(220, Math.round(window.innerHeight * 0.42)))
      : 420
  );
  const [selectedTemplate, setSelectedTemplate] = useState<string>(selectedTemplateId || 'ema_crossover_v6');

  // Keep selectedTemplate in sync if parent passed selectedTemplateId
  React.useEffect(() => {
    if (selectedTemplateId) {
      setSelectedTemplate(selectedTemplateId);
    }
  }, [selectedTemplateId]);

  // Equity Chart Interactive State & Mode
  const [equityHover, setEquityHover] = useState<{
    time: number;
    equity: number;
    drawdown: number;
    drawdownPct: number;
    xPct: number;
    yPct: number;
    nearestTrade?: Trade;
  } | null>(null);
  const [equityChartMode, setEquityChartMode] = useState<'equity' | 'drawdown'>('equity');
  const equityContainerRef = useRef<HTMLDivElement>(null);

  const formatEquityDate = (timestamp: number, totalSpanMs: number): string => {
    const d = new Date(timestamp);
    const oneYear = 365 * 24 * 3600 * 1000;
    const oneMonth = 30 * 24 * 3600 * 1000;
    const oneDay = 24 * 3600 * 1000;

    if (totalSpanMs > oneYear * 1.5) {
      return d.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }).replace(' г.', '');
    } else if (totalSpanMs > oneMonth * 2) {
      return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: '2-digit' }).replace(' г.', '');
    } else if (totalSpanMs > oneDay * 2) {
      return (
        d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) +
        ' ' +
        d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      );
    } else {
      return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
  };

  const formatEquityFullDate = (timestamp: number): string => {
    const d = new Date(timestamp);
    return (
      d.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }) +
      ', ' +
      d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    );
  };


  // Drag-to-resize dock height handler
  const isDraggingRef = React.useRef<boolean>(false);
  const startYRef = React.useRef<number>(0);
  const startHeightRef = React.useRef<number>(420);

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = dockHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaY = startYRef.current - moveEvent.clientY;
      const newHeight = Math.min(Math.max(startHeightRef.current + deltaY, 180), window.innerHeight - 80);
      setDockHeight(newHeight);
      setIsCollapsed(false);
      setIsMaximized(false);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Data download form state
  const [downloadSymbol, setDownloadSymbol] = useState('BTCUSDT');
  const [downloadSource, setDownloadSource] = useState<'binance' | 'yahoo'>('binance');
  const [downloadTf, setDownloadTf] = useState('1h');

  // DuckDB SQL Console State
  const [sqlQuery, setSqlQuery] = useState(
    "SELECT symbol, timeframe, count(*) AS total_bars, round(min(low), 2) AS min_price, round(max(high), 2) AS max_price FROM market_bars GROUP BY symbol, timeframe ORDER BY symbol;"
  );
  const [sqlResult, setSqlResult] = useState<DuckDBSQLResult | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [isExecutingSQL, setIsExecutingSQL] = useState(false);

  const handleRunSQL = async (queryToRun?: string) => {
    const q = queryToRun || sqlQuery;
    setIsExecutingSQL(true);
    setSqlError(null);
    try {
      const res = await executeDuckDBSQL(q);
      setSqlResult(res);
    } catch (err: any) {
      setSqlError(err?.message || String(err));
      setSqlResult(null);
    } finally {
      setIsExecutingSQL(false);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const tmpl = (templates || PINE_TEMPLATES).find((t) => t.id === templateId);
    if (tmpl) {
      onChangeScript(tmpl.code);
    }
    if (onSelectTemplate) {
      onSelectTemplate(templateId);
    }
  };

  const handleConfirmSave = async () => {
    if (!onSaveStrategy) return;
    setIsSavingScript(true);
    setSaveError(null);
    try {
      await onSaveStrategy(saveFilename, activeScript);
      setIsSaveModalOpen(false);
    } catch (err: any) {
      setSaveError(err?.message || String(err));
    } finally {
      setIsSavingScript(false);
    }
  };

  const handleApplyCustomDir = () => {
    if (onChangeStrategiesDir) {
      onChangeStrategiesDir(customDirInput.trim());
    }
    setIsFolderModalOpen(false);
  };

  const folderTemplates = (templates || PINE_TEMPLATES).filter((t) => t.source === 'folder');
  const builtinTemplates = (templates || PINE_TEMPLATES).filter((t) => t.source !== 'folder');

  return (
    <div
      style={{
        height: isCollapsed
          ? '36px'
          : isMaximized
          ? 'calc(100vh - 48px)'
          : `${dockHeight}px`,
        maxHeight: isCollapsed
          ? '36px'
          : isMaximized
          ? 'calc(100vh - 48px)'
          : 'calc(100vh - 80px)',
      }}
      className="flex-shrink-0 bg-[#1e222d] border-t border-[#2a2e39] flex flex-col transition-all duration-150 z-30 select-none relative min-h-0"
    >
      {/* Top Drag-to-Resize Handle */}
      <div
        onMouseDown={handleMouseDownResize}
        className="absolute -top-1.5 left-0 w-full h-3 cursor-row-resize hover:bg-blue-500/40 z-50 transition-colors"
        title="Drag up/down to resize bottom dock"
      />

      {/* Dock Header Tabs */}
      <div className="h-10 px-3.5 flex items-center justify-between border-b border-[#2a2e39] text-sm font-semibold bg-[#1a1e28]">
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => {
              setActiveTab('editor');
              setIsCollapsed(false);
            }}
            className={`flex items-center space-x-2 px-3.5 py-2 border-b-2 transition-all ${
              activeTab === 'editor' && !isCollapsed
                ? 'border-blue-500 text-white bg-[#2a2e39]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Code size={15} className="text-blue-400" />
            <span>Pine Editor v6</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('tester');
              setIsCollapsed(false);
            }}
            className={`flex items-center space-x-2 px-3.5 py-2 border-b-2 transition-all ${
              activeTab === 'tester' && !isCollapsed
                ? 'border-emerald-500 text-white bg-[#2a2e39]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <LineChart size={15} className="text-emerald-400" />
            <span>Strategy Tester</span>
            {backtestReport && (
              <span
                className={`ml-1.5 px-2 py-0.5 text-xs rounded font-bold ${
                  backtestReport.netProfit >= 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                }`}
              >
                {backtestReport.netProfit >= 0 ? '+' : ''}${backtestReport.netProfit.toLocaleString()}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('datamanager');
              setIsCollapsed(false);
            }}
            className={`flex items-center space-x-2 px-3.5 py-2 border-b-2 transition-all ${
              activeTab === 'datamanager' && !isCollapsed
                ? 'border-amber-500 text-white bg-[#2a2e39]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Database size={15} className="text-amber-400" />
            <span>Data Manager</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('logs');
              setIsCollapsed(false);
            }}
            className={`flex items-center space-x-2 px-3.5 py-2 border-b-2 transition-all ${
              activeTab === 'logs' && !isCollapsed
                ? 'border-indigo-500 text-white bg-[#2a2e39]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Terminal size={15} className="text-indigo-400" />
            <span>Console</span>
            {compilerLogs.length > 0 && (
              <span className="ml-1.5 text-xs text-gray-400 font-mono">({compilerLogs.length})</span>
            )}
          </button>
        </div>

        {/* Action Controls: Maximize & Collapse */}
        <div className="flex items-center space-x-1">
          <button
            title={isMaximized ? 'Restore Dock Size' : 'Maximize Strategy Tester'}
            onClick={() => {
              setIsMaximized(!isMaximized);
              setIsCollapsed(false);
            }}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#2a2e39] transition-colors"
          >
            {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          <button
            title={isCollapsed ? 'Expand Dock' : 'Collapse Dock'}
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#2a2e39] transition-colors"
          >
            {isCollapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Dock Content Body (When expanded) */}
      {!isCollapsed && (
        <div className="flex-1 overflow-hidden bg-[#131722] text-gray-300 flex flex-col min-h-0">
          {/* 1. PINE SCRIPT EDITOR TAB */}
          {activeTab === 'editor' && (
            <div className="h-full flex flex-col min-h-0">
              {/* Editor sub-toolbar */}
              <div className="h-9 px-3 bg-[#1e222d] border-b border-[#2a2e39] flex items-center justify-between text-xs flex-shrink-0">
                <div className="flex items-center space-x-2.5">
                  <span className="text-gray-400 font-medium">Strategy:</span>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    className="bg-[#131722] border border-[#2a2e39] rounded px-2 py-1 text-white outline-none max-w-[280px] truncate font-sans text-xs focus:border-blue-500 transition-colors"
                  >
                    {folderTemplates.length > 0 && (
                      <optgroup label={`📁 Folder: ${activeFolder ? activeFolder.split(/[/\\\\]/).filter(Boolean).pop() : 'strategies'} (${folderTemplates.length})`}>
                        {folderTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.filename || t.title}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label={`⚡ Built-in Templates (${builtinTemplates.length})`}>
                      {builtinTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} ({t.type})
                        </option>
                      ))}
                    </optgroup>
                  </select>

                  {/* Folder path badge & settings button */}
                  <button
                    onClick={() => {
                      setCustomDirInput(activeFolder);
                      setIsFolderModalOpen(true);
                    }}
                    className="flex items-center space-x-1.5 px-2 py-1 rounded bg-[#202533] hover:bg-[#2a3042] text-gray-300 border border-[#2e3446] transition-colors text-[11px]"
                    title={`Current folder:\n${activeFolder}\nClick to change or select folder`}
                  >
                    <FolderOpen size={12} className="text-emerald-400" />
                    <span className="hidden sm:inline font-mono text-emerald-400 max-w-[120px] truncate">
                      {activeFolder ? activeFolder.split(/[/\\\\]/).filter(Boolean).pop() : 'strategies'}
                    </span>
                  </button>

                  {/* Refresh button */}
                  {onRefreshStrategies && (
                    <button
                      onClick={onRefreshStrategies}
                      className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#2a2e39] transition-colors"
                      title="Reload files from folder"
                    >
                      <RefreshCw size={12} />
                    </button>
                  )}

                  {/* Live Sync Badge */}
                  <div
                    title="Live watcher active: any saved .pine file in the folder updates immediately"
                    className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 select-none"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="hidden md:inline font-mono font-semibold">LIVE SYNC</span>
                  </div>

                  {/* Strategy Settings (Inputs) Button */}
                  <button
                    onClick={() => setIsSettingsModalOpen(!isSettingsModalOpen)}
                    className={`flex items-center space-x-1.5 px-2.5 py-1 rounded ${
                      isSettingsModalOpen ? 'bg-blue-600/40 text-blue-200 border-blue-500/60' : 'bg-[#202533] hover:bg-[#2a3042] text-gray-200 border-[#2e3446]'
                    } hover:border-blue-500/50 transition-all text-xs font-semibold`}
                    title="Open Strategy Inputs & Settings (TradingView ⚙️ Style)"
                  >
                    <Settings size={12} className="text-blue-400" />
                    <span>Inputs</span>
                    {backtestReport?.inputs && backtestReport.inputs.length > 0 && (
                      <span className="px-1 py-0.2 rounded bg-blue-900/60 text-blue-300 text-[10px] font-mono">
                        {backtestReport.inputs.length}
                      </span>
                    )}
                  </button>
                </div>


                <div className="flex items-center space-x-2">
                  {onSaveStrategy && (
                    <button
                      onClick={() => setIsSaveModalOpen(true)}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#202533] hover:bg-[#2a3042] text-gray-200 text-xs border border-[#2e3446] transition-colors"
                      title="Save current script to .pine file in strategies folder"
                    >
                      <Save size={12} className="text-blue-400" />
                      <span>Save as File</span>
                    </button>
                  )}

                  <button
                    onClick={onRunBacktest}
                    className="flex items-center space-x-1.5 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors shadow-sm"
                  >
                    <Play size={11} />
                    <span>Compile & Run</span>
                  </button>
                </div>
              </div>

              {/* Monaco Code Editor */}
              <div className="flex-1 min-h-0">
                <Editor
                  height="100%"
                  defaultLanguage="javascript"
                  theme="vs-dark"
                  value={activeScript}
                  onChange={(val) => onChangeScript(val || '')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 12,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    wordWrap: 'on',
                  }}
                />
              </div>
            </div>
          )}

          {/* 2. STRATEGY TESTER TAB */}
          {activeTab === 'tester' && (
            <div className="h-full flex flex-col min-h-0 overflow-hidden">
              {backtestReport ? (
                <>
                  {/* KPI Summary Bar */}
                  <div className="flex-shrink-0 bg-[#1e222d] px-4 py-2.5 border-b border-[#2a2e39] flex items-center justify-between overflow-x-auto text-sm min-w-0">
                    <div className="flex items-center space-x-6 flex-shrink-0">
                      <div>
                        <span className="text-xs text-gray-400 block tracking-wider font-semibold uppercase mb-0.5">NET PROFIT</span>
                        <span
                          className={`text-base font-bold flex items-center space-x-1.5 ${
                            backtestReport.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {backtestReport.netProfit >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                          <span>
                            ${backtestReport.netProfit.toLocaleString()} ({backtestReport.netProfitPercent >= 0 ? '+' : ''}
                            {backtestReport.netProfitPercent}%)
                          </span>
                        </span>
                      </div>

                      <div>
                        <span className="text-xs text-gray-400 block tracking-wider font-semibold uppercase mb-0.5">TOTAL TRADES</span>
                        <span className="text-base font-bold text-white">{backtestReport.totalTrades}</span>
                      </div>

                      <div>
                        <span className="text-xs text-gray-400 block tracking-wider font-semibold uppercase mb-0.5">WIN RATE</span>
                        <span className="text-base font-bold text-emerald-400">{backtestReport.winRate}%</span>
                      </div>

                      <div>
                        <span className="text-xs text-gray-400 block tracking-wider font-semibold uppercase mb-0.5">PROFIT FACTOR</span>
                        <span className="text-base font-bold text-indigo-400">{backtestReport.profitFactor}</span>
                      </div>

                      <div>
                        <span className="text-xs text-gray-400 block tracking-wider font-semibold uppercase mb-0.5">MAX DRAWDOWN</span>
                        <span className="text-base font-bold text-rose-400">
                          ${backtestReport.maxDrawdown.toLocaleString()} ({backtestReport.maxDrawdownPercent}%)
                        </span>
                      </div>

                      <div>
                        <span className="text-xs text-gray-400 block tracking-wider font-semibold uppercase mb-0.5">SHARPE RATIO</span>
                        <span className="text-base font-bold text-gray-200">{backtestReport.sharpeRatio}</span>
                      </div>
                    </div>

                    {/* Subtabs: Overview | Trades | Metrics */}
                    <div className="flex items-center space-x-1 bg-[#131722] p-1 rounded-md border border-[#2a2e39] flex-shrink-0 ml-3">
                      <button
                        onClick={() => setTesterSubTab('overview')}
                        className={`px-3 py-1.5 rounded-md text-xs transition-all ${
                          testerSubTab === 'overview'
                            ? 'bg-blue-600 text-white font-bold shadow-sm'
                            : 'text-gray-400 hover:text-white font-medium'
                        }`}
                      >
                        Equity Curve
                      </button>
                      <button
                        onClick={() => setTesterSubTab('trades')}
                        className={`px-3 py-1.5 rounded-md text-xs transition-all ${
                          testerSubTab === 'trades'
                            ? 'bg-blue-600 text-white font-bold shadow-sm'
                            : 'text-gray-400 hover:text-white font-medium'
                        }`}
                      >
                        List of Trades ({backtestReport.trades.length})
                      </button>
                      <button
                        onClick={() => setTesterSubTab('metrics')}
                        className={`px-3 py-1.5 rounded-md text-xs transition-all ${
                          testerSubTab === 'metrics'
                            ? 'bg-blue-600 text-white font-bold shadow-sm'
                            : 'text-gray-400 hover:text-white font-medium'
                        }`}
                      >
                        Performance Metrics
                      </button>
                    </div>

                    {/* Parameters Button in Tester */}
                    <button
                      onClick={() => setIsSettingsModalOpen(true)}
                      className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-[#1b202c] hover:bg-[#252b3b] text-gray-200 border border-[#2b3345] hover:border-emerald-500/60 transition-all text-xs font-semibold ml-2 flex-shrink-0"
                      title="Adjust strategy parameters with instant auto-recalculation"
                    >
                      <Settings size={14} className="text-emerald-400" />
                      <span>Parameters</span>
                      {backtestReport.inputs && backtestReport.inputs.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 text-xs font-mono font-bold">
                          {backtestReport.inputs.length}
                        </span>
                      )}
                    </button>

                    {/* Toggle Chart Overlays: Show Trades */}
                    {onToggleShowTrades && (
                      <button
                        onClick={onToggleShowTrades}
                        className={`flex items-center space-x-2 px-3 py-1.5 rounded-md border transition-all text-xs font-semibold ml-2 flex-shrink-0 ${
                          showTradesOnChart
                            ? 'bg-blue-600/20 text-blue-300 border-blue-500/50 hover:bg-blue-600/30'
                            : 'bg-[#1b202c] text-gray-400 border-[#2b3345] hover:text-white'
                        }`}
                        title="Toggle trade arrows and execution paths on candlestick chart"
                      >
                        <span>{showTradesOnChart ? '👁️ Chart Trades' : '👁️‍🗨️ Trades Hidden'}</span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 text-xs font-mono font-bold">
                          {backtestReport.trades.length}
                        </span>
                      </button>
                    )}
                  </div>


                  {/* Subtab 1: Equity Curve & Drawdown Chart with Real Calendar Dates & Crosshairs */}
                  {testerSubTab === 'overview' && (
                    <div className="flex-1 p-2 flex flex-col min-h-0 overflow-hidden bg-[#131722]">
                      {(() => {
                        const pts = backtestReport.equityCurve;
                        if (!pts || pts.length < 2) {
                          return (
                            <div className="flex-1 flex items-center justify-center text-gray-500 text-xs">
                              Ожидание расчета баров...
                            </div>
                          );
                        }

                        const initCap = backtestReport.initialCapital;
                        const startTime = pts[0].time;
                        const endTime = pts[pts.length - 1].time;
                        const totalSpanMs = Math.max(1000, endTime - startTime);

                        // Safe downsampling for SVG rendering (max ~1000 points so WebGL & DOM remain at 60 FPS)
                        const step = Math.max(1, Math.floor(pts.length / 1000));
                        const drawPts: typeof pts = [];
                        for (let i = 0; i < pts.length; i += step) {
                          drawPts.push(pts[i]);
                        }
                        if (drawPts[drawPts.length - 1] !== pts[pts.length - 1]) {
                          drawPts.push(pts[pts.length - 1]);
                        }

                        // Equity bounds
                        let minEqRaw = initCap;
                        let maxEqRaw = initCap;
                        for (let i = 0; i < pts.length; i++) {
                          const eq = pts[i].equity;
                          if (eq < minEqRaw) minEqRaw = eq;
                          if (eq > maxEqRaw) maxEqRaw = eq;
                        }

                        // Drawdown bounds
                        const maxDdPct = Math.max(1, backtestReport.maxDrawdownPercent * 1.12);

                        // Normalized SVG coordinates (0 to 1000)
                        const leftMargin = 16;
                        const rightMargin = 120; // room for HTML price badges
                        const topMargin = 28;
                        const botMargin = 52; // room for calendar dates on X-axis
                        const plotW = 1000 - leftMargin - rightMargin;
                        const plotH = 1000 - topMargin - botMargin;
                        const bottomY = topMargin + plotH;

                        const getX = (idx: number) => leftMargin + (idx / Math.max(1, drawPts.length - 1)) * plotW;

                        // Equity Y scale
                        const diff = maxEqRaw - minEqRaw || 1000;
                        const padding = diff * 0.12;
                        const yMin = minEqRaw - padding;
                        const yMax = maxEqRaw + padding;
                        const yRange = yMax - yMin;
                        const getEquityY = (val: number) => topMargin + plotH * (1 - (val - yMin) / yRange);

                        // Drawdown Y scale (0% at top, -maxDdPct at bottom)
                        const getDrawdownY = (ddPct: number) => topMargin + plotH * (Math.abs(ddPct) / maxDdPct);

                        // Active Y function depending on mode
                        const getY = (p: (typeof pts)[0]) =>
                          equityChartMode === 'equity' ? getEquityY(p.equity) : getDrawdownY(p.drawdownPercent);

                        const baselineY = equityChartMode === 'equity' ? getEquityY(initCap) : getDrawdownY(0);
                        const isProfitable = backtestReport.netProfit >= 0;

                        // Calculate Real Calendar Date Ticks for X-Axis
                        const numTicks = 6;
                        const dateTicks: { idx: number; time: number; label: string; x: number }[] = [];
                        for (let k = 0; k < numTicks; k++) {
                          const frac = k / (numTicks - 1);
                          const targetTime = startTime + frac * totalSpanMs;
                          let closestIdx = 0;
                          let minDiff = Infinity;
                          for (let i = 0; i < drawPts.length; i++) {
                            const d = Math.abs(drawPts[i].time - targetTime);
                            if (d < minDiff) {
                              minDiff = d;
                              closestIdx = i;
                            }
                          }
                          const tickTime = drawPts[closestIdx].time;
                          const x = getX(closestIdx);
                          const label = formatEquityDate(tickTime, totalSpanMs);
                          dateTicks.push({ idx: closestIdx, time: tickTime, label, x });
                        }

                        // Calculate Running Peak Equity Curve (All-Time High line)
                        let runPeak = initCap;
                        const peakCurvePoints = drawPts
                          .map((p, idx) => {
                            if (p.equity > runPeak) runPeak = p.equity;
                            return `${getX(idx).toFixed(1)},${getEquityY(runPeak).toFixed(1)}`;
                          })
                          .join(' ');

                        // SVG Polyline & Area Paths
                        const polylinePoints = drawPts
                          .map((p, idx) => `${getX(idx).toFixed(1)},${getY(p).toFixed(1)}`)
                          .join(' ');

                        const areaPath =
                          `M ${getX(0).toFixed(1)},${getY(drawPts[0]).toFixed(1)} ` +
                          drawPts.map((p, idx) => `L ${getX(idx).toFixed(1)},${getY(p).toFixed(1)}`).join(' ') +
                          ` L ${getX(drawPts.length - 1).toFixed(1)},${bottomY.toFixed(1)} L ${getX(0).toFixed(1)},${bottomY.toFixed(1)} Z`;

                        // Sample Trade Markers on Equity Curve (Max 120 points for clarity)
                        const tradeDots: { trade: Trade; x: number; y: number }[] = [];
                        if (backtestReport.trades && backtestReport.trades.length > 0 && equityChartMode === 'equity') {
                          const maxDots = 100;
                          const sampleTrades =
                            backtestReport.trades.length > maxDots
                              ? backtestReport.trades.filter(
                                  (_, i) => i % Math.ceil(backtestReport.trades.length / maxDots) === 0
                                )
                              : backtestReport.trades;

                          for (const t of sampleTrades) {
                            let closestIdx = 0;
                            let minDiff = Infinity;
                            for (let i = 0; i < drawPts.length; i++) {
                              const d = Math.abs(drawPts[i].time - t.exitTime);
                              if (d < minDiff) {
                                minDiff = d;
                                closestIdx = i;
                              }
                            }
                            tradeDots.push({
                              trade: t,
                              x: getX(closestIdx),
                              y: getEquityY(drawPts[closestIdx].equity),
                            });
                          }
                        }

                        // Percentage positions for HTML Y-axis labels
                        const maxPct = Math.max(4, Math.min(78, (getEquityY(maxEqRaw) / 1000) * 100));
                        const basePct = Math.max(10, Math.min(84, (baselineY / 1000) * 100));
                        const minPct = Math.max(16, Math.min(88, (getEquityY(minEqRaw) / 1000) * 100));

                        // Pointer movement handler for interactive crosshair & tooltip
                        const handleEquityPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
                          if (!equityContainerRef.current || drawPts.length === 0) return;
                          const rect = equityContainerRef.current.getBoundingClientRect();
                          const mouseX = e.clientX - rect.left;
                          const totalW = rect.width;

                          const leftPx = (leftMargin / 1000) * totalW;
                          const plotPx = (plotW / 1000) * totalW;
                          const normX = Math.max(0, Math.min(1, (mouseX - leftPx) / Math.max(1, plotPx)));
                          const ptIndex = Math.round(normX * (drawPts.length - 1));
                          const p = drawPts[ptIndex];
                          if (!p) return;

                          const xPos = getX(ptIndex);
                          const yPos = getY(p);
                          const xPct = (xPos / 1000) * 100;
                          const yPct = (yPos / 1000) * 100;

                          // Find nearest trade within temporal proximity
                          const nearestTrade = backtestReport.trades.find(
                            (t) => Math.abs(t.exitTime - p.time) < 600000 // within 10m
                          );

                          setEquityHover({
                            time: p.time,
                            equity: p.equity,
                            drawdown: p.drawdown,
                            drawdownPct: p.drawdownPercent,
                            xPct,
                            yPct,
                            nearestTrade,
                          });
                        };

                        return (
                          <div className="h-full flex flex-col min-h-0">
                            {/* 1. Header Toolbar with Mode Switcher, Milestones and Legend */}
                            <div className="flex-shrink-0 flex flex-wrap justify-between items-center mb-1.5 px-1 text-xs gap-2">
                              <div className="flex items-center space-x-2">
                                {/* Mode Toggle: Equity vs Drawdown */}
                                <div className="flex items-center bg-[#181d2a] p-0.5 rounded border border-[#2a3245] text-[11px]">
                                  <button
                                    onClick={() => setEquityChartMode('equity')}
                                    className={`px-2.5 py-1 rounded font-semibold transition-all ${
                                      equityChartMode === 'equity'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-gray-400 hover:text-white'
                                    }`}
                                    title="Показать кривую роста баланса"
                                  >
                                    📈 Баланс (Equity)
                                  </button>
                                  <button
                                    onClick={() => setEquityChartMode('drawdown')}
                                    className={`px-2.5 py-1 rounded font-semibold transition-all ${
                                      equityChartMode === 'drawdown'
                                        ? 'bg-rose-600 text-white shadow-sm'
                                        : 'text-gray-400 hover:text-white'
                                    }`}
                                    title="Показать подводный график просадок"
                                  >
                                    🔻 Просадка (Drawdown %)
                                  </button>
                                </div>

                                {/* Dynamic Hover Readout or Summary Metrics */}
                                {equityHover ? (
                                  <div className="flex items-center space-x-2 text-[11px] font-mono bg-[#162032] border border-blue-500/50 px-3 py-0.5 rounded text-blue-300 shadow-sm animate-fade-in">
                                    <span className="text-gray-400">Точка:</span>
                                    <span className="text-white font-bold">
                                      {formatEquityDate(equityHover.time, totalSpanMs)}
                                    </span>
                                    <span>|</span>
                                    <span className="text-gray-400">Баланс:</span>
                                    <span className="text-white font-bold">
                                      ${Math.round(equityHover.equity).toLocaleString()}
                                    </span>
                                    <span>|</span>
                                    <span className="text-gray-400">Прибыль:</span>
                                    <span
                                      className={
                                        equityHover.equity >= initCap
                                          ? 'text-emerald-400 font-bold'
                                          : 'text-rose-400 font-bold'
                                      }
                                    >
                                      {equityHover.equity >= initCap ? '+' : ''}$
                                      {Math.round(equityHover.equity - initCap).toLocaleString()}
                                    </span>
                                    <span>|</span>
                                    <span className="text-gray-400">Просадка:</span>
                                    <span className="text-rose-400 font-bold">
                                      -${Math.round(equityHover.drawdown).toLocaleString()} (-
                                      {equityHover.drawdownPct.toFixed(2)}%)
                                    </span>
                                  </div>
                                ) : (
                                  <div className="hidden md:flex items-center space-x-2 text-[11px] font-mono text-gray-400">
                                    <span>
                                      Старт:{' '}
                                      <strong className="text-gray-200">
                                        ${backtestReport.initialCapital.toLocaleString()}
                                      </strong>
                                    </span>
                                    <span>→</span>
                                    <span>
                                      Итог:{' '}
                                      <strong
                                        className={
                                          backtestReport.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                        }
                                      >
                                        ${backtestReport.finalCapital.toLocaleString()} (
                                        {backtestReport.netProfitPercent >= 0 ? '+' : ''}
                                        {backtestReport.netProfitPercent.toFixed(1)}%)
                                      </strong>
                                    </span>
                                    <span>|</span>
                                    <span>
                                      Пик (ATH):{' '}
                                      <strong className="text-amber-400">
                                        ${Math.round(maxEqRaw).toLocaleString()}
                                      </strong>
                                    </span>
                                    <span>|</span>
                                    <span>
                                      Макс. просадка:{' '}
                                      <strong className="text-rose-400">
                                        -${Math.round(backtestReport.maxDrawdown).toLocaleString()} (-
                                        {backtestReport.maxDrawdownPercent.toFixed(2)}%)
                                      </strong>
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Visual Legend */}
                              <div className="flex items-center space-x-3 text-[10px] font-mono text-gray-400">
                                <span className="flex items-center space-x-1.5">
                                  <span className="w-2.5 h-0.5 bg-blue-500 rounded-full inline-block" />
                                  <span>Кривая баланса</span>
                                </span>
                                {equityChartMode === 'equity' && (
                                  <span className="flex items-center space-x-1.5" title="All-Time High (Линия пика)">
                                    <span className="w-2.5 h-0.5 bg-amber-400 border-b border-dashed border-amber-400 inline-block" />
                                    <span>Пик (ATH)</span>
                                  </span>
                                )}
                                <span className="flex items-center space-x-1.5">
                                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                                  <span>Победы (TP)</span>
                                </span>
                                <span className="flex items-center space-x-1.5">
                                  <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                                  <span>Сливы / Убытки (SL)</span>
                                </span>
                              </div>
                            </div>

                            {/* 2. Interactive SVG Canvas */}
                            <div
                              ref={equityContainerRef}
                              onPointerMove={handleEquityPointerMove}
                              onPointerLeave={() => setEquityHover(null)}
                              className="flex-1 w-full bg-[#141722] rounded border border-[#2a2e39] relative min-h-0 overflow-hidden cursor-crosshair select-none"
                            >
                              <svg className="w-full h-full block" viewBox="0 0 1000 1000" preserveAspectRatio="none">
                                <defs>
                                  {/* Equity Gradient */}
                                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop
                                      offset="0%"
                                      stopColor={isProfitable ? '#089981' : '#2962ff'}
                                      stopOpacity="0.3"
                                    />
                                    <stop
                                      offset="100%"
                                      stopColor={isProfitable ? '#089981' : '#2962ff'}
                                      stopOpacity="0.0"
                                    />
                                  </linearGradient>

                                  {/* Drawdown Gradient */}
                                  <linearGradient id="drawdownGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.05" />
                                    <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.38" />
                                  </linearGradient>
                                </defs>

                                {/* Vertical Date Grid Lines corresponding to real calendar dates */}
                                {dateTicks.map((tick, i) => (
                                  <line
                                    key={`vgrid-${i}`}
                                    x1={tick.x}
                                    y1={topMargin}
                                    x2={tick.x}
                                    y2={bottomY}
                                    stroke="#202534"
                                    strokeDasharray="4,4"
                                    strokeWidth="1"
                                  />
                                ))}

                                {/* Horizontal Reference Grid Lines */}
                                {equityChartMode === 'equity' ? (
                                  <>
                                    <line
                                      x1={leftMargin}
                                      y1={getEquityY(maxEqRaw)}
                                      x2={1000 - rightMargin}
                                      y2={getEquityY(maxEqRaw)}
                                      stroke="#252b3b"
                                      strokeDasharray="3,3"
                                    />
                                    <line
                                      x1={leftMargin}
                                      y1={getEquityY(minEqRaw)}
                                      x2={1000 - rightMargin}
                                      y2={getEquityY(minEqRaw)}
                                      stroke="#252b3b"
                                      strokeDasharray="3,3"
                                    />
                                    {/* Initial Capital Baseline (0% reference) */}
                                    <line
                                      x1={leftMargin}
                                      y1={baselineY}
                                      x2={1000 - rightMargin}
                                      y2={baselineY}
                                      stroke="#4b5563"
                                      strokeWidth="1.5"
                                      strokeDasharray="6,4"
                                    />
                                  </>
                                ) : (
                                  <>
                                    {/* Drawdown 0% Top Line */}
                                    <line
                                      x1={leftMargin}
                                      y1={baselineY}
                                      x2={1000 - rightMargin}
                                      y2={baselineY}
                                      stroke="#10b981"
                                      strokeWidth="1.5"
                                    />
                                    <line
                                      x1={leftMargin}
                                      y1={getDrawdownY(backtestReport.maxDrawdownPercent)}
                                      x2={1000 - rightMargin}
                                      y2={getDrawdownY(backtestReport.maxDrawdownPercent)}
                                      stroke="#f43f5e"
                                      strokeWidth="1.2"
                                      strokeDasharray="4,4"
                                    />
                                  </>
                                )}

                                {/* Bottom Timeline Border */}
                                <line
                                  x1={leftMargin}
                                  y1={bottomY}
                                  x2={1000 - rightMargin}
                                  y2={bottomY}
                                  stroke="#2a2e39"
                                  strokeWidth="1"
                                />

                                {/* Area Fill */}
                                <path
                                  d={areaPath}
                                  fill={equityChartMode === 'equity' ? 'url(#equityGrad)' : 'url(#drawdownGrad)'}
                                />

                                {/* Running Peak (ATH) Dashed Line in Equity Mode */}
                                {equityChartMode === 'equity' && (
                                  <polyline
                                    fill="none"
                                    stroke="#f59e0b"
                                    strokeWidth="1.5"
                                    strokeDasharray="4,4"
                                    opacity="0.5"
                                    points={peakCurvePoints}
                                  />
                                )}

                                {/* Main Curve Polyline */}
                                <polyline
                                  fill="none"
                                  stroke={
                                    equityChartMode === 'equity'
                                      ? isProfitable
                                        ? '#089981'
                                        : '#2962ff'
                                      : '#f43f5e'
                                  }
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  points={polylinePoints}
                                />

                                {/* Trade Dots along the curve: Green for Wins, Red for Losses */}
                                {tradeDots.map((td, i) => (
                                  <circle
                                    key={`td-${i}`}
                                    cx={td.x}
                                    cy={td.y}
                                    r={td.trade.pnl > 0 ? 3 : 3}
                                    fill={td.trade.pnl > 0 ? '#10b981' : '#f43f5e'}
                                    stroke="#141722"
                                    strokeWidth="1"
                                    opacity="0.85"
                                  />
                                ))}

                                {/* Start & End Points */}
                                <circle
                                  cx={getX(0)}
                                  cy={getY(drawPts[0])}
                                  r="4"
                                  fill="#2962ff"
                                  stroke="#ffffff"
                                  strokeWidth="1"
                                />
                                <circle
                                  cx={getX(drawPts.length - 1)}
                                  cy={getY(drawPts[drawPts.length - 1])}
                                  r="5"
                                  fill={
                                    equityChartMode === 'equity'
                                      ? isProfitable
                                        ? '#089981'
                                        : '#f43f5e'
                                      : '#f43f5e'
                                  }
                                  stroke="#ffffff"
                                  strokeWidth="1.5"
                                />

                                {/* Interactive Crosshair Lines in SVG */}
                                {equityHover && (
                                  <>
                                    <line
                                      x1={equityHover.xPct * 10}
                                      y1={topMargin}
                                      x2={equityHover.xPct * 10}
                                      y2={bottomY}
                                      stroke="#3b82f6"
                                      strokeWidth="1.2"
                                      strokeDasharray="3,3"
                                    />
                                    <line
                                      x1={leftMargin}
                                      y1={equityHover.yPct * 10}
                                      x2={1000 - rightMargin}
                                      y2={equityHover.yPct * 10}
                                      stroke="#3b82f6"
                                      strokeWidth="1.2"
                                      strokeDasharray="3,3"
                                    />
                                    <circle
                                      cx={equityHover.xPct * 10}
                                      cy={equityHover.yPct * 10}
                                      r="6"
                                      fill="#3b82f6"
                                      stroke="#ffffff"
                                      strokeWidth="2"
                                    />
                                  </>
                                )}
                              </svg>

                              {/* 3. Right Y-Axis Value Badges */}
                              {equityChartMode === 'equity' ? (
                                <>
                                  <div
                                    className="text-[10px] font-mono font-bold text-emerald-400 pointer-events-none select-none whitespace-nowrap"
                                    style={{
                                      position: 'absolute',
                                      right: '12px',
                                      top: `${maxPct.toFixed(1)}%`,
                                      transform: 'translateY(-50%)',
                                    }}
                                  >
                                    ${Math.round(maxEqRaw).toLocaleString()}
                                  </div>
                                  <div
                                    className="text-[10px] font-mono font-bold text-gray-300 pointer-events-none select-none whitespace-nowrap bg-[#181d2a] px-1 py-0.5 rounded border border-[#2b3345]"
                                    style={{
                                      position: 'absolute',
                                      right: '12px',
                                      top: `${basePct.toFixed(1)}%`,
                                      transform: 'translateY(-50%)',
                                    }}
                                  >
                                    ${initCap.toLocaleString()} (0%)
                                  </div>
                                  <div
                                    className="text-[10px] font-mono font-bold text-rose-400 pointer-events-none select-none whitespace-nowrap"
                                    style={{
                                      position: 'absolute',
                                      right: '12px',
                                      top: `${minPct.toFixed(1)}%`,
                                      transform: 'translateY(-50%)',
                                    }}
                                  >
                                    ${Math.round(minEqRaw).toLocaleString()}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div
                                    className="text-[10px] font-mono font-bold text-emerald-400 pointer-events-none select-none whitespace-nowrap"
                                    style={{
                                      position: 'absolute',
                                      right: '12px',
                                      top: `${((topMargin / 1000) * 100).toFixed(1)}%`,
                                      transform: 'translateY(-50%)',
                                    }}
                                  >
                                    0.00% (Пик)
                                  </div>
                                  <div
                                    className="text-[10px] font-mono font-bold text-rose-400 pointer-events-none select-none whitespace-nowrap"
                                    style={{
                                      position: 'absolute',
                                      right: '12px',
                                      top: `${((getDrawdownY(backtestReport.maxDrawdownPercent) / 1000) * 100).toFixed(
                                        1
                                      )}%`,
                                      transform: 'translateY(-50%)',
                                    }}
                                  >
                                    -{backtestReport.maxDrawdownPercent.toFixed(2)}% (Макс.)
                                  </div>
                                </>
                              )}

                              {/* 4. Bottom X-Axis Real Calendar Dates (Strictly aligned with vertical grid lines) */}
                              <div
                                className="absolute bottom-1.5 text-[11px] font-mono select-none pointer-events-none"
                                style={{
                                  left: `${(leftMargin / 1000) * 100}%`,
                                  right: `${(rightMargin / 1000) * 100}%`,
                                }}
                              >
                                {dateTicks.map((tick, i) => {
                                  const relPct = ((tick.x - leftMargin) / plotW) * 100;
                                  return (
                                    <div
                                      key={`dtick-${i}`}
                                      className="absolute whitespace-nowrap text-gray-300 font-semibold text-[10px] tracking-wide"
                                      style={{
                                        left: `${relPct.toFixed(2)}%`,
                                        transform:
                                          i === 0
                                            ? 'translateX(0%)'
                                            : i === dateTicks.length - 1
                                            ? 'translateX(-100%)'
                                            : 'translateX(-50%)',
                                      }}
                                    >
                                      <span>{tick.label}</span>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* 5. Floating Interactive Tooltip Card */}
                              {equityHover && (
                                <div
                                  className="absolute z-20 pointer-events-none bg-[#141824]/95 backdrop-blur-md border border-blue-500/50 rounded-lg p-2.5 shadow-2xl text-xs font-sans min-w-[230px]"
                                  style={{
                                    left: `${Math.min(74, Math.max(8, equityHover.xPct))}%`,
                                    top: `${Math.max(6, Math.min(68, equityHover.yPct - 12))}%`,
                                    transform: 'translate(-50%, -100%)',
                                  }}
                                >
                                  <div className="text-[11px] text-gray-200 font-bold border-b border-[#252c3e] pb-1 mb-1.5 flex items-center justify-between">
                                    <span>📅 {formatEquityFullDate(equityHover.time)}</span>
                                    {equityHover.equity >= initCap ? (
                                      <span className="text-emerald-400 text-[10px] font-bold px-1 rounded bg-emerald-950/60 border border-emerald-500/40">
                                        В ПРИБЫЛИ
                                      </span>
                                    ) : (
                                      <span className="text-rose-400 text-[10px] font-bold px-1 rounded bg-rose-950/60 border border-rose-500/40">
                                        В УБЫТКЕ
                                      </span>
                                    )}
                                  </div>
                                  <div className="space-y-1 font-mono text-[11px]">
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">Баланс (Equity):</span>
                                      <span className="font-bold text-white">
                                        ${Math.round(equityHover.equity).toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">Прибыль от старта:</span>
                                      <span
                                        className={
                                          equityHover.equity >= initCap
                                            ? 'text-emerald-400 font-bold'
                                            : 'text-rose-400 font-bold'
                                        }
                                      >
                                        {equityHover.equity >= initCap ? '+' : ''}$
                                        {Math.round(equityHover.equity - initCap).toLocaleString()} (
                                        {(((equityHover.equity - initCap) / initCap) * 100).toFixed(2)}%)
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">Просадка от пика:</span>
                                      <span
                                        className={
                                          equityHover.drawdown > 0 ? 'text-rose-400 font-semibold' : 'text-gray-400'
                                        }
                                      >
                                        {equityHover.drawdown > 0
                                          ? `-$${Math.round(
                                              equityHover.drawdown
                                            ).toLocaleString()} (-${equityHover.drawdownPct.toFixed(2)}%)`
                                          : '$0.00 (Новый ATH)'}
                                      </span>
                                    </div>
                                    {equityHover.nearestTrade && (
                                      <div className="mt-1.5 pt-1.5 border-t border-[#252c3e] text-[10px] text-blue-300">
                                        ⚡ Сделка #{equityHover.nearestTrade.id}:{' '}
                                        <strong>{equityHover.nearestTrade.type.toUpperCase()}</strong>{' '}
                                        <span
                                          className={
                                            equityHover.nearestTrade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                          }
                                        >
                                          {equityHover.nearestTrade.pnl >= 0 ? '+' : ''}$
                                          {equityHover.nearestTrade.pnl.toLocaleString()}
                                        </span>{' '}
                                        ({equityHover.nearestTrade.exitReason})
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Subtab 2: List of Trades Table */}
                  {testerSubTab === 'trades' && (
                    <div className="flex-1 overflow-y-auto min-h-0">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-[#1e222d] text-gray-400 border-b border-[#2a2e39] text-[11px]">
                          <tr>
                            <th className="py-2 px-3">#</th>
                            <th className="py-2 px-3">Type</th>
                            <th className="py-2 px-3">Signal Reason</th>
                            <th className="py-2 px-3">Entry Time</th>
                            <th className="py-2 px-3">Exit Time</th>
                            <th className="py-2 px-3">Entry Price</th>
                            <th className="py-2 px-3">Exit Price</th>
                            <th className="py-2 px-3">Contracts</th>
                            <th className="py-2 px-3">Profit ($)</th>
                            <th className="py-2 px-3">Profit (%)</th>
                            <th className="py-2 px-3">Run-up (%)</th>
                            <th className="py-2 px-3">Drawdown (%)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2a2e39] font-mono text-[11px]">
                          {backtestReport.trades.map((t) => (
                            <tr
                              key={t.id}
                              onClick={() => onFocusTrade?.(t)}
                              className="hover:bg-[#252b3b] cursor-pointer transition-colors group"
                              title="Click to zoom & center chart on this trade"
                            >
                              <td className="py-1.5 px-3 text-gray-500">{t.id}</td>
                              <td className="py-1.5 px-3 font-semibold">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${
                                    t.type === 'long'
                                      ? 'bg-emerald-950 text-emerald-400'
                                      : 'bg-rose-950 text-rose-400'
                                  }`}
                                >
                                  {t.type}
                                </span>
                              </td>
                              <td className="py-1.5 px-3 text-gray-300">{t.exitReason}</td>
                              <td className="py-1.5 px-3 text-gray-400">
                                {new Date(t.entryTime).toLocaleDateString()}{' '}
                                {new Date(t.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="py-1.5 px-3 text-gray-400">
                                {new Date(t.exitTime).toLocaleDateString()}{' '}
                                {new Date(t.exitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="py-1.5 px-3">${t.entryPrice.toLocaleString()}</td>
                              <td className="py-1.5 px-3">${t.exitPrice.toLocaleString()}</td>
                              <td className="py-1.5 px-3">{t.qty}</td>
                              <td
                                className={`py-1.5 px-3 font-bold ${
                                  t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {t.pnl >= 0 ? '+' : ''}${t.pnl.toLocaleString()}
                              </td>
                              <td className={`py-1.5 px-3 ${t.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {t.pnlPercent >= 0 ? '+' : ''}
                                {t.pnlPercent}%
                              </td>
                              <td className="py-1.5 px-3 text-emerald-400/80">+{t.runup}%</td>
                              <td className="py-1.5 px-3 text-rose-400/80">{t.drawdown}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Subtab 3: Performance Metrics Breakdown */}
                  {testerSubTab === 'metrics' && (
                    <div className="flex-1 p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs min-h-0">
                      <div className="bg-[#171b26] p-3 rounded border border-[#2a2e39]">
                        <span className="text-gray-500 block text-[10px]">GROSS PROFIT</span>
                        <span className="text-emerald-400 font-bold text-sm">
                          ${backtestReport.grossProfit.toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-[#171b26] p-3 rounded border border-[#2a2e39]">
                        <span className="text-gray-500 block text-[10px]">GROSS LOSS</span>
                        <span className="text-rose-400 font-bold text-sm">
                          ${backtestReport.grossLoss.toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-[#171b26] p-3 rounded border border-[#2a2e39]">
                        <span className="text-gray-500 block text-[10px]">WINNING TRADES</span>
                        <span className="text-white font-bold text-sm">
                          {backtestReport.winTrades} / {backtestReport.totalTrades}
                        </span>
                      </div>
                      <div className="bg-[#171b26] p-3 rounded border border-[#2a2e39]">
                        <span className="text-gray-500 block text-[10px]">LOSING TRADES</span>
                        <span className="text-white font-bold text-sm">
                          {backtestReport.lossTrades} / {backtestReport.totalTrades}
                        </span>
                      </div>
                      <div className="bg-[#171b26] p-3 rounded border border-[#2a2e39]">
                        <span className="text-gray-500 block text-[10px]">AVG TRADE PROFIT</span>
                        <span className="text-white font-bold text-sm">${backtestReport.avgTrade}</span>
                      </div>
                      <div className="bg-[#171b26] p-3 rounded border border-[#2a2e39]">
                        <span className="text-gray-500 block text-[10px]">WIN / LOSS RATIO</span>
                        <span className="text-white font-bold text-sm">{backtestReport.winLossRatio}</span>
                      </div>
                      <div className="bg-[#171b26] p-3 rounded border border-[#2a2e39]">
                        <span className="text-gray-500 block text-[10px]">SORTINO RATIO</span>
                        <span className="text-white font-bold text-sm">{backtestReport.sortinoRatio}</span>
                      </div>
                      <div className="bg-[#171b26] p-3 rounded border border-[#2a2e39]">
                        <span className="text-gray-500 block text-[10px]">MAX CONSECUTIVE WINS</span>
                        <span className="text-emerald-400 font-bold text-sm">
                          {backtestReport.maxConsecutiveWins} trades
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-2">
                  <Play size={24} className="text-blue-500 animate-pulse" />
                  <span>No strategy backtest run yet. Click "Run Strategy" to test.</span>
                </div>
              )}
            </div>
          )}

          {/* 3. DUCKDB OLAP DATA MANAGER TAB */}
          {activeTab === 'datamanager' && (
            <div className="h-full p-4 overflow-y-auto space-y-5 bg-[#141822]">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#2a2e39] pb-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
                    <Database size={18} />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-white text-sm">DuckDB In-Browser Analytical Engine</h3>
                      <span className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                        <span>OLAP WASM ACTIVE</span>
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      All authentic market quotes are stored in DuckDB's in-memory columnar table <code className="text-emerald-400 font-mono">market_bars</code>. Fast SQL queries & zero mock data.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {onRefreshDuckDB && (
                    <button
                      onClick={onRefreshDuckDB}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#202533] hover:bg-[#2a3042] text-gray-300 text-xs border border-[#2e3446] transition-colors"
                      title="Refresh DuckDB stats from in-memory engine"
                    >
                      <RefreshCw size={12} />
                      <span>Refresh Stats</span>
                    </button>
                  )}
                  <button
                    onClick={onClearCache}
                    className="flex items-center space-x-1.5 px-3 py-1 rounded bg-rose-950/50 hover:bg-rose-900 text-rose-300 text-xs border border-rose-800/40 transition-colors"
                    title="Purge DuckDB market_bars table and local storage"
                  >
                    <Trash2 size={12} />
                    <span>Purge Tables</span>
                  </button>
                </div>
              </div>

              {/* Stats Cards (4 Column Grid) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#1b202e] p-3.5 rounded-lg border border-[#2a2e39] relative overflow-hidden">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium block">DUCKDB MARKET BARS</span>
                  <span className="text-xl font-black text-white font-mono mt-1 block">
                    {(duckDBStats?.totalBars || dbStats.totalBars).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-emerald-400 mt-0.5 block font-mono">Columnar Apache Arrow</span>
                </div>

                <div className="bg-[#1b202e] p-3.5 rounded-lg border border-[#2a2e39]">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium block">INGESTED INSTRUMENTS</span>
                  <span className="text-xl font-black text-white font-mono mt-1 block">
                    {duckDBStats?.symbolsCount || dbStats.totalSymbols} symbols
                  </span>
                  <span className="text-[10px] text-blue-400 mt-0.5 block font-mono">Crypto, CME Futures, Equities</span>
                </div>

                <div className="bg-[#1b202e] p-3.5 rounded-lg border border-[#2a2e39]">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium block">DATABASE ENGINE</span>
                  <span className="text-base font-bold text-emerald-400 font-mono mt-1 block">
                    DuckDB-WASM v1.33
                  </span>
                  <span className="text-[10px] text-gray-400 mt-0.5 block font-mono">In-Browser OLAP (Client-Side)</span>
                </div>

                <div className="bg-[#1b202e] p-3.5 rounded-lg border border-[#2a2e39]">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium block">RELATIONAL TABLE</span>
                  <span className="text-base font-bold text-yellow-400 font-mono mt-1 block">
                    market_bars
                  </span>
                  <span className="text-[10px] text-gray-400 mt-0.5 block font-mono">PK: (symbol, timeframe, time)</span>
                </div>
              </div>

              {/* DuckDB Interactive SQL Query Console */}
              <div className="bg-[#181d2a] rounded-lg border border-[#2a2e39] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Terminal size={14} className="text-emerald-400" />
                    <h4 className="font-bold text-white text-xs tracking-wide uppercase">DuckDB Interactive SQL Console</h4>
                    <span className="text-[11px] text-gray-400 font-mono">(Direct SQL query execution against WASM instance)</span>
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono">Shortcuts: Ctrl + Enter to run</div>
                </div>

                {/* Preset SQL queries buttons */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] text-gray-400 self-center mr-1">Sample Queries:</span>
                  <button
                    onClick={() => {
                      const q = "SELECT symbol, timeframe, count(*) AS total_bars, round(min(low), 2) AS min_price, round(max(high), 2) AS max_price FROM market_bars GROUP BY symbol, timeframe ORDER BY symbol;";
                      setSqlQuery(q);
                      handleRunSQL(q);
                    }}
                    className="px-2 py-1 bg-[#222838] hover:bg-[#2b3348] border border-[#313950] rounded text-[11px] text-blue-300 transition-colors font-mono"
                  >
                    📊 All Symbols & Bars
                  </button>
                  <button
                    onClick={() => {
                      const q = `SELECT symbol, timeframe, strftime(to_timestamp(time / 1000), '%Y-%m-%d %H:%M') AS datetime, round(open, 2) AS open, round(high, 2) AS high, round(low, 2) AS low, round(close, 2) AS close, round(volume, 2) AS volume FROM market_bars WHERE symbol = '${currentSymbol}' ORDER BY time DESC LIMIT 15;`;
                      setSqlQuery(q);
                      handleRunSQL(q);
                    }}
                    className="px-2 py-1 bg-[#222838] hover:bg-[#2b3348] border border-[#313950] rounded text-[11px] text-emerald-300 transition-colors font-mono"
                  >
                    📈 Latest 15 Bars ({currentSymbol})
                  </button>
                  <button
                    onClick={() => {
                      const q = "SELECT symbol, count(*) AS total_bars, round(min(low), 2) AS min_p, round(max(high), 2) AS max_p FROM market_bars WHERE symbol IN ('NQ=F', 'ES=F') GROUP BY symbol;";
                      setSqlQuery(q);
                      handleRunSQL(q);
                    }}
                    className="px-2 py-1 bg-[#222838] hover:bg-[#2b3348] border border-[#313950] rounded text-[11px] text-amber-300 transition-colors font-mono"
                  >
                    ⚡ CME Futures Only (NQ=F, ES=F)
                  </button>
                  <button
                    onClick={() => {
                      const q = "SELECT symbol, round(sum(volume), 2) AS total_volume, count(*) AS bar_count FROM market_bars GROUP BY symbol ORDER BY total_volume DESC;";
                      setSqlQuery(q);
                      handleRunSQL(q);
                    }}
                    className="px-2 py-1 bg-[#222838] hover:bg-[#2b3348] border border-[#313950] rounded text-[11px] text-purple-300 transition-colors font-mono"
                  >
                    💰 Volume Aggregation
                  </button>
                </div>

                {/* SQL input area + run button */}
                <div className="relative">
                  <textarea
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        handleRunSQL();
                      }
                    }}
                    rows={3}
                    placeholder="Enter DuckDB SQL query... (e.g. SELECT * FROM market_bars LIMIT 20;)"
                    className="w-full bg-[#0e1117] border border-[#2a2e39] focus:border-emerald-500 rounded p-2.5 font-mono text-xs text-gray-200 resize-y focus:outline-none"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <div>
                      {isExecutingSQL && (
                        <span className="text-xs text-emerald-400 flex items-center space-x-1.5 font-mono">
                          <RefreshCw size={12} className="animate-spin" />
                          <span>Executing query inside DuckDB WASM engine...</span>
                        </span>
                      )}
                      {sqlError && (
                        <span className="text-xs text-rose-400 font-mono">
                          DuckDB Error: {sqlError}
                        </span>
                      )}
                      {sqlResult && !sqlError && (
                        <span className="text-xs text-emerald-400 font-mono font-medium">
                          ⚡ Query executed in <span className="font-bold">{sqlResult.executionTimeMs}ms</span> • {sqlResult.rows.length} rows returned
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRunSQL()}
                      disabled={isExecutingSQL || !sqlQuery.trim()}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:opacity-50 text-white font-semibold text-xs rounded flex items-center space-x-1.5 transition-all shadow-md"
                    >
                      <Play size={12} fill="currentColor" />
                      <span>Run SQL Query</span>
                    </button>
                  </div>
                </div>

                {/* SQL Query Result Table */}
                {sqlResult && sqlResult.rows.length > 0 && (
                  <div className="mt-3 border border-[#2a2e39] rounded overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-[#222838] text-gray-300 border-b border-[#2a2e39] text-[11px] font-mono">
                        <tr>
                          {sqlResult.columns.map((col) => (
                            <th key={col} className="py-1.5 px-3 whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#202534] font-mono text-[11px] bg-[#10131c]">
                        {sqlResult.rows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-[#181d2a] transition-colors">
                            {sqlResult.columns.map((col) => {
                              const val = row[col];
                              return (
                                <td key={col} className="py-1.5 px-3 text-gray-300 whitespace-nowrap">
                                  {val != null ? String(val) : 'NULL'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* DuckDB Ingested Datasets Details Table */}
              {duckDBStats?.details && duckDBStats.details.length > 0 && (
                <div className="bg-[#181d2a] rounded-lg border border-[#2a2e39] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white text-xs tracking-wide uppercase">DuckDB Stored Datasets Breakdown</h4>
                    <span className="text-[10px] text-gray-500 font-mono">All rows verified real market quotes</span>
                  </div>
                  <div className="border border-[#2a2e39] rounded overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#222838] text-gray-400 border-b border-[#2a2e39] text-[11px]">
                        <tr>
                          <th className="py-2 px-3">Symbol</th>
                          <th className="py-2 px-3">Timeframe</th>
                          <th className="py-2 px-3">Total Rows</th>
                          <th className="py-2 px-3">First Bar Date</th>
                          <th className="py-2 px-3">Last Bar Date</th>
                          <th className="py-2 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2a2e39] font-mono text-[11px]">
                        {duckDBStats.details.map((d, i) => (
                          <tr key={`${d.symbol}-${d.timeframe}-${i}`} className="hover:bg-[#1f2535] transition-colors">
                            <td className="py-1.5 px-3 font-semibold text-white">{d.symbol}</td>
                            <td className="py-1.5 px-3 text-emerald-400">{d.timeframe}</td>
                            <td className="py-1.5 px-3 text-gray-200">{d.count.toLocaleString()} bars</td>
                            <td className="py-1.5 px-3 text-gray-400">
                              {new Date(d.minTime).toLocaleDateString()} {new Date(d.minTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-1.5 px-3 text-gray-400">
                              {new Date(d.maxTime).toLocaleDateString()} {new Date(d.maxTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-1.5 px-3 text-right">
                              <button
                                onClick={() => {
                                  const q = `SELECT * FROM market_bars WHERE symbol = '${d.symbol}' AND timeframe = '${d.timeframe}' ORDER BY time DESC LIMIT 20;`;
                                  setSqlQuery(q);
                                  handleRunSQL(q);
                                }}
                                className="px-2 py-0.5 rounded bg-blue-950 hover:bg-blue-900 text-blue-300 text-[10px] border border-blue-800 transition-colors"
                              >
                                Query Table
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* On-Demand Exchange Quote Downloader */}
              <div className="bg-[#171b26] p-4 rounded-lg border border-[#2a2e39]">
                <h4 className="font-semibold text-white text-xs mb-1">On-Demand Quote Downloader</h4>
                <p className="text-[11px] text-gray-400 mb-3">
                  Fetches live bars from Binance or Yahoo Finance and ingests them directly into DuckDB.
                </p>
                <div className="grid grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">SYMBOL</label>
                    <input
                      type="text"
                      value={downloadSymbol}
                      onChange={(e) => setDownloadSymbol(e.target.value.toUpperCase())}
                      className="w-full bg-[#1e222d] border border-[#2a2e39] rounded px-2 py-1 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">FREE DATA PROVIDER</label>
                    <select
                      value={downloadSource}
                      onChange={(e) => setDownloadSource(e.target.value as any)}
                      className="w-full bg-[#1e222d] border border-[#2a2e39] rounded px-2 py-1 text-xs text-white"
                    >
                      <option value="binance">Binance Public REST (Crypto)</option>
                      <option value="yahoo">Yahoo Finance (Futures NQ=F, ES=F, Equities)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">TIMEFRAME</label>
                    <select
                      value={downloadTf}
                      onChange={(e) => setDownloadTf(e.target.value)}
                      className="w-full bg-[#1e222d] border border-[#2a2e39] rounded px-2 py-1 text-xs text-white"
                    >
                      <option value="1m">1 minute</option>
                      <option value="5m">5 minutes</option>
                      <option value="15m">15 minutes</option>
                      <option value="1h">1 hour</option>
                      <option value="1D">1 Day</option>
                    </select>
                  </div>

                  <div>
                    <button
                      onClick={() => onDownloadQuotes(downloadSymbol, downloadSource, downloadTf)}
                      disabled={isDownloading}
                      className={`w-full py-1.5 rounded font-semibold text-xs text-white flex items-center justify-center space-x-1.5 transition-all ${
                        isDownloading
                          ? 'bg-gray-600 opacity-60 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-500'
                      }`}
                    >
                      <Download size={13} />
                      <span>{isDownloading ? 'Ingesting to DuckDB...' : 'Ingest to DuckDB'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. CONSOLE / COMPILER LOGS TAB */}
          {activeTab === 'logs' && (
            <div className="h-full p-3 font-mono text-[11px] overflow-y-auto space-y-1 bg-[#0e1117]">
              {compilerLogs.length > 0 ? (
                compilerLogs.map((log, index) => (
                  <div
                    key={index}
                    className={`leading-relaxed ${
                      log.includes('Error')
                        ? 'text-rose-400'
                        : log.includes('Completed')
                        ? 'text-emerald-400 font-semibold'
                        : 'text-gray-300'
                    }`}
                  >
                    {log}
                  </div>
                ))
              ) : (
                <div className="text-gray-600">Console ready. Compiler output and logs will appear here.</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Folder Selection Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e222d] border border-[#2a2e39] rounded-lg shadow-2xl w-full max-w-md p-5 space-y-4 text-xs text-gray-300">
            <div className="flex items-center justify-between border-b border-[#2a2e39] pb-3">
              <div className="flex items-center space-x-2 text-white font-bold text-sm">
                <FolderOpen size={16} className="text-emerald-400" />
                <span>Strategies Directory</span>
              </div>
              <button
                onClick={() => setIsFolderModalOpen(false)}
                className="text-gray-400 hover:text-white text-base leading-none"
              >
                &times;
              </button>
            </div>

            <div>
              <p className="text-gray-400 text-xs leading-relaxed">
                Enter the absolute or relative folder path where your <code className="text-emerald-400 font-mono">.pine</code> strategy files are located. NullHyper watches this folder in real-time.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider block">
                Folder Path:
              </label>
              <input
                type="text"
                value={customDirInput}
                onChange={(e) => setCustomDirInput(e.target.value)}
                placeholder="e.g. W:\algo\stupid\simple_2-9 or strategies"
                className="w-full bg-[#131722] border border-[#2a2e39] rounded px-3 py-2 text-white font-mono text-xs outline-none focus:border-emerald-500 transition-colors"
                autoFocus
              />
            </div>

            {/* Quick folder presets */}
            <div className="space-y-1">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider block">Quick Presets:</span>
              <div className="flex flex-col space-y-1">
                <button
                  type="button"
                  onClick={() => setCustomDirInput('W:\\algo\\nullhyper\\strategies')}
                  className="text-left px-2.5 py-1.5 rounded bg-[#161a24] hover:bg-[#202533] border border-[#262c3d] text-gray-300 hover:text-emerald-400 font-mono text-[11px] transition-colors truncate"
                >
                  📁 W:\algo\nullhyper\strategies (Default)
                </button>
                <button
                  type="button"
                  onClick={() => setCustomDirInput('W:\\algo\\stupid\\simple_2-9')}
                  className="text-left px-2.5 py-1.5 rounded bg-[#161a24] hover:bg-[#202533] border border-[#262c3d] text-gray-300 hover:text-emerald-400 font-mono text-[11px] transition-colors truncate"
                >
                  📁 W:\algo\stupid\simple_2-9 (External)
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#2a2e39]">
              <button
                type="button"
                onClick={() => setIsFolderModalOpen(false)}
                className="px-3 py-1.5 rounded bg-[#202533] hover:bg-[#2a3042] text-gray-300 text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyCustomDir}
                className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-sm"
              >
                Apply Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Save Strategy to File Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e222d] border border-[#2a2e39] rounded-lg shadow-2xl w-full max-w-md p-5 space-y-4 text-xs text-gray-300">
            <div className="flex items-center justify-between border-b border-[#2a2e39] pb-3">
              <div className="flex items-center space-x-2 text-white font-bold text-sm">
                <Save size={16} className="text-blue-400" />
                <span>Save Strategy to File</span>
              </div>
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="text-gray-400 hover:text-white text-base leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider block">
                Target Folder:
              </label>
              <div className="bg-[#131722] border border-[#2a2e39] rounded px-3 py-2 text-emerald-400 font-mono text-[11px] truncate">
                {activeFolder}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider block">
                Filename (.pine):
              </label>
              <input
                type="text"
                value={saveFilename}
                onChange={(e) => setSaveFilename(e.target.value)}
                placeholder="e.g. strategy_nq_breakout.pine"
                className="w-full bg-[#131722] border border-[#2a2e39] rounded px-3 py-2 text-white font-mono text-xs outline-none focus:border-blue-500 transition-colors"
                autoFocus
              />
            </div>

            {saveError && (
              <div className="p-2 rounded bg-rose-950/60 border border-rose-800/50 text-rose-300 text-xs">
                {saveError}
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#2a2e39]">
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="px-3 py-1.5 rounded bg-[#202533] hover:bg-[#2a3042] text-gray-300 text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={isSavingScript || !saveFilename.trim()}
                className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shadow-sm disabled:opacity-50"
              >
                <Save size={12} />
                <span>{isSavingScript ? 'Saving...' : 'Save File'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Strategy settings modal is handled by top-level StrategySettingsModal */}
    </div>
  );
};
