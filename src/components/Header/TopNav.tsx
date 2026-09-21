import React, { useState, useRef, useEffect } from 'react';
import type { Timeframe, SymbolMetadata, PineScriptTemplate } from '../../types';
import {
  TrendingUp,
  Play,
  ChevronDown,
  Camera,
  Search,
  Settings,
  Zap,
  Check,
  FileCode2,
  Clock,
} from 'lucide-react';

interface TopNavProps {
  currentSymbol: string;
  currentTimeframe: Timeframe;
  onSelectSymbol: (symbol: string) => void;
  onSelectTimeframe: (timeframe: Timeframe) => void;
  onRunBacktest: () => void;
  availableSymbols: SymbolMetadata[];
  isBacktesting?: boolean;
  onOpenInputs?: () => void;
  inputsCount?: number;
  activeStrategyName?: string;
  activeStrategyType?: string;
  strategies?: PineScriptTemplate[];
  selectedTemplateId?: string;
  onSelectTemplate?: (templateId: string) => void;
  chartTimezone?: string;
  onSelectTimezone?: (tz: string) => void;
}

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1D', '1W'];

export const TopNav: React.FC<TopNavProps> = ({
  currentSymbol,
  currentTimeframe,
  onSelectSymbol,
  onSelectTimeframe,
  onRunBacktest,
  availableSymbols,
  isBacktesting = false,
  onOpenInputs,
  inputsCount,
  activeStrategyName,
  activeStrategyType,
  strategies = [],
  selectedTemplateId,
  onSelectTemplate,
  chartTimezone = 'America/New_York',
  onSelectTimezone,
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isStrategyMenuOpen, setIsStrategyMenuOpen] = useState(false);
  const [isTzMenuOpen, setIsTzMenuOpen] = useState(false);

  const stratMenuRef = useRef<HTMLDivElement>(null);
  const tzMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (stratMenuRef.current && !stratMenuRef.current.contains(e.target as Node)) {
        setIsStrategyMenuOpen(false);
      }
      if (tzMenuRef.current && !tzMenuRef.current.contains(e.target as Node)) {
        setIsTzMenuOpen(false);
      }
    };
    if (isStrategyMenuOpen || isTzMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isStrategyMenuOpen, isTzMenuOpen]);

  const filteredSymbols = availableSymbols.filter(
    (s) =>
      s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayName =
    activeStrategyName ||
    strategies.find((s) => s.id === selectedTemplateId)?.title ||
    strategies.find((s) => s.id === selectedTemplateId)?.name ||
    'Стратегия';

  return (
    <header className="h-12 bg-[#1e222d] border-b border-[#2a2e39] px-3.5 flex items-center justify-between text-[#d1d4dc] select-none text-sm font-medium z-30">
      {/* 1. Left: Brand & Symbol & Timeframe */}
      <div className="flex items-center space-x-2.5">
        {/* Brand */}
        <div className="flex items-center space-x-2 pr-3 border-r border-[#2a2e39]">
          <div className="w-7 h-7 rounded-md bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-sm">
            <TrendingUp size={16} />
          </div>
          <span className="font-bold tracking-wider text-base bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent hidden sm:inline">
            NullHyper
          </span>
        </div>

        {/* Symbol Selector Dropdown Button */}
        <div className="relative">
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-[#2a2e39] hover:bg-[#363a45] text-white font-bold text-sm transition-colors"
          >
            <Search size={14} className="text-gray-400" />
            <span>{currentSymbol}</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {/* Symbol Search Modal */}
          {isSearchOpen && (
            <div className="absolute top-11 left-0 w-84 bg-[#1e222d] border border-[#363a45] rounded-lg shadow-2xl z-50 overflow-hidden">
              <div className="p-2.5 border-b border-[#2a2e39]">
                <div className="flex items-center bg-[#131722] px-3 py-2 rounded-md text-sm">
                  <Search size={15} className="text-gray-400 mr-2" />
                  <input
                    type="text"
                    placeholder="Поиск тикера (BTCUSDT, NQ=F, SPY)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent outline-none text-white placeholder-gray-500 text-sm"
                    autoFocus
                  />
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-[#2a2e39]">
                {filteredSymbols.map((item) => (
                  <div
                    key={item.symbol}
                    onClick={() => {
                      onSelectSymbol(item.symbol);
                      setIsSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="px-3.5 py-2.5 flex items-center justify-between hover:bg-[#2a2e39] cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="font-bold text-white flex items-center space-x-2 text-sm">
                        <span>{item.symbol}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[#363a45] text-gray-300 uppercase">
                          {item.type}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{item.name}</div>
                    </div>
                    <div className="text-xs text-gray-400 uppercase font-mono">
                      {item.exchange}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Timeframe Switcher */}
        <div className="flex items-center space-x-1 bg-[#131722] p-1 rounded-md border border-[#2a2e39]">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => onSelectTimeframe(tf)}
              className={`px-2.5 py-1 rounded text-sm transition-all ${
                currentTimeframe === tf
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-gray-300 hover:text-white hover:bg-[#2a2e39] font-medium'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Timezone Switcher */}
        <div className="relative" ref={tzMenuRef}>
          <button
            onClick={() => setIsTzMenuOpen(!isTzMenuOpen)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-[#181d28] hover:bg-[#222938] border border-[#2b3548] text-xs font-semibold text-gray-200 transition-colors shadow-sm"
            title={`Часовой пояс оси графика: ${chartTimezone}. Кликните для выбора.`}
          >
            <Clock size={13} className="text-amber-400" />
            <span className="font-mono">
              {chartTimezone === 'America/New_York'
                ? '🗽 NY (UTC-4)'
                : chartTimezone === 'local'
                ? '💻 Local'
                : '🌐 UTC'}
            </span>
            <ChevronDown size={12} className="text-gray-400" />
          </button>

          {isTzMenuOpen && (
            <div className="absolute top-10 left-0 w-64 bg-[#1a1e2b] border border-[#353e54] rounded-xl shadow-2xl z-50 overflow-hidden py-1 divide-y divide-[#242a3a]">
              <div className="px-3 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider bg-[#131722] flex items-center justify-between">
                <span>Часовой пояс графика</span>
                <span className="text-[10px] text-emerald-400 font-mono">Шкала X</span>
              </div>
              <div className="p-1 space-y-0.5">
                {[
                  {
                    id: 'America/New_York',
                    icon: '🗽',
                    label: 'New York (EDT/EST, UTC-4)',
                    sub: 'Время американской сессии (NQ, ES, 02:00 NY)',
                  },
                  {
                    id: 'Etc/UTC',
                    icon: '🌐',
                    label: 'UTC (00:00)',
                    sub: 'Всемирное координированное время',
                  },
                  {
                    id: 'local',
                    icon: '💻',
                    label: 'Local (Системное время)',
                    sub: 'Время вашего компьютера',
                  },
                ].map((opt) => {
                  const isSelected = chartTimezone === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        onSelectTimezone?.(opt.id);
                        setIsTzMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-blue-600/20 text-blue-400 font-bold border border-blue-500/30'
                          : 'text-gray-300 hover:bg-[#252c3e]'
                      }`}
                    >
                      <div className="flex flex-col pr-2">
                        <span className="flex items-center space-x-1.5">
                          <span>{opt.icon}</span>
                          <span>{opt.label}</span>
                        </span>
                        <span className="text-[10px] text-gray-400 font-normal mt-0.5">
                          {opt.sub}
                        </span>
                      </div>
                      {isSelected && <Check size={14} className="text-blue-400 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Center: PROMINENT STRATEGY DISPLAY & QUICK SWITCHER */}
      <div className="flex items-center space-x-2.5">
        {/* Strategy Selector Dropdown */}
        <div className="relative" ref={stratMenuRef}>
          <button
            onClick={() => setIsStrategyMenuOpen(!isStrategyMenuOpen)}
            className="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg bg-[#242b3d] hover:bg-[#2f384f] border border-[#3b455f] text-white transition-all shadow-sm max-w-[320px] sm:max-w-[440px]"
            title="Текущая активная стратегия. Нажмите для выбора другой стратегии"
          >
            <Zap size={16} className="text-amber-400 flex-shrink-0" />
            <span className="font-bold text-sm text-white truncate">
              {displayName}
            </span>
            {activeStrategyType && (
              <span className="hidden md:inline-block px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/40 uppercase flex-shrink-0">
                {activeStrategyType}
              </span>
            )}
            <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
          </button>

          {/* Strategy Switcher Dropdown */}
          {isStrategyMenuOpen && (
            <div className="absolute top-11 left-0 w-84 sm:w-96 bg-[#1a1e2b] border border-[#353e54] rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-[#262d3e]">
              <div className="px-3.5 py-2.5 bg-[#131722] flex items-center justify-between text-xs font-semibold text-gray-400">
                <span className="flex items-center space-x-2">
                  <FileCode2 size={15} className="text-blue-400" />
                  <span>ВЫБОР СТРАТЕГИИ / СКРИПТА</span>
                </span>
                <span className="text-xs text-gray-500 font-mono">
                  {strategies.length} доступно
                </span>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-[#242a3a]">
                {strategies.map((strat) => {
                  const isSelected =
                    strat.id === selectedTemplateId ||
                    (strat.title && displayName.includes(strat.title)) ||
                    (strat.name && displayName.includes(strat.name));

                  return (
                    <div
                      key={strat.id}
                      onClick={() => {
                        onSelectTemplate?.(strat.id);
                        setIsStrategyMenuOpen(false);
                      }}
                      className={`p-3 cursor-pointer transition-colors flex items-center justify-between gap-2.5 ${
                        isSelected
                          ? 'bg-blue-600/20 border-l-2 border-blue-500'
                          : 'hover:bg-[#252c3e]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-sm font-semibold truncate ${
                              isSelected ? 'text-blue-400' : 'text-gray-100'
                            }`}
                          >
                            {strat.name || strat.title || strat.id}
                          </span>
                          {strat.type && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-[#2e374c] text-gray-300 uppercase">
                              {strat.type}
                            </span>
                          )}
                        </div>
                        {strat.filename && (
                          <div className="text-xs text-gray-400 font-mono truncate mt-0.5">
                            📄 {strat.filename}
                          </div>
                        )}
                      </div>

                      {isSelected && (
                        <Check size={16} className="text-blue-400 flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Quick Settings (Inputs) Button */}
        {onOpenInputs && (
          <button
            onClick={onOpenInputs}
            className="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-sm active:scale-95 border border-blue-400/30"
            title="Открыть настройки параметров стратегии (Inputs)"
          >
            <Settings size={15} />
            <span>Параметры</span>
            {inputsCount !== undefined && inputsCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-black/30 text-blue-200 text-xs font-mono font-bold">
                {inputsCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* 3. Right: Run Backtest Button & Screenshot */}
      <div className="flex items-center space-x-2.5">
        <button
          onClick={onRunBacktest}
          disabled={isBacktesting}
          className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg font-bold text-sm text-white shadow-md transition-all ${
            isBacktesting
              ? 'bg-gray-600 cursor-not-allowed opacity-75'
              : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95'
          }`}
        >
          <Play size={14} className={isBacktesting ? 'animate-spin' : ''} />
          <span>{isBacktesting ? 'Расчет...' : 'Запустить'}</span>
        </button>

        <div className="h-5 w-px bg-[#2a2e39] mx-1" />

        <button
          title="Снимок графика"
          onClick={() => {
            const canvas = document.querySelector('canvas');
            if (!canvas) return;
            canvas.toBlob((blob) => {
              if (!blob) return;
              try {
                navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
              } catch {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${currentSymbol}_chart.png`;
                a.click();
                URL.revokeObjectURL(url);
              }
            });
          }}
          className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-[#2a2e39] transition-colors"
        >
          <Camera size={16} />
        </button>
      </div>
    </header>
  );
};
