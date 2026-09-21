import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { PineInputParam, BacktestReport } from '../../types';
import {
  Settings,
  X,
  RotateCcw,
  Sliders,
  HelpCircle,
  Search,
  Check,
  Zap,
  GripVertical,
  PanelRightClose,
  PanelRightOpen,
  Minimize2,
  Maximize2,
} from 'lucide-react';

export interface StrategySettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  strategyName?: string;
  strategyType?: string;
  inputs?: PineInputParam[];
  strategyInputs: Record<string, any>;
  onApplyStrategyParams?: (newParams: Record<string, any>) => void;
  onUpdateStrategyParam?: (paramId: string, value: any) => void;
  onResetStrategyParams: () => void;
  backtestReport?: BacktestReport | null;
  isDocked?: boolean;
  onToggleDock?: () => void;
}

export const StrategySettingsModal: React.FC<StrategySettingsPanelProps> = ({
  isOpen,
  onClose,
  strategyName,
  strategyType,
  inputs = [],
  strategyInputs,
  onApplyStrategyParams,
  onUpdateStrategyParam,
  onResetStrategyParams,
  backtestReport,
  isDocked = true,
  onToggleDock,
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [isMinimized, setIsMinimized] = useState(false);

  // Local draft inputs state so modifying fields DOES NOT auto-recalculate on every keystroke
  const [draftInputs, setDraftInputs] = useState<Record<string, any>>(() => ({ ...strategyInputs }));

  // Keep draftInputs in sync when strategyInputs changes from outside or modal re-opens
  useEffect(() => {
    setDraftInputs({ ...strategyInputs });
  }, [strategyInputs, isOpen]);

  // Check if draft inputs differ from committed strategyInputs
  const hasChanges = useMemo(() => {
    const draftKeys = Object.keys(draftInputs);
    const committedKeys = Object.keys(strategyInputs);
    if (draftKeys.length !== committedKeys.length) return true;
    for (const k of draftKeys) {
      if (draftInputs[k] !== strategyInputs[k]) return true;
    }
    return false;
  }, [draftInputs, strategyInputs]);

  const handleUpdateDraft = (paramId: string, value: any) => {
    setDraftInputs((prev) => ({ ...prev, [paramId]: value }));
  };

  const handleApply = (shouldClose: boolean = false) => {
    if (onApplyStrategyParams) {
      onApplyStrategyParams(draftInputs);
    } else if (onUpdateStrategyParam) {
      for (const [id, val] of Object.entries(draftInputs)) {
        onUpdateStrategyParam(id, val);
      }
    }
    if (shouldClose) {
      onClose();
    }
  };

  const handleReset = () => {
    setDraftInputs({});
    onResetStrategyParams();
  };

  const handleCancel = () => {
    setDraftInputs({ ...strategyInputs });
    onClose();
  };

  // Floating window drag coordinates
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const defaultX = Math.max(20, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 860);
    const defaultY = 56;
    return { x: defaultX, y: defaultY };
  });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: position.x,
    initY: position.y,
  });

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isDocked) return;
    if ((e.target as HTMLElement).closest('button, input, select, a')) return;
    isDraggingRef.current = true;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: position.x,
      initY: position.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || isDocked) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    const newX = Math.max(10, Math.min(window.innerWidth - 530, dragStartRef.current.initX + dx));
    const newY = Math.max(10, Math.min(window.innerHeight - 80, dragStartRef.current.initY + dy));
    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Group inputs by group name
  const { groups, groupNames } = useMemo(() => {
    const map: Record<string, PineInputParam[]> = {};
    for (const inp of inputs) {
      const g = inp.group || 'General Settings';
      if (!map[g]) map[g] = [];
      map[g].push(inp);
    }
    return { groups: map, groupNames: Object.keys(map) };
  }, [inputs]);

  // Filtered groups based on search & active tab
  const filteredGroups = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    const result: Record<string, PineInputParam[]> = {};

    for (const [gName, gParams] of Object.entries(groups)) {
      if (selectedGroup !== 'ALL' && gName !== selectedGroup) continue;

      const matchedParams = gParams.filter((p) => {
        if (!q) return true;
        return (
          p.title.toLowerCase().includes(q) ||
          p.varName.toLowerCase().includes(q) ||
          (p.group && p.group.toLowerCase().includes(q)) ||
          (p.tooltip && p.tooltip.toLowerCase().includes(q))
        );
      });

      if (matchedParams.length > 0) {
        result[gName] = matchedParams;
      }
    }
    return result;
  }, [groups, searchFilter, selectedGroup]);

  if (!isOpen) return null;

  // Render Inner Panel Content
  const renderPanelContent = () => (
    <div className="flex flex-col h-full overflow-hidden text-sm text-[#d1d4dc] select-none">
      {/* 1. Panel Header */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`flex items-center justify-between px-4 py-3 border-b border-[#2a3245] bg-[#141824] flex-shrink-0 ${
          !isDocked ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
      >
        <div className="flex items-center space-x-2.5 min-w-0 pr-2">
          {!isDocked && (
            <span title="Зажмите и перетащите панель" className="flex-shrink-0 cursor-grab">
              <GripVertical size={16} className="text-gray-400" />
            </span>
          )}
          <div className="p-1.5 rounded-md bg-blue-600/25 text-blue-400 border border-blue-500/40 flex-shrink-0">
            <Settings size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-white font-bold text-sm sm:text-base truncate" title={strategyName}>
                {strategyName || backtestReport?.strategyName || 'Параметры стратегии'}
              </span>
              {strategyType && (
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/50 uppercase flex-shrink-0">
                  {strategyType}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400 font-mono block truncate mt-0.5">
              America/New_York Engine • Pine v6
            </span>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center space-x-1.5 flex-shrink-0">
          {onToggleDock && (
            <button
              type="button"
              onClick={onToggleDock}
              className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-[#22293a] transition-colors"
              title={isDocked ? 'Открепить в плавающее окно' : 'Закрепить сбоку от графика'}
            >
              {isDocked ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            </button>
          )}

          {!isDocked && (
            <button
              type="button"
              onClick={() => setIsMinimized((p) => !p)}
              className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-[#22293a] transition-colors"
              title={isMinimized ? 'Развернуть' : 'Свернуть'}
            >
              {isMinimized ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
            </button>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="p-1.5 rounded-md text-gray-400 hover:text-amber-400 hover:bg-[#22293a] transition-colors"
            title="Сбросить все параметры к значениям по умолчанию"
          >
            <RotateCcw size={15} />
          </button>

          <button
            type="button"
            onClick={handleCancel}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-[#22293a] transition-colors"
            title="Закрыть панель настроек"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* 2. Recalculation Status & Backtest Metrics Banner */}
          <div className="px-4 py-2.5 bg-[#101420] border-b border-[#23293a] flex flex-wrap items-center justify-between gap-2 text-xs flex-shrink-0">
            <div className="flex items-center space-x-2">
              {hasChanges ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                  <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                    Параметры изменены • Нажмите «Готово»
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0" />
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                    Параметры применены
                  </span>
                </>
              )}
            </div>

            {backtestReport && (
              <div className="flex items-center space-x-2 font-mono text-xs">
                <span className="px-2 py-1 rounded bg-[#1c2233] text-gray-200 border border-[#2b354e]">
                  Сделок: <strong className="text-white font-bold">{backtestReport.totalTrades}</strong>
                </span>
                <span
                  className={`px-2 py-1 rounded border font-bold text-sm ${
                    backtestReport.netProfit >= 0
                      ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                      : 'bg-rose-950/80 text-rose-400 border-rose-800/60'
                  }`}
                >
                  {backtestReport.netProfit >= 0 ? '+' : ''}$
                  {backtestReport.netProfit.toLocaleString()}
                </span>
                <span className="px-2 py-1 rounded bg-[#1c2233] text-gray-300 border border-[#2b354e]">
                  Win: <strong className="text-emerald-400 font-bold">{backtestReport.winRate}%</strong>
                </span>
              </div>
            )}
          </div>

          {/* 3. Search Bar & Category Navigation Tabs */}
          <div className="px-4 py-2.5 bg-[#141824] border-b border-[#262c3d] flex flex-col gap-2 flex-shrink-0">
            {/* Search Input */}
            <div className="relative w-full">
              <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск параметра (sl, buffer, session)..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-[#1b202e] border border-[#2f374a] rounded-md pl-9 pr-3 py-1.5 text-white placeholder-gray-500 text-sm outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Category Filter Pills */}
            {groupNames.length > 1 && (
              <div className="flex items-center space-x-1.5 overflow-x-auto py-0.5 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedGroup('ALL')}
                  className={`px-3 py-1 rounded text-xs font-semibold whitespace-nowrap transition-colors ${
                    selectedGroup === 'ALL'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-[#1b202e] text-gray-400 hover:text-white hover:bg-[#252c3f]'
                  }`}
                >
                  Все ({inputs.length})
                </button>
                {groupNames.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSelectedGroup(g)}
                    className={`px-3 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                      selectedGroup === g
                        ? 'bg-blue-600 text-white font-semibold shadow-sm'
                        : 'bg-[#1b202e] text-gray-400 hover:text-white hover:bg-[#252c3f]'
                    }`}
                  >
                    {g} ({groups[g].length})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 4. Scrollable Parameters List */}
          <div
            style={{
              flex: '1 1 0%',
              minHeight: 0,
              overflowY: 'auto',
              padding: '14px 16px',
            }}
            className="space-y-4"
          >
            {inputs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Sliders size={36} className="mx-auto mb-2 opacity-30 text-gray-400" />
                <p className="font-semibold text-gray-300 text-sm">Параметры input() не найдены</p>
              </div>
            ) : Object.keys(filteredGroups).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm text-gray-400">Ничего не найдено по запросу "{searchFilter}"</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchFilter('');
                    setSelectedGroup('ALL');
                  }}
                  className="mt-2 text-sm text-blue-400 hover:underline font-semibold"
                >
                  Сбросить фильтры
                </button>
              </div>
            ) : (
              Object.entries(filteredGroups).map(([groupName, groupParams]) => (
                <div
                  key={groupName}
                  className="bg-[#151924] rounded-lg border border-[#272e40] p-3 space-y-2.5 shadow-sm"
                >
                  {/* Group Title */}
                  <div className="text-sm font-bold text-gray-100 border-b border-[#232938] pb-2 flex items-center justify-between">
                    <span className="text-blue-400 flex items-center space-x-2">
                      <span>📁</span>
                      <span>{groupName}</span>
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      {groupParams.length}
                    </span>
                  </div>

                  {/* Parameter Controls */}
                  <div className="space-y-2.5 pt-1">
                    {groupParams.map((param) => {
                      const currentVal =
                        draftInputs[param.id] !== undefined
                          ? draftInputs[param.id]
                          : param.value !== undefined
                          ? param.value
                          : param.defval;

                      return (
                        <div
                          key={param.id}
                          className="bg-[#1b202e] border border-[#2a3245] rounded-lg p-2.5 flex items-center justify-between gap-3 hover:border-[#38435d] transition-colors"
                        >
                          {/* Label & Tooltip */}
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="flex items-center space-x-1.5 flex-wrap">
                              <span className="font-medium text-gray-100 text-sm leading-snug" title={param.title}>
                                {param.title}
                              </span>
                              {param.tooltip && (
                                <span
                                  title={param.tooltip}
                                  className="cursor-help text-gray-400 hover:text-blue-400 flex-shrink-0"
                                >
                                  <HelpCircle size={14} />
                                </span>
                              )}
                            </div>
                            {param.title !== param.varName && (
                              <span className="text-xs text-gray-400 font-mono block truncate mt-0.5">
                                {param.varName}
                              </span>
                            )}
                          </div>

                          {/* Control */}
                          <div className="flex-shrink-0">
                            {/* BOOL TOGGLE */}
                            {param.type === 'bool' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateDraft(param.id, !currentVal)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                                  currentVal ? 'bg-emerald-600' : 'bg-gray-700'
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    currentVal ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            )}

                            {/* STRING DROPDOWN WITH OPTIONS */}
                            {param.options && param.options.length > 0 && (
                              <select
                                value={String(currentVal)}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const parsed =
                                    !isNaN(Number(raw)) && param.type !== 'string'
                                      ? Number(raw)
                                      : raw;
                                  handleUpdateDraft(param.id, parsed);
                                }}
                                className="bg-[#11141e] border border-[#2e374c] rounded-md px-2.5 py-1.5 text-white text-sm outline-none focus:border-blue-500 max-w-[210px] font-sans cursor-pointer"
                              >
                                {param.options.map((opt) => (
                                  <option key={String(opt)} value={String(opt)}>
                                    {String(opt)}
                                  </option>
                                ))}
                              </select>
                            )}

                            {/* NUMERIC STEPPER */}
                            {(!param.options || param.options.length === 0) &&
                              (param.type === 'int' || param.type === 'float') && (
                                <div className="flex items-center space-x-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const stepVal =
                                        param.step || (param.type === 'int' ? 1 : 0.5);
                                      const nextVal = Number(
                                        (Number(currentVal) - stepVal).toFixed(4)
                                      );
                                      if (param.minval !== undefined && nextVal < param.minval)
                                        return;
                                      handleUpdateDraft(param.id, nextVal);
                                    }}
                                    className="w-7 h-7 rounded bg-[#242b3d] hover:bg-[#30394f] text-gray-100 flex items-center justify-center font-bold text-sm border border-[#323c52] transition-colors"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    value={currentVal !== undefined ? currentVal : ''}
                                    step={param.step || (param.type === 'int' ? 1 : 0.1)}
                                    min={param.minval}
                                    max={param.maxval}
                                    onChange={(e) => {
                                      const num = parseFloat(e.target.value);
                                      handleUpdateDraft(
                                        param.id,
                                        isNaN(num)
                                          ? 0
                                          : param.type === 'int'
                                          ? Math.round(num)
                                          : num
                                      );
                                    }}
                                    style={{ width: '68px' }}
                                    className="bg-[#11141e] border border-[#2e374c] rounded px-1.5 py-1 text-center text-white font-mono text-sm font-semibold outline-none focus:border-blue-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const stepVal =
                                        param.step || (param.type === 'int' ? 1 : 0.5);
                                      const nextVal = Number(
                                        (Number(currentVal) + stepVal).toFixed(4)
                                      );
                                      if (param.maxval !== undefined && nextVal > param.maxval)
                                        return;
                                      handleUpdateDraft(param.id, nextVal);
                                    }}
                                    className="w-7 h-7 rounded bg-[#242b3d] hover:bg-[#30394f] text-gray-100 flex items-center justify-center font-bold text-sm border border-[#323c52] transition-colors"
                                  >
                                    +
                                  </button>
                                </div>
                              )}

                            {/* SESSION / PLAIN STRING */}
                            {(!param.options || param.options.length === 0) &&
                              (param.type === 'string' || param.type === 'session') && (
                                <input
                                  type="text"
                                  value={String(currentVal || '')}
                                  placeholder={
                                    param.type === 'session' ? 'e.g. 0200-0230' : ''
                                  }
                                  onChange={(e) =>
                                    handleUpdateDraft(param.id, e.target.value)
                                  }
                                  className="w-32 bg-[#11141e] border border-[#2e374c] rounded-md px-3 py-1.5 text-white font-mono text-sm outline-none focus:border-blue-500"
                                />
                              )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 5. Sticky Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#2a2e39] bg-[#141824] flex-shrink-0">
            <div className="flex items-center space-x-2 text-xs">
              {hasChanges ? (
                <div className="flex items-center space-x-1.5 text-amber-300">
                  <Zap size={14} className="text-amber-400 flex-shrink-0" />
                  <span className="font-medium">Ожидает нажатия «Готово»</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 text-gray-400">
                  <Check size={14} className="text-emerald-400 flex-shrink-0" />
                  <span>Параметры актуальны</span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                onClick={handleReset}
                className="px-3.5 py-1.5 rounded-md bg-[#242b3b] hover:bg-[#2e374c] text-gray-200 text-sm font-medium transition-colors"
                title="Сбросить все параметры к значениям по умолчанию"
              >
                Сброс
              </button>

              <button
                type="button"
                onClick={handleCancel}
                className="px-3.5 py-1.5 rounded-md bg-[#1e2330] hover:bg-[#2a3245] text-gray-300 text-sm font-medium transition-colors border border-[#2e374c]"
                title="Отменить изменения и закрыть"
              >
                Отмена
              </button>

              <button
                type="button"
                onClick={() => handleApply(false)}
                disabled={!hasChanges}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors border ${
                  hasChanges
                    ? 'bg-[#1b253b] text-blue-300 border-blue-500/60 hover:bg-blue-600/30 cursor-pointer'
                    : 'bg-[#181d2a] text-gray-500 border-[#2a3245] cursor-not-allowed opacity-50'
                }`}
                title="Пересчитать стратегию по новым параметрам (оставив панель открытой)"
              >
                Применить
              </button>

              <button
                type="button"
                onClick={() => handleApply(true)}
                className="flex items-center space-x-1.5 px-5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-sm transition-all shadow-md cursor-pointer"
                title="Пересчитать стратегию по новым параметрам и закрыть окно"
              >
                <Check size={16} />
                <span>Готово</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  // If DOCKED: rendered directly inside App's workspace sidebar (NO backdrop at all!)
  if (isDocked) {
    return (
      <aside style={{ width: '540px', minWidth: '540px' }} className="border-l border-[#2a2e39] bg-[#151924] flex flex-col h-full flex-shrink-0 z-20 shadow-xl">
        {renderPanelContent()}
      </aside>
    );
  }

  // If FLOATING: rendered as a draggable floating tool window with ABSOLUTELY NO blocking black overlay/backdrop!
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'none', // Chart behind remains 100% interactive and fully visible!
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: '560px',
          maxHeight: isMinimized ? 'auto' : 'calc(100vh - 80px)',
          height: isMinimized ? 'auto' : '760px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'rgba(21, 25, 36, 0.95)',
          backdropFilter: 'blur(8px)',
          border: '1px solid #36415a',
          borderRadius: '12px',
          boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.85)',
          overflow: 'hidden',
          pointerEvents: 'auto', // Panel itself is fully interactive
        }}
      >
        {renderPanelContent()}
      </div>
    </div>
  );
};
