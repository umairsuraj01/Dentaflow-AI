// ToothInstructionPanel.tsx — Visual dental chart with tooth silhouettes and instruction management.

import { useState, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { TOOTH_INSTRUCTION_META } from '@/constants';
import type { ToothInstructionType } from '@/constants';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import type { ToothInstruction, ToothInstructionCreate, InstructionSeverity } from '../types/tooth-instruction.types';
import {
  UPPER_TEETH_LEFT, UPPER_TEETH_RIGHT,
  LOWER_TEETH_LEFT, LOWER_TEETH_RIGHT, SEVERITY_OPTIONS,
} from '../constants/tooth-instruction.constants';

/* ------------------------------------------------------------------ */
/*  Tooth SVG silhouette paths (FDI-based)                             */
/*  Each path is drawn in a ~30x70 viewBox, crown at top for upper,    */
/*  crown at bottom for lower.                                         */
/* ------------------------------------------------------------------ */

// Tooth type by FDI: 1=central, 2=lateral, 3=canine, 4=1st premolar, 5=2nd premolar, 6=1st molar, 7=2nd molar, 8=3rd molar
function getToothType(fdi: number): string {
  const unit = fdi % 10;
  if (unit === 1) return 'central';
  if (unit === 2) return 'lateral';
  if (unit === 3) return 'canine';
  if (unit === 4) return 'premolar1';
  if (unit === 5) return 'premolar2';
  if (unit === 6) return 'molar1';
  if (unit === 7) return 'molar2';
  if (unit === 8) return 'molar3';
  return 'central';
}

// Crown paths (drawn as if upper tooth, root pointing down)
const CROWN_PATHS: Record<string, { crown: string; root: string; w: number; h: number }> = {
  central: {
    crown: 'M6,0 C2,0 0,4 0,10 C0,18 3,22 6,24 L24,24 C27,22 30,18 30,10 C30,4 28,0 24,0 Z',
    root: 'M10,24 C10,24 9,42 11,56 C12,62 15,66 15,66 C15,66 18,62 19,56 C21,42 20,24 20,24',
    w: 30, h: 66,
  },
  lateral: {
    crown: 'M7,0 C3,0 0,4 0,10 C0,17 3,21 7,23 L21,23 C25,21 28,17 28,10 C28,4 25,0 21,0 Z',
    root: 'M10,23 C10,23 9,40 11,52 C12,58 14,62 14,62 C14,62 16,58 17,52 C19,40 18,23 18,23',
    w: 28, h: 62,
  },
  canine: {
    crown: 'M6,0 C2,2 0,7 0,13 C0,18 4,23 8,26 L15,28 L22,26 C26,23 30,18 30,13 C30,7 28,2 24,0 Z',
    root: 'M11,28 C11,28 9,46 11,60 C12,68 15,72 15,72 C15,72 18,68 19,60 C21,46 19,28 19,28',
    w: 30, h: 72,
  },
  premolar1: {
    crown: 'M4,4 C1,6 0,10 0,15 C0,20 2,24 6,26 L10,28 L20,28 L24,26 C28,24 30,20 30,15 C30,10 29,6 26,4 L20,0 L10,0 Z',
    root: 'M9,28 C9,28 7,42 9,52 C10,56 12,58 12,58 L14,58 C14,58 12,50 14,42 L16,28 M16,28 C16,28 18,42 17,52 C16,56 18,58 18,58 L20,58 C20,58 22,50 21,42 L19,28',
    w: 30, h: 58,
  },
  premolar2: {
    crown: 'M4,3 C1,5 0,9 0,14 C0,20 2,24 6,26 L10,28 L22,28 L26,26 C30,24 32,20 32,14 C32,9 31,5 28,3 L22,0 L10,0 Z',
    root: 'M12,28 C12,28 10,44 12,54 C13,58 16,62 16,62 C16,62 19,58 20,54 C22,44 20,28 20,28',
    w: 32, h: 62,
  },
  molar1: {
    crown: 'M2,4 C0,7 0,12 0,16 C0,22 2,26 5,28 L8,30 L30,30 L33,28 C36,26 38,22 38,16 C38,12 38,7 36,4 L30,0 L8,0 Z',
    root: 'M7,30 C7,30 4,42 6,50 C7,54 9,56 9,56 M15,30 C15,30 14,44 15,52 C15,56 16,58 16,58 M27,30 C27,30 29,42 28,50 C27,54 26,56 26,56',
    w: 38, h: 58,
  },
  molar2: {
    crown: 'M2,4 C0,7 0,12 0,16 C0,22 2,26 5,28 L8,30 L28,30 L31,28 C34,26 36,22 36,16 C36,12 36,7 34,4 L28,0 L8,0 Z',
    root: 'M8,30 C8,30 5,42 7,50 C8,54 10,56 10,56 M16,30 C16,30 15,44 16,52 C16,56 17,56 17,56 M26,30 C26,30 28,42 27,50 C26,54 25,56 25,56',
    w: 36, h: 56,
  },
  molar3: {
    crown: 'M3,4 C1,7 0,11 0,15 C0,20 2,24 5,26 L8,28 L24,28 L27,26 C30,24 32,20 32,15 C32,11 31,7 29,4 L24,0 L8,0 Z',
    root: 'M8,28 C8,28 6,38 8,46 C9,50 10,52 10,52 M18,28 C18,28 17,38 18,46 C18,50 19,50 19,50 M24,28 C24,28 25,38 24,46 C23,50 22,52 22,52',
    w: 32, h: 52,
  },
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

interface ToothInstructionPanelProps {
  instructions: (ToothInstruction | ToothInstructionCreate)[];
  onAdd: (data: ToothInstructionCreate) => void;
  onRemove: (idOrIndex: string | number) => void;
  disabled?: boolean;
}

const INSTRUCTION_TYPES = Object.keys(TOOTH_INSTRUCTION_META) as ToothInstructionType[];

export function ToothInstructionPanel({ instructions, onAdd, onRemove, disabled }: ToothInstructionPanelProps) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [formType, setFormType] = useState<ToothInstructionType>('CROWN_DO_NOT_MOVE');
  const [formSeverity, setFormSeverity] = useState<InstructionSeverity>('MUST_RESPECT');
  const [formNumeric, setFormNumeric] = useState('');
  const [formNote, setFormNote] = useState('');

  const getToothInstructions = useCallback((fdi: number) => {
    return instructions.filter((i) => i.fdi_tooth_number === fdi);
  }, [instructions]);

  const handleToothClick = useCallback((fdi: number) => {
    if (disabled) return;
    setSelectedTooth(fdi === selectedTooth ? null : fdi);
    setFormType('CROWN_DO_NOT_MOVE');
    setFormSeverity('MUST_RESPECT');
    setFormNumeric('');
    setFormNote('');
  }, [selectedTooth, disabled]);

  const handleSave = useCallback(() => {
    if (!selectedTooth) return;
    onAdd({
      fdi_tooth_number: selectedTooth,
      instruction_type: formType,
      severity: formSeverity,
      numeric_value: formType === 'LIMIT_MOVEMENT_MM' ? parseFloat(formNumeric) || 0 : undefined,
      note_text: formNote || undefined,
    });
    setSelectedTooth(null);
  }, [selectedTooth, formType, formSeverity, formNumeric, formNote, onAdd]);

  /* ---------------------------------------------------------------- */
  /*  Render a single tooth SVG                                        */
  /* ---------------------------------------------------------------- */
  const renderTooth = (fdi: number, x: number, y: number, isUpper: boolean) => {
    const type = getToothType(fdi);
    const data = CROWN_PATHS[type] || CROWN_PATHS.central;
    const toothInst = getToothInstructions(fdi);
    const hasInstructions = toothInst.length > 0;
    const isSelected = selectedTooth === fdi;

    // Scale tooth to fit in cell
    const cellW = 42;
    const toothScale = 0.5;
    const scaledW = data.w * toothScale;
    const scaledH = data.h * toothScale;
    const offsetX = x + (cellW - scaledW) / 2;

    // For upper teeth: root points up, crown at bottom
    // For lower teeth: root points down, crown at top
    const toothY = isUpper ? y + 2 : y + 2;

    // Highlight colors
    const crownFill = isSelected
      ? '#DBEAFE'
      : hasInstructions
        ? '#EDE9FE'
        : '#FEF3C7';
    const crownStroke = isSelected
      ? '#3B82F6'
      : hasInstructions
        ? '#A78BFA'
        : '#F59E0B';
    const rootFill = '#FFF7ED';
    const rootStroke = '#FDBA74';

    return (
      <g
        key={fdi}
        onClick={() => handleToothClick(fdi)}
        className="cursor-pointer group"
        role="button"
        tabIndex={0}
      >
        {/* Hover background */}
        <rect
          x={x} y={y - 2} width={cellW} height={scaledH + 22} rx={6}
          className="fill-transparent group-hover:fill-blue-50/60 transition-colors duration-200"
        />

        {/* Tooth shape */}
        <g transform={`translate(${offsetX}, ${toothY}) scale(${toothScale}) ${!isUpper ? `translate(0, ${data.h}) scale(1, -1)` : ''}`}>
          {/* Root */}
          <path
            d={data.root}
            fill={rootFill}
            stroke={rootStroke}
            strokeWidth={1.5}
            strokeLinecap="round"
            className="transition-colors duration-200"
          />
          {/* Crown */}
          <path
            d={data.crown}
            fill={crownFill}
            stroke={crownStroke}
            strokeWidth={isSelected ? 2.5 : 1.5}
            strokeLinejoin="round"
            className="transition-colors duration-200"
          />
        </g>

        {/* FDI number below/above tooth */}
        <text
          x={x + cellW / 2}
          y={isUpper ? toothY + scaledH + 14 : toothY + scaledH + 14}
          textAnchor="middle"
          className={cn(
            'text-[10px] font-semibold select-none transition-colors duration-200',
            isSelected ? 'fill-blue-600' : 'fill-slate-500 group-hover:fill-slate-700',
          )}
        >
          {fdi}
        </text>

        {/* Instruction indicator dots */}
        {hasInstructions && (
          <g>
            {toothInst.slice(0, 3).map((inst, idx) => {
              const meta = TOOTH_INSTRUCTION_META[inst.instruction_type as ToothInstructionType];
              return (
                <circle
                  key={idx}
                  cx={x + cellW / 2 - 6 + idx * 6}
                  cy={y - 4}
                  r={3}
                  fill={meta?.color || '#6B7280'}
                  stroke="white"
                  strokeWidth={1.5}
                />
              );
            })}
          </g>
        )}

        {/* Selection ring */}
        {isSelected && (
          <rect
            x={x + 1} y={y - 3} width={cellW - 2} height={scaledH + 22} rx={6}
            fill="none" stroke="#3B82F6" strokeWidth={2} strokeDasharray="4,2"
            className="animate-pulse"
          />
        )}
      </g>
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Render a row of teeth                                            */
  /* ---------------------------------------------------------------- */
  const renderToothRow = (teeth: readonly number[], y: number, isUpper: boolean) => (
    <g>
      {teeth.map((fdi, i) => {
        const x = 8 + i * 42;
        return renderTooth(fdi, x, y, isUpper);
      })}
    </g>
  );

  const upperTeeth = [...UPPER_TEETH_LEFT, ...UPPER_TEETH_RIGHT];
  const lowerTeeth = [...LOWER_TEETH_LEFT, ...LOWER_TEETH_RIGHT];

  return (
    <div className="space-y-4">
      {/* SVG Dental Chart */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card">
        <div className="min-w-[680px]">
          {/* Upper Arch Label */}
          <div className="text-center mb-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Upper Arch</span>
          </div>
          <svg viewBox="0 0 680 60" className="mx-auto w-full max-w-[680px]">
            {renderToothRow(upperTeeth, 4, true)}
            {/* Midline */}
            <line x1={340} y1={0} x2={340} y2={60} stroke="#E2E8F0" strokeWidth={1} strokeDasharray="3,3" />
          </svg>

          {/* Separator */}
          <div className="flex items-center gap-3 my-3 px-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
            <span className="text-[10px] font-medium text-slate-300">R</span>
            <div className="h-px w-4 bg-slate-200" />
            <span className="text-[10px] font-medium text-slate-300">L</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
          </div>

          {/* Lower Arch Label */}
          <div className="text-center mb-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Lower Arch</span>
          </div>
          <svg viewBox="0 0 680 60" className="mx-auto w-full max-w-[680px]">
            {renderToothRow(lowerTeeth, 4, false)}
            <line x1={340} y1={0} x2={340} y2={60} stroke="#E2E8F0" strokeWidth={1} strokeDasharray="3,3" />
          </svg>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-[10px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-[#FEF3C7] border border-[#F59E0B]" />
            <span>Normal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-[#EDE9FE] border border-[#A78BFA]" />
            <span>Has instruction</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-[#DBEAFE] border border-[#3B82F6]" />
            <span>Selected</span>
          </div>
        </div>
      </div>

      {/* Popover Form for Selected Tooth */}
      {selectedTooth && !disabled && (
        <div className="rounded-2xl border border-electric/20 bg-gradient-to-br from-blue-50/80 to-white p-5 shadow-sm animate-slide-up">
          <h4 className="mb-4 text-sm font-semibold text-dark-text flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-electric/10 text-[11px] font-bold text-electric">
              {selectedTooth}
            </span>
            Add Instruction
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Instruction Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as ToothInstructionType)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/10"
              >
                {INSTRUCTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {TOOTH_INSTRUCTION_META[type].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Severity</label>
              <div className="flex gap-2">
                {SEVERITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormSeverity(opt.value)}
                    className={cn(
                      'flex-1 rounded-xl border px-2 py-2 text-xs font-medium transition-all duration-200',
                      formSeverity === opt.value
                        ? 'border-electric bg-electric text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {formType === 'LIMIT_MOVEMENT_MM' && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Max Movement (mm)</label>
                <input
                  type="number" min={0} max={20} step={0.5}
                  value={formNumeric}
                  onChange={(e) => setFormNumeric(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/10"
                  placeholder="e.g. 2.0"
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Note (optional)</label>
              <textarea
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                maxLength={500}
                rows={2}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none shadow-sm focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/10"
                placeholder="Additional clinical notes..."
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" variant="gradient" onClick={handleSave}>Save Instruction</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedTooth(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Instructions List */}
      {instructions.length > 0 && (
        <div className="rounded-2xl border border-slate-200/60 bg-white shadow-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3.5">
            <h4 className="text-sm font-semibold text-dark-text">
              Instructions ({instructions.length})
            </h4>
          </div>
          <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto scrollbar-thin">
            {instructions.map((inst, i) => {
              const meta = TOOTH_INSTRUCTION_META[inst.instruction_type as ToothInstructionType];
              const id = 'id' in inst ? (inst as ToothInstruction).id : undefined;
              return (
                <div key={id || i} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-dark-text">
                    {inst.fdi_tooth_number}
                  </span>
                  <div
                    className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white shadow-sm"
                    style={{ backgroundColor: meta?.color || '#6B7280' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-dark-text">{meta?.label || inst.instruction_type}</p>
                    {inst.note_text && <p className="truncate text-xs text-slate-500 mt-0.5">{inst.note_text}</p>}
                  </div>
                  <span className={cn(
                    'rounded-full px-2.5 py-0.5 text-[10px] font-semibold',
                    inst.severity === 'MUST_RESPECT' ? 'bg-red-50 text-red-600 ring-1 ring-inset ring-red-500/10' :
                    inst.severity === 'PREFER' ? 'bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-500/10' :
                    'bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200',
                  )}>
                    {inst.severity}
                  </span>
                  {!disabled && (
                    <button
                      onClick={() => onRemove(id || i)}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
