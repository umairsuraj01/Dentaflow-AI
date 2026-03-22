// ObjectListPanel.tsx — Tooth/gum object list with visibility toggles.
//
// OnyxCeph-style sidebar: lists all detected objects (gum + each tooth)
// with color swatches, toggle visibility, select on click.

import { useState } from 'react';
import { Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFdiColorHex, getToothName } from '../utils/fdi';
import type { SegmentationData } from './DentalViewer3D';

interface ObjectListPanelProps {
  segmentation: SegmentationData;
  hiddenObjects: Set<number>;
  selectedTooth: number | null;
  onToggleVisibility: (fdi: number) => void;
  onSelectTooth: (fdi: number | null) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

export function ObjectListPanel({
  segmentation,
  hiddenObjects,
  selectedTooth,
  onToggleVisibility,
  onSelectTooth,
  onShowAll,
  onHideAll,
}: ObjectListPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [filterText, setFilterText] = useState('');

  const teeth = segmentation.teethFound.filter((fdi) => {
    if (!filterText) return true;
    const name = getToothName(fdi).toLowerCase();
    return name.includes(filterText.toLowerCase()) || String(fdi).includes(filterText);
  });

  const upperTeeth = teeth.filter((fdi) => fdi >= 11 && fdi <= 28);
  const lowerTeeth = teeth.filter((fdi) => fdi >= 31 && fdi <= 48);

  const visibleCount = segmentation.teethFound.filter(
    (fdi) => !hiddenObjects.has(fdi),
  ).length;

  return (
    <div className="w-full rounded-lg bg-black/70 text-white shadow-xl ring-1 ring-white/10 backdrop-blur overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs font-semibold text-white/90"
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Objects
          <span className="text-white/40 font-normal">
            ({visibleCount}/{segmentation.teethFound.length + 1})
          </span>
        </button>
        <div className="flex gap-1">
          <button
            onClick={onShowAll}
            className="rounded px-1.5 py-0.5 text-[9px] text-white/50 hover:bg-white/10 hover:text-white"
          >
            Show All
          </button>
          <button
            onClick={onHideAll}
            className="rounded px-1.5 py-0.5 text-[9px] text-white/50 hover:bg-white/10 hover:text-white"
          >
            Hide All
          </button>
        </div>
      </div>

      {expanded && (
        <div className="max-h-[400px] overflow-y-auto">
          {/* Search */}
          <div className="px-2 py-1.5 border-b border-white/5">
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter teeth..."
              className="w-full rounded bg-white/5 px-2 py-1 text-[10px] text-white/80 placeholder-white/30 outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>

          {/* Gum */}
          <ObjectRow
            label="Gum (Background)"
            color="#CC7080"
            isVisible={!hiddenObjects.has(0)}
            isSelected={false}
            onToggle={() => onToggleVisibility(0)}
            onClick={() => onSelectTooth(null)}
          />

          {/* Upper teeth */}
          {upperTeeth.length > 0 && (
            <div className="border-t border-white/5">
              <div className="px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-white/30">
                Upper Arch ({upperTeeth.length})
              </div>
              {upperTeeth.map((fdi) => (
                <ObjectRow
                  key={fdi}
                  label={getToothName(fdi)}
                  color={getFdiColorHex(fdi)}
                  confidence={segmentation.confidenceScores[String(fdi)]}
                  isVisible={!hiddenObjects.has(fdi)}
                  isSelected={selectedTooth === fdi}
                  isRestricted={segmentation.restrictedFdi.includes(fdi)}
                  onToggle={() => onToggleVisibility(fdi)}
                  onClick={() => onSelectTooth(selectedTooth === fdi ? null : fdi)}
                />
              ))}
            </div>
          )}

          {/* Lower teeth */}
          {lowerTeeth.length > 0 && (
            <div className="border-t border-white/5">
              <div className="px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-white/30">
                Lower Arch ({lowerTeeth.length})
              </div>
              {lowerTeeth.map((fdi) => (
                <ObjectRow
                  key={fdi}
                  label={getToothName(fdi)}
                  color={getFdiColorHex(fdi)}
                  confidence={segmentation.confidenceScores[String(fdi)]}
                  isVisible={!hiddenObjects.has(fdi)}
                  isSelected={selectedTooth === fdi}
                  isRestricted={segmentation.restrictedFdi.includes(fdi)}
                  onToggle={() => onToggleVisibility(fdi)}
                  onClick={() => onSelectTooth(selectedTooth === fdi ? null : fdi)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ObjectRow({
  label,
  color,
  confidence,
  isVisible,
  isSelected,
  isRestricted,
  onToggle,
  onClick,
}: {
  label: string;
  color: string;
  confidence?: number;
  isVisible: boolean;
  isSelected: boolean;
  isRestricted?: boolean;
  onToggle: () => void;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1 transition-colors cursor-pointer',
        isSelected
          ? 'bg-blue-500/20 ring-1 ring-blue-400/30'
          : 'hover:bg-white/5',
        !isVisible && 'opacity-40',
      )}
    >
      {/* Visibility toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="flex-shrink-0 p-0.5 text-white/50 hover:text-white"
      >
        {isVisible ? (
          <Eye className="h-3 w-3" />
        ) : (
          <EyeOff className="h-3 w-3" />
        )}
      </button>

      {/* Color swatch */}
      <span
        className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
        style={{ backgroundColor: color }}
      />

      {/* Label */}
      <button
        onClick={onClick}
        className="flex-1 text-left text-[10px] text-white/80 truncate"
      >
        {label}
      </button>

      {/* Restricted indicator */}
      {isRestricted && (
        <span className="text-[8px] text-red-400 font-medium">LOCK</span>
      )}

      {/* Confidence */}
      {confidence !== undefined && (
        <span
          className={cn(
            'text-[9px] font-mono flex-shrink-0',
            confidence >= 0.9
              ? 'text-emerald-400'
              : confidence >= 0.7
                ? 'text-amber-400'
                : 'text-red-400',
          )}
        >
          {(confidence * 100).toFixed(0)}%
        </span>
      )}
    </div>
  );
}
