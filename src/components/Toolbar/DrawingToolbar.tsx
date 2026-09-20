import React, { useState } from 'react';
import {
  Crosshair,
  Minus,
  Maximize2,
  Square,
  ArrowUpRight,
  TrendingUp,
  Percent,
  Trash2,
} from 'lucide-react';

export type ToolType = 'crosshair' | 'trendline' | 'horizontal' | 'fib' | 'box' | 'position' | 'measure';

interface DrawingToolbarProps {
  activeTool?: ToolType;
  onSelectTool?: (tool: ToolType) => void;
  onClearAllDrawings?: () => void;
}

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  activeTool = 'crosshair',
  onSelectTool,
  onClearAllDrawings,
}) => {
  const [selected, setSelected] = useState<ToolType>(activeTool);

  const handleSelect = (tool: ToolType) => {
    setSelected(tool);
    if (onSelectTool) onSelectTool(tool);
  };

  const tools: { id: ToolType; label: string; icon: React.ReactNode }[] = [
    { id: 'crosshair', label: 'Crosshair', icon: <Crosshair size={16} /> },
    { id: 'trendline', label: 'Trend Line', icon: <TrendingUp size={16} /> },
    { id: 'horizontal', label: 'Horizontal Ray', icon: <Minus size={16} /> },
    { id: 'fib', label: 'Fib Retracement', icon: <Percent size={16} /> },
    { id: 'box', label: 'Rectangle Zone', icon: <Square size={16} /> },
    { id: 'position', label: 'Long/Short Tool', icon: <ArrowUpRight size={16} /> },
    { id: 'measure', label: 'Measure Range', icon: <Maximize2 size={16} /> },
  ];

  return (
    <aside className="w-12 bg-[#1e222d] border-r border-[#2a2e39] flex flex-col items-center py-2 space-y-1 select-none z-20">
      {tools.map((t) => (
        <button
          key={t.id}
          title={t.label}
          onClick={() => handleSelect(t.id)}
          className={`w-8 h-8 rounded flex items-center justify-center transition-all ${
            selected === t.id
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-white hover:bg-[#2a2e39]'
          }`}
        >
          {t.icon}
        </button>
      ))}

      <div className="w-6 h-px bg-[#2a2e39] my-1" />

      <button
        title="Clear All Drawings"
        onClick={() => {
          if (onClearAllDrawings) onClearAllDrawings();
          alert('Drawings cleared');
        }}
        className="w-8 h-8 rounded flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-[#2a2e39] transition-all"
      >
        <Trash2 size={15} />
      </button>
    </aside>
  );
};
