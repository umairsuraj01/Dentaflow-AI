// ToothInstructionPanel.tsx — Interactive dental chart with IPR lines, tooth icons, and numbering systems.

import { useState, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { TOOTH_INSTRUCTION_META } from '@/constants';
import type { ToothInstructionType } from '@/constants';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { getToothLabel, NUMBERING_SYSTEMS } from '../utils/numbering';
import type { NumberingSystem } from '../utils/numbering';
import type { ToothInstruction, ToothInstructionCreate, InstructionSeverity } from '../types/tooth-instruction.types';
import {
  UPPER_TEETH_LEFT, UPPER_TEETH_RIGHT,
  LOWER_TEETH_LEFT, LOWER_TEETH_RIGHT, SEVERITY_OPTIONS,
} from '../constants/tooth-instruction.constants';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ToothInstructionPanelProps {
  instructions: (ToothInstruction | ToothInstructionCreate)[];
  onAdd: (data: ToothInstructionCreate) => void;
  onRemove: (idOrIndex: string | number) => void;
  disabled?: boolean;
}

const INSTRUCTION_TYPES = Object.keys(TOOTH_INSTRUCTION_META) as ToothInstructionType[];

/* Quick action buttons for the toolbar */
const QUICK_ACTIONS: { type: ToothInstructionType; label: string; color: string; bgColor: string }[] = [
  { type: 'DO_NOT_MOVE', label: 'Don\'t Move', color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200 hover:bg-blue-100' },
  { type: 'EXTRACTION_PLANNED', label: 'Extract', color: 'text-red-600', bgColor: 'bg-red-50 border-red-200 hover:bg-red-100' },
  { type: 'NO_IPR', label: 'No IPR', color: 'text-slate-600', bgColor: 'bg-slate-50 border-slate-200 hover:bg-slate-100' },
  { type: 'NO_ELASTIC', label: 'No Elastic', color: 'text-slate-600', bgColor: 'bg-slate-50 border-slate-200 hover:bg-slate-100' },
  { type: 'CROWN_DO_NOT_MOVE', label: 'Crown', color: 'text-violet-600', bgColor: 'bg-violet-50 border-violet-200 hover:bg-violet-100' },
  { type: 'IMPLANT', label: 'Implant', color: 'text-red-600', bgColor: 'bg-red-50 border-red-200 hover:bg-red-100' },
  { type: 'BRIDGE_ANCHOR', label: 'Bridge', color: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-200 hover:bg-amber-100' },
];

/* ------------------------------------------------------------------ */
/*  Tooth shape paths                                                  */
/* ------------------------------------------------------------------ */
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

const CROWN_PATHS: Record<string, { crown: string; root: string; w: number; h: number }> = {
  central:   { crown: 'M6,0 C2,0 0,4 0,10 C0,18 3,22 6,24 L24,24 C27,22 30,18 30,10 C30,4 28,0 24,0 Z', root: 'M10,24 C10,24 9,42 11,56 C12,62 15,66 15,66 C15,66 18,62 19,56 C21,42 20,24 20,24', w: 30, h: 66 },
  lateral:   { crown: 'M7,0 C3,0 0,4 0,10 C0,17 3,21 7,23 L21,23 C25,21 28,17 28,10 C28,4 25,0 21,0 Z', root: 'M10,23 C10,23 9,40 11,52 C12,58 14,62 14,62 C14,62 16,58 17,52 C19,40 18,23 18,23', w: 28, h: 62 },
  canine:    { crown: 'M6,0 C2,2 0,7 0,13 C0,18 4,23 8,26 L15,28 L22,26 C26,23 30,18 30,13 C30,7 28,2 24,0 Z', root: 'M11,28 C11,28 9,46 11,60 C12,68 15,72 15,72 C15,72 18,68 19,60 C21,46 19,28 19,28', w: 30, h: 72 },
  premolar1: { crown: 'M4,4 C1,6 0,10 0,15 C0,20 2,24 6,26 L10,28 L20,28 L24,26 C28,24 30,20 30,15 C30,10 29,6 26,4 L20,0 L10,0 Z', root: 'M12,28 C12,28 10,44 12,54 C13,58 16,62 16,62 C16,62 19,58 20,54 C22,44 20,28 20,28', w: 30, h: 62 },
  premolar2: { crown: 'M4,3 C1,5 0,9 0,14 C0,20 2,24 6,26 L10,28 L22,28 L26,26 C30,24 32,20 32,14 C32,9 31,5 28,3 L22,0 L10,0 Z', root: 'M12,28 C12,28 10,44 12,54 C13,58 16,62 16,62 C16,62 19,58 20,54 C22,44 20,28 20,28', w: 32, h: 62 },
  molar1:    { crown: 'M2,4 C0,7 0,12 0,16 C0,22 2,26 5,28 L8,30 L30,30 L33,28 C36,26 38,22 38,16 C38,12 38,7 36,4 L30,0 L8,0 Z', root: 'M7,30 C7,30 4,42 6,50 C7,54 9,56 9,56 M15,30 C15,30 14,44 15,52 C15,56 16,58 16,58 M27,30 C27,30 29,42 28,50 C27,54 26,56 26,56', w: 38, h: 58 },
  molar2:    { crown: 'M2,4 C0,7 0,12 0,16 C0,22 2,26 5,28 L8,30 L28,30 L31,28 C34,26 36,22 36,16 C36,12 36,7 34,4 L28,0 L8,0 Z', root: 'M8,30 C8,30 5,42 7,50 C8,54 10,56 10,56 M16,30 C16,30 15,44 16,52 C16,56 17,56 17,56 M26,30 C26,30 28,42 27,50 C26,54 25,56 25,56', w: 36, h: 56 },
  molar3:    { crown: 'M3,4 C1,7 0,11 0,15 C0,20 2,24 5,26 L8,28 L24,28 L27,26 C30,24 32,20 32,15 C32,11 31,7 29,4 L24,0 L8,0 Z', root: 'M8,28 C8,28 6,38 8,46 C9,50 10,52 10,52 M18,28 C18,28 17,38 18,46 C18,50 19,50 19,50 M24,28 C24,28 25,38 24,46 C23,50 22,52 22,52', w: 32, h: 52 },
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function ToothInstructionPanel({ instructions, onAdd, onRemove, disabled }: ToothInstructionPanelProps) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [activeQuickAction, setActiveQuickAction] = useState<ToothInstructionType | null>(null);
  const [numberingSystem, setNumberingSystem] = useState<NumberingSystem>('FDI');
  const [iprPopup, setIprPopup] = useState<{ fdi1: number; fdi2: number; x: number; y: number } | null>(null);
  const [iprAmount, setIprAmount] = useState(0.3);

  // Form state for detailed instruction
  const [formType, setFormType] = useState<ToothInstructionType>('CROWN_DO_NOT_MOVE');
  const [formSeverity, setFormSeverity] = useState<InstructionSeverity>('MUST_RESPECT');
  const [formNumeric, setFormNumeric] = useState('');
  const [formNote, setFormNote] = useState('');

  const getToothInstructions = useCallback((fdi: number) => {
    return instructions.filter((i) => i.fdi_tooth_number === fdi);
  }, [instructions]);

  const getIPRBetween = useCallback((fdi1: number, fdi2: number): number | null => {
    const ipr = instructions.find(
      (i) => i.instruction_type === 'IPR_PLANNED' &&
        (i.fdi_tooth_number === fdi1 || i.fdi_tooth_number === fdi2) &&
        i.note_text === `IPR:${fdi1}-${fdi2}`
    );
    return ipr?.numeric_value ?? null;
  }, [instructions]);

  const hasInstruction = useCallback((fdi: number, type: string): boolean => {
    return instructions.some((i) => i.fdi_tooth_number === fdi && i.instruction_type === type);
  }, [instructions]);

  const handleToothClick = useCallback((fdi: number) => {
    if (disabled) return;

    // If a quick action is active, apply it immediately
    if (activeQuickAction) {
      if (!hasInstruction(fdi, activeQuickAction)) {
        onAdd({
          fdi_tooth_number: fdi,
          instruction_type: activeQuickAction,
          severity: 'MUST_RESPECT',
        });
      }
      return;
    }

    setSelectedTooth(fdi === selectedTooth ? null : fdi);
    setFormType('CROWN_DO_NOT_MOVE');
    setFormSeverity('MUST_RESPECT');
    setFormNumeric('');
    setFormNote('');
  }, [selectedTooth, disabled, activeQuickAction, hasInstruction, onAdd]);

  const handleIPRClick = useCallback((fdi1: number, fdi2: number, svgX: number, svgY: number) => {
    if (disabled) return;
    const existing = getIPRBetween(fdi1, fdi2);
    setIprAmount(existing ?? 0.3);
    setIprPopup({ fdi1, fdi2, x: svgX, y: svgY });
  }, [disabled, getIPRBetween]);

  const handleIPRSave = useCallback(() => {
    if (!iprPopup) return;
    // Remove existing IPR for this pair
    const existingIdx = instructions.findIndex(
      (i) => i.instruction_type === 'IPR_PLANNED' && i.note_text === `IPR:${iprPopup.fdi1}-${iprPopup.fdi2}`
    );
    if (existingIdx >= 0) {
      const inst = instructions[existingIdx];
      onRemove('id' in inst ? (inst as ToothInstruction).id : existingIdx);
    }
    if (iprAmount > 0) {
      onAdd({
        fdi_tooth_number: iprPopup.fdi1,
        instruction_type: 'IPR_PLANNED',
        severity: 'MUST_RESPECT',
        numeric_value: iprAmount,
        note_text: `IPR:${iprPopup.fdi1}-${iprPopup.fdi2}`,
      });
    }
    setIprPopup(null);
  }, [iprPopup, iprAmount, instructions, onAdd, onRemove]);

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
  /*  Get tooth width for tight packing                                */
  /* ---------------------------------------------------------------- */
  const TOOTH_SCALE = 0.5;
  const getToothWidth = (fdi: number): number => {
    const type = getToothType(fdi);
    const data = CROWN_PATHS[type] || CROWN_PATHS.central;
    return data.w * TOOTH_SCALE;
  };

  /* ---------------------------------------------------------------- */
  /*  Render a single tooth                                            */
  /* ---------------------------------------------------------------- */
  const renderTooth = (fdi: number, x: number, y: number, isUpper: boolean) => {
    const type = getToothType(fdi);
    const data = CROWN_PATHS[type] || CROWN_PATHS.central;
    const toothInst = getToothInstructions(fdi);
    const hasInstructions = toothInst.length > 0;
    const isSelected = selectedTooth === fdi;

    const toothScale = TOOTH_SCALE;
    const scaledW = data.w * toothScale;
    const scaledH = data.h * toothScale;
    const offsetX = x; // no centering — tight pack
    const toothY = y;

    // Determine colors by instruction type
    const isExtract = hasInstruction(fdi, 'EXTRACTION_PLANNED') || hasInstruction(fdi, 'RECENTLY_EXTRACTED');
    const isCrown = hasInstruction(fdi, 'CROWN_DO_NOT_MOVE');
    const isImplant = hasInstruction(fdi, 'IMPLANT');
    const isBridge = hasInstruction(fdi, 'BRIDGE_ANCHOR') || hasInstruction(fdi, 'BRIDGE_PONTIC');
    const isDontMove = hasInstruction(fdi, 'DO_NOT_MOVE');

    const crownFill = isSelected ? '#DBEAFE'
      : isExtract ? '#FEE2E2'
      : isCrown ? '#EDE9FE'
      : isImplant ? '#FEF3C7'
      : isBridge ? '#FEF3C7'
      : isDontMove ? '#DBEAFE'
      : hasInstructions ? '#E0F2FE'
      : '#FEF3C7';
    const crownStroke = isSelected ? '#3B82F6'
      : isExtract ? '#DC2626'
      : isCrown ? '#A78BFA'
      : isImplant ? '#F59E0B'
      : isDontMove ? '#3B82F6'
      : hasInstructions ? '#0EA5E9'
      : '#F59E0B';

    const cx = x + scaledW / 2; // center x of this tooth

    return (
      <g key={fdi} onClick={() => handleToothClick(fdi)} className="cursor-pointer group" role="button" tabIndex={0}>
        {/* Tooth shape — tightly packed, no gap */}
        <g transform={`translate(${offsetX}, ${toothY}) scale(${toothScale}) ${!isUpper ? `translate(0, ${data.h}) scale(1, -1)` : ''}`}>
          <path d={data.root} fill="#FFF7ED" stroke="#FDBA74" strokeWidth={1.2} strokeLinecap="round" />
          <path d={data.crown} fill={crownFill} stroke={crownStroke} strokeWidth={isSelected ? 2.5 : 1.2} strokeLinejoin="round"
            className="group-hover:brightness-95 transition-all" />
        </g>

        {/* Extract X icon */}
        {isExtract && (
          <g transform={`translate(${cx}, ${toothY + scaledH * 0.3})`}>
            <line x1={-5} y1={-5} x2={5} y2={5} stroke="#DC2626" strokeWidth={2} strokeLinecap="round" />
            <line x1={5} y1={-5} x2={-5} y2={5} stroke="#DC2626" strokeWidth={2} strokeLinecap="round" />
          </g>
        )}

        {/* Crown cap icon */}
        {isCrown && (
          <path
            d={`M${cx - 5},${toothY + 2} l2.5,-4 l2.5,2.5 l2.5,-2.5 l2.5,4 z`}
            fill="#A78BFA" stroke="#7C3AED" strokeWidth={0.7}
          />
        )}

        {/* Lock icon for Don't Move */}
        {isDontMove && (
          <g transform={`translate(${cx - 3.5}, ${toothY + scaledH * 0.25})`}>
            <rect x={0} y={3} width={7} height={5} rx={1} fill="#3B82F6" />
            <path d="M1.5,3 V1.5 A2,2 0 0,1 5.5,1.5 V3" fill="none" stroke="#3B82F6" strokeWidth={1.2} />
          </g>
        )}

        {/* Implant screw icon */}
        {isImplant && (
          <g transform={`translate(${cx - 2.5}, ${toothY + scaledH * 0.5})`}>
            <line x1={2.5} y1={0} x2={2.5} y2={8} stroke="#F59E0B" strokeWidth={1.5} strokeLinecap="round" />
            <line x1={0} y1={2} x2={5} y2={2} stroke="#F59E0B" strokeWidth={0.8} />
            <line x1={0.5} y1={4.5} x2={4.5} y2={4.5} stroke="#F59E0B" strokeWidth={0.8} />
            <line x1={1} y1={7} x2={4} y2={7} stroke="#F59E0B" strokeWidth={0.8} />
          </g>
        )}

        {/* FDI/Universal/Palmer number */}
        <text
          x={cx} y={toothY + scaledH + 11}
          textAnchor="middle"
          className={cn(
            'text-[8px] font-semibold select-none transition-colors duration-200',
            isSelected ? 'fill-blue-600' : 'fill-slate-500 group-hover:fill-slate-700',
          )}
        >
          {getToothLabel(fdi, numberingSystem)}
        </text>

        {/* Instruction dots */}
        {hasInstructions && !isExtract && !isCrown && !isImplant && !isDontMove && (
          <g>
            {toothInst.slice(0, 2).map((inst, idx) => {
              const meta = TOOTH_INSTRUCTION_META[inst.instruction_type as ToothInstructionType];
              return (
                <circle key={idx} cx={cx - 2 + idx * 4} cy={toothY - 3} r={2}
                  fill={meta?.color || '#6B7280'} stroke="white" strokeWidth={0.8} />
              );
            })}
          </g>
        )}

        {/* Selection highlight */}
        {isSelected && (
          <rect x={x - 1} y={toothY - 2} width={scaledW + 2} height={scaledH + 4} rx={3}
            fill="none" stroke="#3B82F6" strokeWidth={1.5} strokeDasharray="3,2" className="animate-pulse" />
        )}
      </g>
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Render IPR gap between two teeth                                 */
  /* ---------------------------------------------------------------- */
  const renderIPRGap = (fdi1: number, fdi2: number, x: number, y: number, height: number) => {
    const iprVal = getIPRBetween(fdi1, fdi2);
    return (
      <g key={`ipr-${fdi1}-${fdi2}`} onClick={() => handleIPRClick(fdi1, fdi2, x, y)} className="cursor-pointer">
        {/* Clickable gap zone */}
        <rect x={x - 3} y={y} width={6} height={height} fill="transparent" className="hover:fill-violet-100/50" />

        {iprVal != null && (
          <>
            {/* IPR line */}
            <line x1={x} y1={y + 4} x2={x} y2={y + height - 8} stroke="#7C3AED" strokeWidth={2} strokeLinecap="round" />
            {/* IPR value */}
            <text x={x} y={y + 1} textAnchor="middle" className="fill-violet-600 text-[7px] font-bold">
              {iprVal.toFixed(1)}
            </text>
          </>
        )}
      </g>
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Render a row — tight packed, no gaps                             */
  /* ---------------------------------------------------------------- */
  const renderToothRow = (teeth: readonly number[], y: number, isUpper: boolean) => {
    // Compute cumulative x positions (tight packing)
    const positions: number[] = [];
    let curX = 4; // small left margin
    for (const fdi of teeth) {
      positions.push(curX);
      curX += getToothWidth(fdi);
    }

    return (
    <g>
      {teeth.map((fdi, i) => {
        const x = positions[i];
        const w = getToothWidth(fdi);
        return (
          <g key={fdi}>
            {renderTooth(fdi, x, y, isUpper)}
            {/* IPR line between adjacent teeth — only appears when IPR is set or on hover */}
            {i < teeth.length - 1 && i !== 7 && renderIPRGap(fdi, teeth[i + 1], x + w, y, 28)}
          </g>
        );
      })}
    </g>
  );
  };

  const upperTeeth = [...UPPER_TEETH_LEFT, ...UPPER_TEETH_RIGHT];
  const lowerTeeth = [...LOWER_TEETH_LEFT, ...LOWER_TEETH_RIGHT];

  return (
    <div className="space-y-4">
      {/* Toolbar: Numbering + Quick Actions */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white border border-slate-200/60 p-3 shadow-sm">
        {/* Numbering system toggle */}
        <div className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
          {NUMBERING_SYSTEMS.map((ns) => (
            <button
              key={ns.value}
              onClick={() => setNumberingSystem(ns.value)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all',
                numberingSystem === ns.value
                  ? 'bg-white text-dark-text shadow-sm'
                  : 'text-slate-400 hover:text-slate-600',
              )}
              title={ns.desc}
            >
              {ns.label}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-slate-200" />

        {/* Quick action buttons */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((qa) => (
            <button
              key={qa.type}
              onClick={() => setActiveQuickAction(activeQuickAction === qa.type ? null : qa.type)}
              disabled={disabled}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all',
                activeQuickAction === qa.type
                  ? 'ring-2 ring-electric/30 border-electric bg-electric/10 text-electric'
                  : qa.bgColor,
              )}
            >
              {qa.label}
            </button>
          ))}
        </div>

        {activeQuickAction && (
          <span className="text-[10px] text-electric font-medium animate-pulse">
            Click teeth to apply "{QUICK_ACTIONS.find((q) => q.type === activeQuickAction)?.label}"
          </span>
        )}
      </div>

      {/* Dental Chart SVG */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card">
        <div className="min-w-[680px]">
          <div className="text-center mb-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Upper Arch</span>
          </div>
          <svg viewBox="0 0 270 48" className="mx-auto w-full max-w-[700px]">
            {renderToothRow(upperTeeth, 4, true)}
            <line x1={135} y1={0} x2={135} y2={48} stroke="#E2E8F0" strokeWidth={0.5} strokeDasharray="2,2" />
          </svg>

          <div className="flex items-center gap-3 my-3 px-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
            <span className="text-[10px] font-medium text-slate-300">R</span>
            <div className="h-px w-4 bg-slate-200" />
            <span className="text-[10px] font-medium text-slate-300">L</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
          </div>

          <div className="text-center mb-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Lower Arch</span>
          </div>
          <svg viewBox="0 0 270 48" className="mx-auto w-full max-w-[700px]">
            {renderToothRow(lowerTeeth, 4, false)}
            <line x1={135} y1={0} x2={135} y2={48} stroke="#E2E8F0" strokeWidth={0.5} strokeDasharray="2,2" />
          </svg>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[10px] text-slate-500">
          {[
            { color: '#FEF3C7', border: '#F59E0B', label: 'Normal' },
            { color: '#FEE2E2', border: '#DC2626', label: 'Extract' },
            { color: '#EDE9FE', border: '#A78BFA', label: 'Crown' },
            { color: '#DBEAFE', border: '#3B82F6', label: 'Don\'t Move' },
            { color: '#FEF3C7', border: '#F59E0B', label: 'Implant' },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: l.color, border: `1px solid ${l.border}` }} />
              <span>{l.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-0.5 bg-violet-600 rounded-full" />
            <span>IPR Line</span>
          </div>
        </div>
      </div>

      {/* IPR Popup */}
      {iprPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/20" onClick={() => setIprPopup(null)} />
          <div className="relative bg-white rounded-2xl shadow-elevated border border-slate-200 p-5 w-72 animate-scale-in">
            <h4 className="text-sm font-semibold text-dark-text mb-3">
              IPR: Tooth {getToothLabel(iprPopup.fdi1, numberingSystem)} — {getToothLabel(iprPopup.fdi2, numberingSystem)}
            </h4>
            <div className="flex items-center gap-4 mb-4">
              <input
                type="range" min={0} max={0.5} step={0.1}
                value={iprAmount}
                onChange={(e) => setIprAmount(parseFloat(e.target.value))}
                className="flex-1 accent-violet-600"
              />
              <span className="text-lg font-bold text-violet-600 w-12 text-center">{iprAmount.toFixed(1)}</span>
              <span className="text-xs text-slate-400">mm</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="gradient" onClick={handleIPRSave} className="flex-1">Set IPR</Button>
              {iprAmount === 0 && (
                <Button size="sm" variant="outline" onClick={handleIPRSave}>Remove</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setIprPopup(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed instruction form for selected tooth */}
      {selectedTooth && !disabled && !activeQuickAction && (
        <div className="rounded-2xl border border-electric/20 bg-gradient-to-br from-blue-50/80 to-white p-5 shadow-sm animate-slide-up">
          <h4 className="mb-4 text-sm font-semibold text-dark-text flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-electric/10 text-[12px] font-bold text-electric">
              {getToothLabel(selectedTooth, numberingSystem)}
            </span>
            Add Instruction
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Instruction Type</label>
              <select value={formType} onChange={(e) => setFormType(e.target.value as ToothInstructionType)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/10">
                {INSTRUCTION_TYPES.map((type) => (
                  <option key={type} value={type}>{TOOTH_INSTRUCTION_META[type].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Severity</label>
              <div className="flex gap-2">
                {SEVERITY_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button" onClick={() => setFormSeverity(opt.value)}
                    className={cn(
                      'flex-1 rounded-xl border px-2 py-2 text-xs font-medium transition-all duration-200',
                      formSeverity === opt.value
                        ? 'border-electric bg-electric text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    )}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {formType === 'LIMIT_MOVEMENT_MM' && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Max Movement (mm)</label>
                <input type="number" min={0} max={20} step={0.5} value={formNumeric}
                  onChange={(e) => setFormNumeric(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/10" />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Note (optional)</label>
              <textarea value={formNote} onChange={(e) => setFormNote(e.target.value)} maxLength={500} rows={2}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none shadow-sm focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/10" />
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
            <h4 className="text-sm font-semibold text-dark-text">Instructions ({instructions.length})</h4>
          </div>
          <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto scrollbar-thin">
            {instructions.map((inst, i) => {
              const meta = TOOTH_INSTRUCTION_META[inst.instruction_type as ToothInstructionType];
              const id = 'id' in inst ? (inst as ToothInstruction).id : undefined;
              return (
                <div key={id || i} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-dark-text">
                    {getToothLabel(inst.fdi_tooth_number, numberingSystem)}
                  </span>
                  <div className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: meta?.color || '#6B7280' }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-dark-text">{meta?.label || inst.instruction_type}</p>
                    {inst.numeric_value != null && <span className="text-xs text-slate-500">{inst.numeric_value}mm</span>}
                    {inst.note_text && !inst.note_text.startsWith('IPR:') && <p className="truncate text-xs text-slate-500 mt-0.5">{inst.note_text}</p>}
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
                    <button onClick={() => onRemove(id || i)} className="rounded-lg p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
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
