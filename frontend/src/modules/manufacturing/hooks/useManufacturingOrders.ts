// useManufacturingOrders.ts — Hook for manufacturing order list queries.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { manufacturingService } from '../services/manufacturing.service';
import type { BulkStatusUpdate } from '../types/manufacturing.types';

export function useManufacturingOrders(params: {
  status?: string; search?: string; page?: number; per_page?: number;
} = {}) {
  const queryClient = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ['manufacturing-orders', params],
    queryFn: () => manufacturingService.list(params),
  });

  const bulkMutation = useMutation({
    mutationFn: (data: BulkStatusUpdate) => manufacturingService.bulkUpdateStatus(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturing-orders'] });
      queryClient.invalidateQueries({ queryKey: ['manufacturing-stats'] });
    },
  });

  return {
    orders: ordersQuery.data?.items ?? [],
    total: ordersQuery.data?.total ?? 0,
    totalPages: ordersQuery.data?.total_pages ?? 0,
    isLoading: ordersQuery.isLoading,
    bulkUpdateStatus: bulkMutation.mutateAsync,
    isBulkUpdating: bulkMutation.isPending,
  };
}
