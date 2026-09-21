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
  Play,
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

  // Local inputs state for responsive typing and instant updates
  const [localInputs, setLocalInputs] = useState<Record<string, any>>(() => ({ ...strategyInputs }));
  const [hasUnappliedChanges, setHasUnappliedChanges] = useState<boolean>(false);
  const [autoRecalc, setAutoRecalc] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nullhyper_auto_recalc') === 'true'; // OFF by default!
    } catch {
      return false;
    }
  });
  const debounceTimerRef = useRef<any>(null);

  // Keep localInputs in sync when strategyInputs changes from outside or modal re-opens
  useEffect(() => {
    setLocalInputs({ ...strategyInputs });
    setHasUnappliedChanges(false);
  }, [strategyInputs, isOpen]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Keyboard shortcut: Ctrl+Enter (or Cmd+Enter) to instantly apply and recalculate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleApply();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [localInputs]);

  // Toggle auto-recalculation mode
  const handleToggleAutoRecalc = () => {
    setAutoRecalc((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('nullhyper_auto_recalc', String(next));
      } catch {}
      if (next && onApplyStrategyParams) {
        onApplyStrategyParams(localInputs);
        setHasUnappliedChanges(false);
      }
      return next;
    });
  };

  // Immediate commit for toggles, steppers, and selects (SAVES TO LOCALSTORAGE, NO HEAVY CALCULATION)
  const commitParam = (paramId: string, value: any) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const updated = { ...localInputs, [paramId]: value };
    setLocalInputs(updated);
    setHasUnappliedChanges(true);

    // Save parameter to localStorage immediately via parent
    if (onUpdateStrategyParam) {
      onUpdateStrategyParam(paramId, value);
    }

    // Only auto-recalculate if user explicitly turned on autoRecalc
    if (autoRecalc && onApplyStrategyParams) {
      onApplyStrategyParams(updated);
      setHasUnappliedChanges(false);
    }
  };

  // Debounced input for text or number typing
  const handleDebouncedInput = (paramId: string, value: any) => {
    const updated = { ...localInputs, [paramId]: value };
    setLocalInputs(updated);
    setHasUnappliedChanges(true);

    if (onUpdateStrategyParam) {
      onUpdateStrategyParam(paramId, value);
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      if (autoRecalc && onApplyStrategyParams) {
        onApplyStrategyParams(updated);
        setHasUnappliedChanges(false);
      }
    }, 350);
  };

  // Explicit calculation action ("Применить и рассчитать")
  const handleApply = (shouldClose: boolean = false) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (onApplyStrategyParams) {
      onApplyStrategyParams(localInputs);
    }
    setHasUnappliedChanges(false);
    if (shouldClose) {
      onClose();
    }
  };

  const handleReset = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setLocalInputs({});
    setHasUnappliedChanges(false);
    onResetStrategyParams();
  };

  // Closing simply closes the modal; all changes are already permanently auto-saved!
  const handleClose = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
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
            onClick={handleClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-[#22293a] transition-colors"
            title="Закрыть панель (все параметры сохранены)"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* 2. Recalculation Status & Backtest Metrics Banner */}
          <div className="px-4 py-2.5 bg-[#101420] border-b border-[#23293a] flex flex-wrap items-center justify-between gap-2 text-xs flex-shrink-0">
            <div className="flex items-center space-x-2.5 flex-wrap">
              {hasUnappliedChanges ? (
                <div className="flex items-center space-x-1.5 text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                  <span className="font-semibold text-xs">
                    Параметры сохранены • Нажмите «Применить»
                  </span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                  <span className="font-semibold text-xs">
                    ✓ Расчет актуален • Сохранено в памяти
                  </span>
                </div>
              )}

              {/* Auto-recalculation toggle (Disabled by default!) */}
              <button
                type="button"
                onClick={handleToggleAutoRecalc}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                  autoRecalc
                    ? 'bg-blue-950/80 text-blue-300 border-blue-500/60 shadow-[0_0_10px_rgba(59,130,246,0.25)]'
                    : 'bg-[#181d2a] text-gray-400 border-[#2b3347] hover:text-gray-200'
                }`}
                title={
                  autoRecalc
                    ? 'Автоперерасчет ВКЛЮЧЕН: бэктест пересчитывается автоматически'
                    : 'Автоперерасчет ВЫКЛЮЧЕН: меняйте параметры без зависаний, пересчет по кнопке «Применить»'
                }
              >
                <Zap size={11} className={autoRecalc ? 'text-amber-400 fill-amber-400' : 'text-gray-400'} />
                <span>Автоперерасчет: {autoRecalc ? 'ВКЛ' : 'ВЫКЛ'}</span>
              </button>
            </div>

            {/* Quick Action Button & Metrics */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handleApply(false)}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-bold transition-all shadow-md cursor-pointer border ${
                  hasUnappliedChanges
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-blue-400/60 shadow-blue-500/30'
                    : 'bg-[#1b2234] hover:bg-[#252f47] text-gray-300 border-[#2e3a54]'
                }`}
                title="Пересчитать бэктест по сохраненным параметрам (Ctrl+Enter)"
              >
                <Play size={11} className="fill-current" />
                <span>Применить</span>
              </button>

              {backtestReport && (
                <div className="flex items-center space-x-1.5 font-mono text-xs">
                  <span className="px-2 py-0.5 rounded bg-[#1c2233] text-gray-200 border border-[#2b354e]">
                    Сделок: <strong className="text-white font-bold">{backtestReport.totalTrades}</strong>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded border font-bold ${
                      backtestReport.netProfit >= 0
                        ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                        : 'bg-rose-950/80 text-rose-400 border-rose-800/60'
                    }`}
                  >
                    {backtestReport.netProfit >= 0 ? '+' : ''}$
                    {backtestReport.netProfit.toLocaleString()}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#1c2233] text-gray-300 border border-[#2b354e]">
                    Win: <strong className="text-emerald-400 font-bold">{backtestReport.winRate}%</strong>
                  </span>
                </div>
              )}
            </div>
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
                        localInputs[param.id] !== undefined
                          ? localInputs[param.id]
                          : param.value !== undefined
                          ? param.value
                          : param.defval;

                      const isBool = param.type === 'bool';
                      const isBoolActive = isBool && (currentVal === true || currentVal === 'true');

                      return (
                        <div
                          key={param.id}
                          onClick={() => {
                            if (isBool) {
                              commitParam(param.id, !isBoolActive);
                            }
                          }}
                          className={`bg-[#1b202e] border border-[#2a3245] rounded-lg p-2.5 flex items-center justify-between gap-3 transition-colors ${
                            isBool
                              ? 'cursor-pointer hover:border-blue-500/70 hover:bg-[#202738]'
                              : 'hover:border-[#38435d]'
                          }`}
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
                            {/* BOOL TOGGLE WITH HIGH-VISIBILITY TEXT BADGE & SLIDER */}
                            {isBool && (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  userSelect: 'none',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    fontFamily: 'var(--font-mono, monospace)',
                                    color: isBoolActive ? '#10b981' : '#6b7280',
                                    letterSpacing: '0.04em',
                                  }}
                                >
                                  {isBoolActive ? 'ВКЛ' : 'ВЫКЛ'}
                                </span>
                                <div
                                  role="switch"
                                  aria-checked={isBoolActive}
                                  style={{
                                    position: 'relative',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    width: '46px',
                                    height: '24px',
                                    borderRadius: '12px',
                                    backgroundColor: isBoolActive ? '#089981' : '#2b3242',
                                    border: isBoolActive ? '1px solid #10b981' : '1px solid #414a5e',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    padding: '2px',
                                    boxSizing: 'border-box',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: '18px',
                                      height: '18px',
                                      borderRadius: '50%',
                                      backgroundColor: '#ffffff',
                                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.4)',
                                      transform: isBoolActive ? 'translateX(22px)' : 'translateX(0px)',
                                      transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    }}
                                  />
                                </div>
                              </div>
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
                                  commitParam(param.id, parsed);
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
                                      commitParam(param.id, nextVal);
                                    }}
                                    className="w-7 h-7 rounded bg-[#242b3d] hover:bg-[#30394f] text-gray-100 flex items-center justify-center font-bold text-sm border border-[#323c52] transition-colors cursor-pointer"
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
                                      handleDebouncedInput(
                                        param.id,
                                        isNaN(num)
                                          ? 0
                                          : param.type === 'int'
                                          ? Math.round(num)
                                          : num
                                      );
                                    }}
                                    onBlur={() => {
                                      commitParam(param.id, currentVal);
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
                                      commitParam(param.id, nextVal);
                                    }}
                                    className="w-7 h-7 rounded bg-[#242b3d] hover:bg-[#30394f] text-gray-100 flex items-center justify-center font-bold text-sm border border-[#323c52] transition-colors cursor-pointer"
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
                                    handleDebouncedInput(param.id, e.target.value)
                                  }
                                  onBlur={() => commitParam(param.id, currentVal)}
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

          {/* 5. Sticky Footer with Real-Time Auto-Save status & Manual Apply */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#2a2e39] bg-[#141824] flex-shrink-0">
            <div className="flex items-center space-x-2 text-xs">
              <div className="flex items-center space-x-1.5 text-emerald-400">
                <Check size={14} className="text-emerald-400 flex-shrink-0" />
                <span>Все настройки сохранены в памяти (LocalStorage)</span>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-md bg-[#242b3b] hover:bg-[#2e374c] text-gray-200 text-sm font-medium transition-colors border border-[#343e56] cursor-pointer"
                title="Сбросить все параметры к значениям скрипта по умолчанию"
              >
                <RotateCcw size={14} className="text-amber-400" />
                <span>Сброс к умолчанию</span>
              </button>

              <button
                type="button"
                onClick={() => handleApply(false)}
                className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-md text-sm font-bold transition-all shadow-md cursor-pointer border ${
                  hasUnappliedChanges
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-blue-400/60 shadow-blue-500/30'
                    : 'bg-[#1b2234] hover:bg-[#252f47] text-gray-200 border-[#2e3a54]'
                }`}
                title="Пересчитать бэктест по сохраненным параметрам (Ctrl+Enter)"
              >
                <Play size={13} className="fill-current" />
                <span>Применить и рассчитать</span>
              </button>

              <button
                type="button"
                onClick={() => handleApply(true)}
                className="flex items-center space-x-1.5 px-5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-sm transition-all shadow-md cursor-pointer border border-emerald-400/40"
                title="Применить параметры и закрыть окно"
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
