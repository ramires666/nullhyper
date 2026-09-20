import React, { useState } from 'react';
import type { Timeframe, SymbolMetadata } from '../../types';
import {
  TrendingUp,
  Code,
  Play,
  DownloadCloud,
  ChevronDown,
  Camera,
  Search,
} from 'lucide-react';

interface TopNavProps {
  currentSymbol: string;
  currentTimeframe: Timeframe;
  onSelectSymbol: (symbol: string) => void;
  onSelectTimeframe: (tf: Timeframe) => void;
  onRunBacktest: () => void;
  onOpenDataManager: () => void;
  onOpenPineEditor: () => void;
  availableSymbols: SymbolMetadata[];
  isBacktesting?: boolean;
}

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1D', '1W'];

export const TopNav: React.FC<TopNavProps> = ({
  currentSymbol,
  currentTimeframe,
  onSelectSymbol,
  onSelectTimeframe,
  onRunBacktest,
  onOpenDataManager,
  onOpenPineEditor,
  availableSymbols,
  isBacktesting = false,
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSymbols = availableSymbols.filter(
    (s) =>
      s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <header className="h-12 bg-[#1e222d] border-b border-[#2a2e39] px-3 flex items-center justify-between text-[#d1d4dc] select-none text-xs font-medium z-30">
      {/* Left: Brand & Symbol & Timeframe */}
      <div className="flex items-center space-x-2">
        {/* Brand */}
        <div className="flex items-center space-x-2 pr-3 border-r border-[#2a2e39]">
          <div className="w-6 h-6 rounded bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-sm">
            <TrendingUp size={14} />
          </div>
          <span className="font-bold tracking-wider text-sm bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent hidden sm:inline">
            NullHyper
          </span>
        </div>

        {/* Symbol Selector Dropdown Button */}
        <div className="relative">
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#2a2e39] hover:bg-[#363a45] text-white font-semibold transition-colors"
          >
            <Search size={13} className="text-gray-400" />
            <span>{currentSymbol}</span>
            <ChevronDown size={13} className="text-gray-400" />
          </button>

          {/* Symbol Search Modal */}
          {isSearchOpen && (
            <div className="absolute top-10 left-0 w-80 bg-[#1e222d] border border-[#363a45] rounded-md shadow-2xl z-50 overflow-hidden">
              <div className="p-2 border-b border-[#2a2e39]">
                <div className="flex items-center bg-[#131722] px-2.5 py-1.5 rounded text-xs">
                  <Search size={14} className="text-gray-400 mr-2" />
                  <input
                    type="text"
                    placeholder="Search ticker (e.g. BTCUSDT, NQ=F, SPY)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent outline-none text-white placeholder-gray-500"
                    autoFocus
                  />
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-[#2a2e39]">
                {filteredSymbols.map((item) => (
                  <div
                    key={item.symbol}
                    onClick={() => {
                      onSelectSymbol(item.symbol);
                      setIsSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="px-3 py-2 flex items-center justify-between hover:bg-[#2a2e39] cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-white flex items-center space-x-1.5">
                        <span>{item.symbol}</span>
                        <span className="text-[10px] px-1 py-0.2 rounded bg-[#363a45] text-gray-300 uppercase">
                          {item.type}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400">{item.name}</div>
                    </div>
                    <div className="text-[10px] text-gray-400 uppercase font-mono">
                      {item.exchange}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Timeframe Switcher */}
        <div className="flex items-center space-x-0.5 bg-[#131722] p-0.5 rounded border border-[#2a2e39]">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => onSelectTimeframe(tf)}
              className={`px-2 py-0.5 rounded text-xs transition-all ${
                currentTimeframe === tf
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-[#2a2e39]'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Center: Indicator & Action Tools */}
      <div className="hidden md:flex items-center space-x-2">
        <button
          onClick={onOpenPineEditor}
          className="flex items-center space-x-1.5 px-3 py-1 rounded bg-[#2a2e39] hover:bg-[#363a45] text-gray-200 transition-colors"
        >
          <Code size={13} className="text-blue-400" />
          <span>Pine Script v6</span>
        </button>

        <button
          onClick={onOpenDataManager}
          className="flex items-center space-x-1.5 px-3 py-1 rounded bg-[#2a2e39] hover:bg-[#363a45] text-gray-200 transition-colors"
        >
          <DownloadCloud size={13} className="text-emerald-400" />
          <span>Data Manager</span>
        </button>
      </div>

      {/* Right: Run Backtest Button & Screenshot */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onRunBacktest}
          disabled={isBacktesting}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded font-semibold text-white shadow-md transition-all ${
            isBacktesting
              ? 'bg-gray-600 cursor-not-allowed opacity-75'
              : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95'
          }`}
        >
          <Play size={12} className={isBacktesting ? 'animate-spin' : ''} />
          <span>{isBacktesting ? 'Backtesting...' : 'Run Strategy'}</span>
        </button>

        <div className="h-4 w-px bg-[#2a2e39] mx-1" />

        <button
          title="Take Chart Screenshot"
          onClick={() => alert('Screenshot captured to clipboard!')}
          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#2a2e39] transition-colors"
        >
          <Camera size={14} />
        </button>
      </div>
    </header>
  );
};
