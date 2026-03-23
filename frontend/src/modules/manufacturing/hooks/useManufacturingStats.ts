// useManufacturingStats.ts — Hook for manufacturing order counts per status.

import { useQuery } from '@tanstack/react-query';
import { manufacturingService } from '../services/manufacturing.service';

export function useManufacturingStats() {
  const statsQuery = useQuery({
    queryKey: ['manufacturing-stats'],
    queryFn: () => manufacturingService.getStats(),
    refetchInterval: 30_000,
  });

  return {
    stats: statsQuery.data ?? { new: 0, in_progress: 0, shipped: 0 },
    isLoading: statsQuery.isLoading,
  };
}
