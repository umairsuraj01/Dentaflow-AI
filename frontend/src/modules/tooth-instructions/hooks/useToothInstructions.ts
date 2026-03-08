// useToothInstructions.ts — Hook for tooth instruction CRUD (local or API-backed).
// REACT NATIVE READY: no DOM dependencies.

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toothInstructionService } from '../services/tooth-instruction.service';
import type { ToothInstruction, ToothInstructionCreate } from '../types/tooth-instruction.types';

interface UseToothInstructionsOptions {
  caseId?: string;
  onChange?: (instructions: ToothInstructionCreate[]) => void;
}

export function useToothInstructions({ caseId, onChange }: UseToothInstructionsOptions = {}) {
  const queryClient = useQueryClient();
  const [localInstructions, setLocalInstructions] = useState<ToothInstructionCreate[]>([]);

  const apiQuery = useQuery({
    queryKey: ['tooth-instructions', caseId],
    queryFn: () => toothInstructionService.list(caseId!),
    enabled: !!caseId,
  });

  const addMutation = useMutation({
    mutationFn: (data: ToothInstructionCreate) =>
      toothInstructionService.add(caseId!, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tooth-instructions', caseId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (instructionId: string) =>
      toothInstructionService.remove(caseId!, instructionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tooth-instructions', caseId] }),
  });

  const addLocal = useCallback((data: ToothInstructionCreate) => {
    setLocalInstructions((prev) => {
      const next = [...prev, data];
      onChange?.(next);
      return next;
    });
  }, [onChange]);

  const removeLocal = useCallback((index: number) => {
    setLocalInstructions((prev) => {
      const next = prev.filter((_, i) => i !== index);
      onChange?.(next);
      return next;
    });
  }, [onChange]);

  const addInstruction = useCallback(async (data: ToothInstructionCreate) => {
    if (caseId) {
      await addMutation.mutateAsync(data);
    } else {
      addLocal(data);
    }
  }, [caseId, addMutation, addLocal]);

  const removeInstruction = useCallback(async (idOrIndex: string | number) => {
    if (caseId && typeof idOrIndex === 'string') {
      await deleteMutation.mutateAsync(idOrIndex);
    } else if (typeof idOrIndex === 'number') {
      removeLocal(idOrIndex);
    }
  }, [caseId, deleteMutation, removeLocal]);

  const instructions: ToothInstruction[] | ToothInstructionCreate[] = caseId
    ? (apiQuery.data ?? [])
    : localInstructions;

  return {
    instructions,
    isLoading: caseId ? apiQuery.isLoading : false,
    addInstruction,
    removeInstruction,
  };
}
