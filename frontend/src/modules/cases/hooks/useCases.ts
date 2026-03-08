// useCases.ts — Hook for case list queries and mutations.
// REACT NATIVE READY: no DOM dependencies.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { caseService } from '../services/case.service';
import type { CaseCreateRequest } from '../types/case.types';

export function useCases(params: {
  status?: string; search?: string; page?: number; per_page?: number;
} = {}) {
  const queryClient = useQueryClient();

  const casesQuery = useQuery({
    queryKey: ['cases', params],
    queryFn: () => caseService.list(params),
  });

  const createMutation = useMutation({
    mutationFn: (data: CaseCreateRequest) => caseService.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cases'] }),
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => caseService.submit(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cases'] }),
  });

  return {
    cases: casesQuery.data?.items ?? [],
    total: casesQuery.data?.total ?? 0,
    totalPages: casesQuery.data?.total_pages ?? 0,
    isLoading: casesQuery.isLoading,
    createCase: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    submitCase: submitMutation.mutateAsync,
  };
}
