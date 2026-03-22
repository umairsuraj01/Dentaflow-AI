// SegmentationToolbar.tsx — Side panel for segmentation review.
//
// Simple UI: no dental expertise needed.
// - Select mode: click teeth to highlight them
// - Edit mode: paint "Gum" or "Tooth" (auto-assigns nearest tooth label)
// - Split tool: click between merged teeth to separate them

import { MousePointer2, Paintbrush, Scissors, RotateCcw, Check, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export type EditTool = 'select' | 'gum-brush' | 'tooth-brush' | 'split';

interface SegmentationToolbarProps {
  teethCount: number;
  activeTool: EditTool;
  brushRadius: number;
  selectedTooth: number | null;
  isExtracting: boolean;
  onToolChange: (tool: EditTool) => void;
  onBrushRadiusChange: (radius: number) => void;
  onUndo: () => void;
  onReset: () => void;
  onApproveAndExtract: () => void;
}

export function SegmentationToolbar({
  teethCount,
  activeTool,
  brushRadius,
  selectedTooth,
  isExtracting,
  onToolChange,
  onBrushRadiusChange,
  onUndo,
  onReset,
  onApproveAndExtract,
}: SegmentationToolbarProps) {
  const isBrush = activeTool === 'gum-brush' || activeTool === 'tooth-brush';

  return (
    <div className="space-y-3">
      {/* Step indicator */}
      <div className="rounded-lg bg-blue-50 px-3 py-2.5">
        <p className="text-xs font-semibold text-blue-700">Review AI Segmentation</p>
        <p className="text-[10px] text-blue-600 mt-0.5">
          AI found <strong>{teethCount} teeth</strong>. Click a tooth to select it.
          Use the tools below to fix any mistakes.
        </p>
      </div>

      {/* Tool picker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <button
            onClick={() => onToolChange('select')}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
              activeTool === 'select'
                ? 'bg-gray-100 text-dark-text ring-1 ring-gray-300'
                : 'text-gray-600 hover:bg-gray-50',
            )}
          >
            <MousePointer2 className="h-4 w-4 flex-shrink-0" />
            <div className="text-left">
              <div>Select</div>
              <div className="text-[9px] font-normal text-gray-400">Click a tooth to highlight it</div>
            </div>
          </button>

          <button
            onClick={() => onToolChange('gum-brush')}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
              activeTool === 'gum-brush'
                ? 'bg-pink-50 text-pink-700 ring-1 ring-pink-300'
                : 'text-gray-600 hover:bg-gray-50',
            )}
          >
            <Paintbrush className="h-4 w-4 flex-shrink-0" />
            <div className="text-left">
              <div>Mark as Gum</div>
              <div className="text-[9px] font-normal text-gray-400">Paint over areas that should be gum</div>
            </div>
          </button>

          <button
            onClick={() => onToolChange('tooth-brush')}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
              activeTool === 'tooth-brush'
                ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-300'
                : 'text-gray-600 hover:bg-gray-50',
            )}
          >
            <Paintbrush className="h-4 w-4 flex-shrink-0" />
            <div className="text-left">
              <div>Mark as Tooth</div>
              <div className="text-[9px] font-normal text-gray-400">Paint areas that should be tooth (auto-detects which one)</div>
            </div>
          </button>

          <button
            onClick={() => onToolChange('split')}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
              activeTool === 'split'
                ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-300'
                : 'text-gray-600 hover:bg-gray-50',
            )}
          >
            <Scissors className="h-4 w-4 flex-shrink-0" />
            <div className="text-left">
              <div>Split Teeth</div>
              <div className="text-[9px] font-normal text-gray-400">Click on a merged tooth to auto-split it into two</div>
            </div>
          </button>
        </CardContent>
      </Card>

      {/* Brush size (only when brush tool active) */}
      {isBrush && (
        <Card>
          <CardContent className="pt-4">
            <label className="text-[10px] text-gray-500 font-medium">Brush Size</label>
            <input
              type="range"
              min="0"
              max="5"
              step="0.5"
              value={brushRadius}
              onChange={(e) => onBrushRadiusChange(parseFloat(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-[9px] text-gray-400">
              <span>Small</span>
              <span>{brushRadius <= 0.5 ? 'Single face' : `${brushRadius.toFixed(1)}mm`}</span>
              <span>Large</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selection info */}
      {selectedTooth !== null && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
          <p className="text-xs font-medium text-blue-700">
            Tooth #{selectedTooth} selected
          </p>
          <p className="text-[9px] text-blue-500 mt-0.5">
            Click elsewhere or press Escape to deselect
          </p>
        </div>
      )}

      {/* Actions */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onUndo} className="flex-1">
              <RotateCcw className="mr-1 h-3 w-3" />
              Undo
            </Button>
            <Button size="sm" variant="outline" onClick={onReset} className="flex-1">
              Reset AI
            </Button>
          </div>
          <Button
            size="sm"
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={onApproveAndExtract}
            disabled={isExtracting}
          >
            {isExtracting ? (
              <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Extracting Teeth...</>
            ) : (
              <><Check className="mr-1 h-3.5 w-3.5" />Approve & Extract Teeth</>
            )}
          </Button>
          <p className="text-[9px] text-gray-400 text-center">
            Looks good? Approve to extract individual teeth for treatment planning.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
