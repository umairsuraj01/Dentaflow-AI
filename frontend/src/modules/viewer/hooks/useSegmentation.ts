// useSegmentation.ts — Hooks for AI segmentation queries and mutations.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { segmentationService } from '../services/segmentation.service';

export function useSegmentation(caseFileId: string | undefined) {
  const queryClient = useQueryClient();

  const segmentationQuery = useQuery({
    queryKey: ['segmentation', caseFileId],
    queryFn: () => segmentationService.getSegmentation(caseFileId!),
    enabled: !!caseFileId,
    retry: false,
  });

  const jobStatusQuery = useQuery({
    queryKey: ['segmentation-status', caseFileId],
    queryFn: () => segmentationService.getJobStatus(caseFileId!),
    enabled: !!caseFileId,
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      if (!state) return false;
      const active = ['PENDING', 'DOWNLOADING', 'PREPROCESSING', 'RUNNING_AI', 'POSTPROCESSING', 'SAVING'];
      return active.includes(state) ? 3000 : false;
    },
  });

  const triggerMutation = useMutation({
    mutationFn: ({ caseId, caseFileId }: { caseId: string; caseFileId: string }) =>
      segmentationService.triggerSegmentation(caseId, caseFileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segmentation-status', caseFileId] });
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: () => segmentationService.reprocessSegmentation(caseFileId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segmentation-status', caseFileId] });
      queryClient.invalidateQueries({ queryKey: ['segmentation', caseFileId] });
    },
  });

  const correctionsQuery = useQuery({
    queryKey: ['corrections', caseFileId],
    queryFn: () => segmentationService.listCorrections(caseFileId!),
    enabled: !!caseFileId,
  });

  const correctionMutation = useMutation({
    mutationFn: (data: Parameters<typeof segmentationService.createCorrection>[1]) =>
      segmentationService.createCorrection(caseFileId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corrections', caseFileId] });
    },
  });

  return {
    segmentation: segmentationQuery.data,
    isSegmentationLoading: segmentationQuery.isLoading,
    segmentationError: segmentationQuery.error,
    jobStatus: jobStatusQuery.data,
    isJobPolling: jobStatusQuery.isFetching,
    triggerSegmentation: triggerMutation.mutateAsync,
    isTriggering: triggerMutation.isPending,
    reprocess: reprocessMutation.mutateAsync,
    isReprocessing: reprocessMutation.isPending,
    corrections: correctionsQuery.data ?? [],
    submitCorrection: correctionMutation.mutateAsync,
    refetchSegmentation: segmentationQuery.refetch,
  };
}

export function useAIStats() {
  return useQuery({
    queryKey: ['ai-stats'],
    queryFn: () => segmentationService.getAIStats(),
  });
}
