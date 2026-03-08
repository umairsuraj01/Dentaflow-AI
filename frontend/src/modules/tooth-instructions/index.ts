// modules/tooth-instructions/index.ts — Public API of the tooth instructions module.

export type { ToothInstruction, ToothInstructionCreate, ToothInstructionSummary, InstructionSeverity } from './types/tooth-instruction.types';
export { toothInstructionService } from './services/tooth-instruction.service';
export { useToothInstructions } from './hooks/useToothInstructions';
export { ToothInstructionPanel } from './components/ToothInstructionPanel';
