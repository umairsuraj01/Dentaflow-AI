// tooth-instruction.service.ts — All tooth instruction API calls.

import api from '@/lib/api';
import type { ApiResponse } from '@/types/common';
import type { ToothInstruction, ToothInstructionCreate, ToothInstructionSummary } from '../types/tooth-instruction.types';

async function add(caseId: string, data: ToothInstructionCreate): Promise<ToothInstruction> {
  const res = await api.post<ApiResponse<ToothInstruction>>(`/cases/${caseId}/tooth-instructions`, data);
  return res.data.data!;
}

async function list(caseId: string): Promise<ToothInstruction[]> {
  const res = await api.get<ApiResponse<ToothInstruction[]>>(`/cases/${caseId}/tooth-instructions`);
  return res.data.data!;
}

async function getSummary(caseId: string): Promise<ToothInstructionSummary> {
  const res = await api.get<ApiResponse<ToothInstructionSummary>>(`/cases/${caseId}/tooth-instructions/summary`);
  return res.data.data!;
}

async function update(caseId: string, instructionId: string, data: Partial<ToothInstructionCreate>): Promise<ToothInstruction> {
  const res = await api.put<ApiResponse<ToothInstruction>>(`/cases/${caseId}/tooth-instructions/${instructionId}`, data);
  return res.data.data!;
}

async function remove(caseId: string, instructionId: string): Promise<void> {
  await api.delete(`/cases/${caseId}/tooth-instructions/${instructionId}`);
}

export const toothInstructionService = { add, list, getSummary, update, remove };
