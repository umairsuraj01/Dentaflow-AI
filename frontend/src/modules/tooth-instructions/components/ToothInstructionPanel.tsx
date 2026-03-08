// ToothInstructionPanel.tsx — SVG dental chart with clickable teeth and instruction management.

import { useState, useCallback } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { TOOTH_INSTRUCTION_META } from '@/constants';
import type { ToothInstructionType } from '@/constants';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import type { ToothInstruction, ToothInstructionCreate, InstructionSeverity } from '../types/tooth-instruction.types';
import {
  UPPER_TEETH_LEFT, UPPER_TEETH_RIGHT,
  LOWER_TEETH_LEFT, LOWER_TEETH_RIGHT, SEVERITY_OPTIONS,
} from '../constants/tooth-instruction.constants';

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

  const renderToothRow = (teeth: readonly number[], y: number) => (
    <g>
      {teeth.map((fdi, i) => {
        const x = 20 + i * 42;
        const toothInst = getToothInstructions(fdi);
        const hasInstructions = toothInst.length > 0;
        const isSelected = selectedTooth === fdi;
        return (
          <g key={fdi} onClick={() => handleToothClick(fdi)} className="cursor-pointer">
            <rect
              x={x} y={y} width={36} height={44} rx={6}
              className={cn(
                'transition-colors duration-200',
                isSelected ? 'fill-blue-100 stroke-electric stroke-2' :
                hasInstructions ? 'fill-purple-50 stroke-purple-300 stroke-1' :
                'fill-white stroke-gray-300 stroke-1 hover:fill-blue-50',
              )}
            />
            <text x={x + 18} y={y + 28} textAnchor="middle" className="fill-dark-text text-[11px] font-medium select-none">
              {fdi}
            </text>
            {hasInstructions && (
              <g>
                {toothInst.slice(0, 3).map((inst, idx) => {
                  const meta = TOOTH_INSTRUCTION_META[inst.instruction_type as ToothInstructionType];
                  return (
                    <circle
                      key={idx}
                      cx={x + 28 + idx * 6} cy={y + 6} r={4}
                      fill={meta?.color || '#6B7280'} stroke="white" strokeWidth={1}
                    />
                  );
                })}
              </g>
            )}
          </g>
        );
      })}
    </g>
  );

  return (
    <div className="space-y-4">
      {/* SVG Dental Chart */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-4">
        <svg viewBox="0 0 700 200" className="mx-auto w-full max-w-[700px]">
          <text x={350} y={14} textAnchor="middle" className="fill-gray-400 text-[10px]">Upper Arch</text>
          {renderToothRow([...UPPER_TEETH_LEFT, ...UPPER_TEETH_RIGHT], 20)}
          <line x1={350} y1={20} x2={350} y2={68} stroke="#E5E7EB" strokeWidth={1} strokeDasharray="3,3" />
          <text x={350} y={98} textAnchor="middle" className="fill-gray-400 text-[10px]">Lower Arch</text>
          {renderToothRow([...LOWER_TEETH_LEFT, ...LOWER_TEETH_RIGHT], 108)}
          <line x1={350} y1={108} x2={350} y2={156} stroke="#E5E7EB" strokeWidth={1} strokeDasharray="3,3" />
        </svg>
      </div>

      {/* Popover Form for Selected Tooth */}
      {selectedTooth && !disabled && (
        <div className="rounded-xl border border-electric/30 bg-blue-50/50 p-4 animate-slide-up">
          <h4 className="mb-3 text-sm font-semibold text-dark-text">
            Tooth #{selectedTooth} — Add Instruction
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Instruction Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as ToothInstructionType)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                {INSTRUCTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {TOOTH_INSTRUCTION_META[type].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Severity</label>
              <div className="flex gap-2">
                {SEVERITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormSeverity(opt.value)}
                    className={cn(
                      'flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors',
                      formSeverity === opt.value
                        ? 'border-electric bg-electric text-white'
                        : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {formType === 'LIMIT_MOVEMENT_MM' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Max Movement (mm)</label>
                <input
                  type="number" min={0} max={20} step={0.5}
                  value={formNumeric}
                  onChange={(e) => setFormNumeric(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="e.g. 2.0"
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Note (optional)</label>
              <textarea
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                maxLength={500}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none"
                placeholder="Additional clinical notes..."
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleSave}>Save Instruction</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedTooth(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Instructions List */}
      {instructions.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h4 className="text-sm font-semibold text-dark-text">
              Instructions ({instructions.length})
            </h4>
          </div>
          <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto scrollbar-thin">
            {instructions.map((inst, i) => {
              const meta = TOOTH_INSTRUCTION_META[inst.instruction_type as ToothInstructionType];
              const id = 'id' in inst ? (inst as ToothInstruction).id : undefined;
              return (
                <div key={id || i} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-soft-gray text-xs font-bold text-dark-text">
                    {inst.fdi_tooth_number}
                  </span>
                  <div
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: meta?.color || '#6B7280' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-dark-text">{meta?.label || inst.instruction_type}</p>
                    {inst.note_text && <p className="truncate text-xs text-gray-500">{inst.note_text}</p>}
                  </div>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-medium',
                    inst.severity === 'MUST_RESPECT' ? 'bg-red-100 text-red-700' :
                    inst.severity === 'PREFER' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-600',
                  )}>
                    {inst.severity}
                  </span>
                  {!disabled && (
                    <button
                      onClick={() => onRemove(id || i)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
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
