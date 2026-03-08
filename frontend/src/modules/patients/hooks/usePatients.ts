// usePatients.ts — Hook for patient CRUD operations.
// REACT NATIVE READY: no DOM dependencies.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { patientService } from '../services/patient.service';
import type { PatientCreateRequest } from '../types/patient.types';

export function usePatients(search?: string) {
  const queryClient = useQueryClient();

  const patientsQuery = useQuery({
    queryKey: ['patients', search],
    queryFn: () => patientService.list({ search, per_page: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: (data: PatientCreateRequest) => patientService.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patients'] }),
  });

  return {
    patients: patientsQuery.data?.items ?? [],
    total: patientsQuery.data?.total ?? 0,
    isLoading: patientsQuery.isLoading,
    createPatient: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
}
