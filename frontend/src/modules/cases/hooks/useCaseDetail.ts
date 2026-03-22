// REACT NATIVE READY: No DOM dependencies. Copy this file to RN project unchanged.
// useCaseDetail.ts — Hook for single case detail, actions, and notes.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { caseService } from '../services/case.service';

export function useCaseDetail(caseId: string | undefined) {
  const queryClient = useQueryClient();
  const key = ['case', caseId];

  const caseQuery = useQuery({
    queryKey: key,
    queryFn: () => caseService.getById(caseId!),
    enabled: !!caseId,
  });

  const approveMutation = useMutation({
    mutationFn: () => caseService.approve(caseId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const revisionMutation = useMutation({
    mutationFn: (reason: string) => caseService.requestRevision(caseId!, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => caseService.cancel(caseId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const addNoteMutation = useMutation({
    mutationFn: (data: { note_text: string; note_type?: string }) =>
      caseService.addNote(caseId!, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return {
    caseData: caseQuery.data,
    isLoading: caseQuery.isLoading,
    approve: approveMutation.mutateAsync,
    requestRevision: revisionMutation.mutateAsync,
    cancelCase: cancelMutation.mutateAsync,
    addNote: addNoteMutation.mutateAsync,
    refetch: caseQuery.refetch,
  };
}
