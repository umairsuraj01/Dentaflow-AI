// tooth-instruction.constants.ts — Constants for tooth instruction UI.

import type { InstructionSeverity } from '../types/tooth-instruction.types';

export const SEVERITY_OPTIONS: { value: InstructionSeverity; label: string; color: string }[] = [
  { value: 'MUST_RESPECT', label: 'Must Respect', color: '#EF4444' },
  { value: 'PREFER', label: 'Prefer', color: '#F59E0B' },
  { value: 'INFO_ONLY', label: 'Info Only', color: '#6B7280' },
];

export const UPPER_TEETH_LEFT = [18, 17, 16, 15, 14, 13, 12, 11] as const;
export const UPPER_TEETH_RIGHT = [21, 22, 23, 24, 25, 26, 27, 28] as const;
export const LOWER_TEETH_LEFT = [48, 47, 46, 45, 44, 43, 42, 41] as const;
export const LOWER_TEETH_RIGHT = [31, 32, 33, 34, 35, 36, 37, 38] as const;
