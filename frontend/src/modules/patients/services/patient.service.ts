// patient.service.ts — All patient API calls.

import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse } from '@/types/common';
import type { Patient, PatientCreateRequest } from '../types/patient.types';

async function create(data: PatientCreateRequest): Promise<Patient> {
  const res = await api.post<ApiResponse<Patient>>('/patients', data);
  return res.data.data!;
}

async function list(params: { search?: string; page?: number; per_page?: number } = {}): Promise<PaginatedResponse<Patient>> {
  const res = await api.get<ApiResponse<PaginatedResponse<Patient>>>('/patients', { params });
  return res.data.data!;
}

async function getById(id: string): Promise<Patient> {
  const res = await api.get<ApiResponse<Patient>>(`/patients/${id}`);
  return res.data.data!;
}

async function update(id: string, data: Partial<PatientCreateRequest>): Promise<Patient> {
  const res = await api.put<ApiResponse<Patient>>(`/patients/${id}`, data);
  return res.data.data!;
}

async function remove(id: string): Promise<void> {
  await api.delete(`/patients/${id}`);
}

export const patientService = { create, list, getById, update, remove };
