// useOrderDetail.ts — Hook for single manufacturing order queries and mutations.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { manufacturingService } from '../services/manufacturing.service';
import type { ManufacturingOrder, ShipOrderRequest } from '../types/manufacturing.types';

export function useOrderDetail(orderId: string) {
  const queryClient = useQueryClient();

  const orderQuery = useQuery({
    queryKey: ['manufacturing-order', orderId],
    queryFn: () => manufacturingService.getById(orderId),
    enabled: !!orderId,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<ManufacturingOrder>) => manufacturingService.update(orderId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturing-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['manufacturing-orders'] });
    },
  });

  const moveToInProgressMutation = useMutation({
    mutationFn: () => manufacturingService.moveToInProgress(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturing-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['manufacturing-orders'] });
      queryClient.invalidateQueries({ queryKey: ['manufacturing-stats'] });
    },
  });

  const markShippedMutation = useMutation({
    mutationFn: (data: ShipOrderRequest) => manufacturingService.markShipped(orderId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturing-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['manufacturing-orders'] });
      queryClient.invalidateQueries({ queryKey: ['manufacturing-stats'] });
    },
  });

  return {
    order: orderQuery.data,
    isLoading: orderQuery.isLoading,
    updateOrder: updateMutation.mutateAsync,
    moveToInProgress: moveToInProgressMutation.mutateAsync,
    markShipped: markShippedMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    isMoving: moveToInProgressMutation.isPending,
    isShipping: markShippedMutation.isPending,
  };
}
