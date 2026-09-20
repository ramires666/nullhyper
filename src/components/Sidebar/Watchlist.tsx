import React from 'react';
import type { SymbolMetadata, Bar } from '../../types';
import { Eye, Info } from 'lucide-react';

interface WatchlistProps {
  symbols: SymbolMetadata[];
  activeSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  latestBar?: Bar;
}

export const Watchlist: React.FC<WatchlistProps> = ({
  symbols,
  activeSymbol,
  onSelectSymbol,
  latestBar,
}) => {
  return (
    <aside className="w-64 bg-[#1e222d] border-l border-[#2a2e39] flex flex-col select-none text-xs z-20">
      {/* Header */}
      <div className="h-9 border-b border-[#2a2e39] px-3 flex items-center justify-between font-semibold text-gray-300">
        <div className="flex items-center space-x-1.5">
          <Eye size={13} className="text-blue-400" />
          <span>Watchlist</span>
        </div>
        <span className="text-[10px] text-gray-500 font-mono">{symbols.length} Assets</span>
      </div>

      {/* Symbol List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#2a2e39]">
        {symbols.map((item) => {
          const isSelected = item.symbol === activeSymbol;
          return (
            <div
              key={item.symbol}
              onClick={() => onSelectSymbol(item.symbol)}
              className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-[#2a2e39] border-l-2 border-blue-500'
                  : 'hover:bg-[#252936]'
              }`}
            >
              <div>
                <div className="font-bold text-white flex items-center space-x-1">
                  <span>{item.symbol}</span>
                  <span className="text-[9px] px-1 py-0.5 rounded bg-[#131722] text-gray-400 uppercase">
                    {item.type}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 truncate max-w-[130px]">{item.name}</div>
              </div>

              <div className="text-right">
                <div className="text-[10px] font-mono font-medium text-gray-400">
                  {item.exchange}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Data Inspector Card */}
      {latestBar && (
        <div className="p-3 border-t border-[#2a2e39] bg-[#171b26]">
          <div className="flex items-center space-x-1.5 text-gray-400 font-semibold mb-2">
            <Info size={12} className="text-indigo-400" />
            <span>Market Inspector</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="bg-[#1e222d] p-1.5 rounded border border-[#2a2e39]">
              <span className="text-gray-500 block text-[9px]">OPEN</span>
              <span className="text-gray-200 font-semibold">{latestBar.open.toLocaleString()}</span>
            </div>
            <div className="bg-[#1e222d] p-1.5 rounded border border-[#2a2e39]">
              <span className="text-gray-500 block text-[9px]">HIGH</span>
              <span className="text-emerald-400 font-semibold">{latestBar.high.toLocaleString()}</span>
            </div>
            <div className="bg-[#1e222d] p-1.5 rounded border border-[#2a2e39]">
              <span className="text-gray-500 block text-[9px]">LOW</span>
              <span className="text-rose-400 font-semibold">{latestBar.low.toLocaleString()}</span>
            </div>
            <div className="bg-[#1e222d] p-1.5 rounded border border-[#2a2e39]">
              <span className="text-gray-500 block text-[9px]">CLOSE</span>
              <span className="text-white font-bold">{latestBar.close.toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-2 text-[10px] text-gray-400 flex justify-between">
            <span>VOLUME:</span>
            <span className="font-mono text-gray-200">{latestBar.volume.toLocaleString()}</span>
          </div>
        </div>
      )}
    </aside>
  );
};
