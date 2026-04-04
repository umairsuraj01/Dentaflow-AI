// ToothInstructionPanel.tsx — Anatomically realistic dental chart with IPR, icons, numbering.

import { useState, useCallback, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { TOOTH_INSTRUCTION_META } from '@/constants';
import type { ToothInstructionType } from '@/constants';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { getToothLabel, NUMBERING_SYSTEMS } from '../utils/numbering';
import type { NumberingSystem } from '../utils/numbering';
import { TOOTH_SVG, getToothSVGType } from '../constants/tooth-svg-paths';
import type { ToothInstruction, ToothInstructionCreate, InstructionSeverity } from '../types/tooth-instruction.types';
import {
  UPPER_TEETH_LEFT, UPPER_TEETH_RIGHT,
  LOWER_TEETH_LEFT, LOWER_TEETH_RIGHT, SEVERITY_OPTIONS,
} from '../constants/tooth-instruction.constants';

/* ------------------------------------------------------------------ */
/*  Props & constants                                                  */
/* ------------------------------------------------------------------ */

interface ToothInstructionPanelProps {
  instructions: (ToothInstruction | ToothInstructionCreate)[];
  onAdd: (data: ToothInstructionCreate) => void;
  onRemove: (idOrIndex: string | number) => void;
  disabled?: boolean;
}

const INSTRUCTION_TYPES = Object.keys(TOOTH_INSTRUCTION_META) as ToothInstructionType[];

const QUICK_ACTIONS: { type: ToothInstructionType; label: string; bgColor: string }[] = [
  { type: 'DO_NOT_MOVE', label: "Don't Move", bgColor: 'bg-blue-50 border-blue-200 hover:bg-blue-100' },
  { type: 'EXTRACTION_PLANNED', label: 'Extract', bgColor: 'bg-red-50 border-red-200 hover:bg-red-100' },
  { type: 'NO_IPR', label: 'No IPR', bgColor: 'bg-slate-50 border-slate-200 hover:bg-slate-100' },
  { type: 'NO_ELASTIC', label: 'No Elastic', bgColor: 'bg-slate-50 border-slate-200 hover:bg-slate-100' },
  { type: 'CROWN_DO_NOT_MOVE', label: 'Crown', bgColor: 'bg-violet-50 border-violet-200 hover:bg-violet-100' },
  { type: 'IMPLANT', label: 'Implant', bgColor: 'bg-amber-50 border-amber-200 hover:bg-amber-100' },
  { type: 'BRIDGE_ANCHOR', label: 'Bridge', bgColor: 'bg-amber-50 border-amber-200 hover:bg-amber-100' },
];

const SCALE = 0.9; // Global tooth scale

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function ToothInstructionPanel({ instructions, onAdd, onRemove, disabled }: ToothInstructionPanelProps) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [activeQuickAction, setActiveQuickAction] = useState<ToothInstructionType | null>(null);
  const [numberingSystem, setNumberingSystem] = useState<NumberingSystem>('FDI');
  const [iprPopup, setIprPopup] = useState<{ fdi1: number; fdi2: number } | null>(null);
  const [iprAmount, setIprAmount] = useState(0.3);
  const [formType, setFormType] = useState<ToothInstructionType>('CROWN_DO_NOT_MOVE');
  const [formSeverity, setFormSeverity] = useState<InstructionSeverity>('MUST_RESPECT');
  const [formNumeric, setFormNumeric] = useState('');
  const [formNote, setFormNote] = useState('');

  const getIPRBetween = useCallback((fdi1: number, fdi2: number): number | null => {
    const ipr = instructions.find(
      (i) => i.instruction_type === 'IPR_PLANNED' && i.note_text === `IPR:${fdi1}-${fdi2}`
    );
    return ipr?.numeric_value ?? null;
  }, [instructions]);

  const hasInst = useCallback((fdi: number, type: string): boolean =>
    instructions.some((i) => i.fdi_tooth_number === fdi && i.instruction_type === type), [instructions]);

  const handleToothClick = useCallback((fdi: number) => {
    if (disabled) return;
    if (activeQuickAction) {
      if (!hasInst(fdi, activeQuickAction)) {
        onAdd({ fdi_tooth_number: fdi, instruction_type: activeQuickAction, severity: 'MUST_RESPECT' });
      }
      return;
    }
    setSelectedTooth(fdi === selectedTooth ? null : fdi);
    setFormType('CROWN_DO_NOT_MOVE'); setFormSeverity('MUST_RESPECT'); setFormNumeric(''); setFormNote('');
  }, [selectedTooth, disabled, activeQuickAction, hasInst, onAdd]);

  const handleIPRClick = useCallback((fdi1: number, fdi2: number) => {
    if (disabled) return;
    setIprAmount(getIPRBetween(fdi1, fdi2) ?? 0.3);
    setIprPopup({ fdi1, fdi2 });
  }, [disabled, getIPRBetween]);

  const handleIPRSave = useCallback(() => {
    if (!iprPopup) return;
    const existingIdx = instructions.findIndex(
      (i) => i.instruction_type === 'IPR_PLANNED' && i.note_text === `IPR:${iprPopup.fdi1}-${iprPopup.fdi2}`
    );
    if (existingIdx >= 0) {
      const inst = instructions[existingIdx];
      onRemove('id' in inst ? (inst as ToothInstruction).id : existingIdx);
    }
    if (iprAmount > 0) {
      onAdd({
        fdi_tooth_number: iprPopup.fdi1, instruction_type: 'IPR_PLANNED',
        severity: 'MUST_RESPECT', numeric_value: iprAmount,
        note_text: `IPR:${iprPopup.fdi1}-${iprPopup.fdi2}`,
      });
    }
    setIprPopup(null);
  }, [iprPopup, iprAmount, instructions, onAdd, onRemove]);

  const handleSave = useCallback(() => {
    if (!selectedTooth) return;
    onAdd({
      fdi_tooth_number: selectedTooth, instruction_type: formType, severity: formSeverity,
      numeric_value: formType === 'LIMIT_MOVEMENT_MM' ? parseFloat(formNumeric) || 0 : undefined,
      note_text: formNote || undefined,
    });
    setSelectedTooth(null);
  }, [selectedTooth, formType, formSeverity, formNumeric, formNote, onAdd]);

  /* ---------------------------------------------------------------- */
  /*  Compute tooth positions for tight packing                        */
  /* ---------------------------------------------------------------- */
  const computePositions = (teeth: readonly number[]) => {
    const positions: { fdi: number; x: number; w: number; h: number }[] = [];
    let curX = 2;
    for (const fdi of teeth) {
      const type = getToothSVGType(fdi);
      const data = TOOTH_SVG[type];
      const w = data.w * SCALE;
      const h = data.h * SCALE;
      positions.push({ fdi, x: curX, w, h });
      curX += w;
    }
    return positions;
  };

  const upperTeeth = [...UPPER_TEETH_LEFT, ...UPPER_TEETH_RIGHT];
  const lowerTeeth = [...LOWER_TEETH_LEFT, ...LOWER_TEETH_RIGHT];

  const upperPos = useMemo(() => computePositions(upperTeeth), []);
  const lowerPos = useMemo(() => computePositions(lowerTeeth), []);

  const totalWidth = Math.max(
    upperPos.length > 0 ? upperPos[upperPos.length - 1].x + upperPos[upperPos.length - 1].w + 2 : 0,
    lowerPos.length > 0 ? lowerPos[lowerPos.length - 1].x + lowerPos[lowerPos.length - 1].w + 2 : 0,
  );
  const rowHeight = 56;
  const labelH = 10;

  /* ---------------------------------------------------------------- */
  /*  Render single tooth                                              */
  /* ---------------------------------------------------------------- */
  const renderTooth = (fdi: number, x: number, w: number, y: number, isUpper: boolean) => {
    const type = getToothSVGType(fdi);
    const data = TOOTH_SVG[type];
    const isSelected = selectedTooth === fdi;
    const isExtract = hasInst(fdi, 'EXTRACTION_PLANNED') || hasInst(fdi, 'RECENTLY_EXTRACTED');
    const isCrown = hasInst(fdi, 'CROWN_DO_NOT_MOVE');
    const isDontMove = hasInst(fdi, 'DO_NOT_MOVE');
    const isImplant = hasInst(fdi, 'IMPLANT');

    // Crown fill color based on instruction
    const crownFill = isSelected ? '#DBEAFE' : isExtract ? '#FECACA' : isCrown ? '#DDD6FE' : isDontMove ? '#BFDBFE' : isImplant ? '#FEF3C7' : '#FDF6E3';
    const crownStroke = isSelected ? '#3B82F6' : isExtract ? '#DC2626' : isCrown ? '#7C3AED' : isDontMove ? '#2563EB' : '#D4A574';
    const rootFill = '#FCEBD0';
    const rootStroke = '#D4A574';

    const cx = x + w / 2;

    return (
      <g key={fdi} onClick={() => handleToothClick(fdi)} className="cursor-pointer">
        {/* Tooth SVG — flip for lower teeth */}
        <g transform={isUpper
          ? `translate(${x}, ${y}) scale(${SCALE})`
          : `translate(${x}, ${y + rowHeight * SCALE}) scale(${SCALE}, ${-SCALE})`
        }>
          <path d={data.root} fill={rootFill} stroke={rootStroke} strokeWidth={0.8} strokeLinecap="round" fillRule="evenodd" />
          <path d={data.crown} fill={crownFill} stroke={crownStroke} strokeWidth={isSelected ? 1.5 : 0.8} strokeLinejoin="round" />
        </g>

        {/* Extract X overlay */}
        {isExtract && (
          <g transform={`translate(${cx}, ${y + rowHeight * SCALE * 0.5})`}>
            <line x1={-4} y1={-4} x2={4} y2={4} stroke="#DC2626" strokeWidth={1.8} strokeLinecap="round" />
            <line x1={4} y1={-4} x2={-4} y2={4} stroke="#DC2626" strokeWidth={1.8} strokeLinecap="round" />
          </g>
        )}

        {/* Crown cap */}
        {isCrown && (
          <path d={`M${cx - 4},${y + (isUpper ? rowHeight * SCALE - 2 : 2)} l2,-3 l2,2 l2,-2 l2,3 z`}
            fill="#A78BFA" stroke="#7C3AED" strokeWidth={0.5} />
        )}

        {/* Lock for Don't Move */}
        {isDontMove && (
          <g transform={`translate(${cx - 3}, ${y + rowHeight * SCALE * 0.4})`}>
            <rect x={0} y={2.5} width={6} height={4.5} rx={0.8} fill="#3B82F6" />
            <path d="M1,2.5 V1.5 A2,2 0 0,1 5,1.5 V2.5" fill="none" stroke="#3B82F6" strokeWidth={1} />
          </g>
        )}

        {/* Selection highlight */}
        {isSelected && (
          <rect x={x - 0.5} y={y} width={w + 1} height={rowHeight * SCALE} rx={2}
            fill="none" stroke="#3B82F6" strokeWidth={1.2} strokeDasharray="2,1.5" />
        )}
      </g>
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Render tooth row with labels                                     */
  /* ---------------------------------------------------------------- */
  const renderRow = (positions: { fdi: number; x: number; w: number; h: number }[], y: number, isUpper: boolean) => (
    <g>
      {positions.map(({ fdi, x, w }, i) => (
        <g key={fdi}>
          {renderTooth(fdi, x, w, y, isUpper)}

          {/* Number label */}
          <text
            x={x + w / 2}
            y={isUpper ? y + rowHeight * SCALE + labelH : y - 2}
            textAnchor="middle"
            className={cn(
              'text-[6px] font-semibold select-none',
              selectedTooth === fdi ? 'fill-blue-600' : 'fill-slate-400',
            )}
          >
            {getToothLabel(fdi, numberingSystem)}
          </text>

          {/* IPR line between this tooth and the next (only if IPR is set) */}
          {i < positions.length - 1 && i !== 7 && (() => {
            const nextFdi = positions[i + 1].fdi;
            const iprVal = getIPRBetween(fdi, nextFdi);
            const gapX = x + w;
            return (
              <g key={`ipr-${fdi}`}
                onClick={(e) => { e.stopPropagation(); handleIPRClick(fdi, nextFdi); }}
                className="cursor-pointer"
              >
                {/* Invisible click zone */}
                <rect x={gapX - 2} y={y} width={4} height={rowHeight * SCALE}
                  fill="transparent" className="hover:fill-violet-100/40" />
                {iprVal != null && (
                  <>
                    <line x1={gapX} y1={y + 3} x2={gapX} y2={y + rowHeight * SCALE - 3}
                      stroke="#7C3AED" strokeWidth={1.2} strokeLinecap="round" />
                    <text x={gapX} y={isUpper ? y + rowHeight * SCALE + labelH + 6 : y - 6}
                      textAnchor="middle" className="fill-violet-600 text-[5px] font-bold">
                      {iprVal.toFixed(1)}
                    </text>
                  </>
                )}
              </g>
            );
          })()}
        </g>
      ))}
    </g>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white border border-slate-200/60 p-3 shadow-sm">
        <div className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
          {NUMBERING_SYSTEMS.map((ns) => (
            <button key={ns.value} onClick={() => setNumberingSystem(ns.value)}
              className={cn('rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all',
                numberingSystem === ns.value ? 'bg-white text-dark-text shadow-sm' : 'text-slate-400 hover:text-slate-600')}
              title={ns.desc}>{ns.label}</button>
          ))}
        </div>
        <div className="h-5 w-px bg-slate-200" />
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((qa) => (
            <button key={qa.type}
              onClick={() => setActiveQuickAction(activeQuickAction === qa.type ? null : qa.type)}
              disabled={disabled}
              className={cn('rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all',
                activeQuickAction === qa.type ? 'ring-2 ring-electric/30 border-electric bg-electric/10 text-electric' : qa.bgColor)}>
              {qa.label}
            </button>
          ))}
        </div>
        {activeQuickAction && (
          <span className="text-[10px] text-electric font-medium animate-pulse">
            Click teeth to apply
          </span>
        )}
      </div>

      {/* Dental Chart */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200/60 bg-white p-4 shadow-card">
        <div style={{ minWidth: totalWidth + 10 }}>
          {/* Upper Arch */}
          <div className="text-center mb-1">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Upper Arch</span>
          </div>
          <svg viewBox={`0 0 ${totalWidth + 4} ${rowHeight * SCALE + labelH + 2}`}
            className="mx-auto w-full" style={{ maxWidth: totalWidth * 2.8 }}>
            {renderRow(upperPos, 0, true)}
            {/* Midline */}
            <line x1={totalWidth / 2} y1={0} x2={totalWidth / 2} y2={rowHeight * SCALE}
              stroke="#E2E8F0" strokeWidth={0.4} strokeDasharray="2,2" />
          </svg>

          {/* R / L indicator */}
          <div className="flex items-center gap-3 my-2 px-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
            <span className="text-[9px] font-medium text-slate-300">R</span>
            <div className="h-px w-3 bg-slate-200" />
            <span className="text-[9px] font-medium text-slate-300">L</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
          </div>

          {/* Lower Arch */}
          <div className="text-center mb-1">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Lower Arch</span>
          </div>
          <svg viewBox={`0 0 ${totalWidth + 4} ${rowHeight * SCALE + labelH + 2}`}
            className="mx-auto w-full" style={{ maxWidth: totalWidth * 2.8 }}>
            {renderRow(lowerPos, labelH, false)}
            <line x1={totalWidth / 2} y1={labelH} x2={totalWidth / 2} y2={labelH + rowHeight * SCALE}
              stroke="#E2E8F0" strokeWidth={0.4} strokeDasharray="2,2" />
          </svg>
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[9px] text-slate-500">
          {[
            { color: '#FDF6E3', border: '#D4A574', label: 'Normal' },
            { color: '#FECACA', border: '#DC2626', label: 'Extract' },
            { color: '#DDD6FE', border: '#7C3AED', label: 'Crown' },
            { color: '#BFDBFE', border: '#2563EB', label: "Don't Move" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: l.color, border: `1px solid ${l.border}` }} />
              <span>{l.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <div className="h-2.5 w-0.5 bg-violet-600 rounded-full" />
            <span>IPR</span>
          </div>
        </div>
      </div>

      {/* IPR Popup */}
      {iprPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/20" onClick={() => setIprPopup(null)} />
          <div className="relative bg-white rounded-2xl shadow-elevated border border-slate-200 p-5 w-72 animate-scale-in">
            <h4 className="text-sm font-semibold text-dark-text mb-3">
              IPR: {getToothLabel(iprPopup.fdi1, numberingSystem)} — {getToothLabel(iprPopup.fdi2, numberingSystem)}
            </h4>
            <div className="flex items-center gap-3 mb-4">
              <input type="range" min={0} max={0.5} step={0.1} value={iprAmount}
                onChange={(e) => setIprAmount(parseFloat(e.target.value))} className="flex-1 accent-violet-600" />
              <span className="text-lg font-bold text-violet-600 w-12 text-center">{iprAmount.toFixed(1)}</span>
              <span className="text-xs text-slate-400">mm</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="gradient" onClick={handleIPRSave} className="flex-1">Set IPR</Button>
              <Button size="sm" variant="ghost" onClick={() => setIprPopup(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed instruction form */}
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
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Type</label>
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
                    className={cn('flex-1 rounded-xl border px-2 py-2 text-xs font-medium transition-all',
                      formSeverity === opt.value ? 'border-electric bg-electric text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {formType === 'LIMIT_MOVEMENT_MM' && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Max (mm)</label>
                <input type="number" min={0} max={20} step={0.5} value={formNumeric}
                  onChange={(e) => setFormNumeric(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-electric focus:outline-none" />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Note</label>
              <textarea value={formNote} onChange={(e) => setFormNote(e.target.value)} maxLength={500} rows={2}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none shadow-sm focus:border-electric focus:outline-none" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" variant="gradient" onClick={handleSave}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedTooth(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Instructions list */}
      {instructions.length > 0 && (
        <div className="rounded-2xl border border-slate-200/60 bg-white shadow-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3">
            <h4 className="text-sm font-semibold text-dark-text">Instructions ({instructions.length})</h4>
          </div>
          <div className="divide-y divide-slate-50 max-h-52 overflow-y-auto scrollbar-thin">
            {instructions.map((inst, i) => {
              const meta = TOOTH_INSTRUCTION_META[inst.instruction_type as ToothInstructionType];
              const id = 'id' in inst ? (inst as ToothInstruction).id : undefined;
              return (
                <div key={id || i} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50/50 transition-colors">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-dark-text">
                    {getToothLabel(inst.fdi_tooth_number, numberingSystem)}
                  </span>
                  <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: meta?.color || '#6B7280' }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-dark-text">{meta?.label || inst.instruction_type}</p>
                    {inst.numeric_value != null && <span className="text-[10px] text-slate-500">{inst.numeric_value}mm</span>}
                  </div>
                  <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-semibold',
                    inst.severity === 'MUST_RESPECT' ? 'bg-red-50 text-red-600' :
                    inst.severity === 'PREFER' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-500')}>
                    {inst.severity}
                  </span>
                  {!disabled && (
                    <button onClick={() => onRemove(id || i)} className="rounded-lg p-1 text-slate-400 hover:text-red-500 hover:bg-red-50">
                      <Trash2 className="h-3 w-3" />
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
