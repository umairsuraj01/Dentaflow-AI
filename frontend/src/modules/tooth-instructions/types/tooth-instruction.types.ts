// tooth-instruction.types.ts — TypeScript types for tooth instructions.

import type { ToothInstructionType } from '@/constants';

export type InstructionSeverity = 'MUST_RESPECT' | 'PREFER' | 'INFO_ONLY';

export interface ToothInstruction {
  id: string;
  case_id: string;
  dentist_id: string;
  fdi_tooth_number: number;
  instruction_type: ToothInstructionType;
  numeric_value: number | null;
  note_text: string | null;
  severity: InstructionSeverity;
  created_at: string;
  updated_at: string | null;
}

export interface ToothInstructionCreate {
  fdi_tooth_number: number;
  instruction_type: ToothInstructionType;
  numeric_value?: number | null;
  note_text?: string | null;
  severity?: InstructionSeverity;
}

export interface ToothInstructionSummary {
  instructions_by_tooth: Record<string, ToothInstruction[]>;
  restricted_fdi_numbers: number[];
  total_count: number;
}
