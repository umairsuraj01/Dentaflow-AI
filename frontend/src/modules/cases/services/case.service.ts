// case.service.ts — All case management API calls.

import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse } from '@/types/common';
import type {
  Case, CaseCreateRequest, CaseFile, CaseNote, DashboardStats, UploadUrlResponse,
} from '../types/case.types';

async function create(data: CaseCreateRequest): Promise<Case> {
  const res = await api.post<ApiResponse<Case>>('/cases', data);
  return res.data.data!;
}

async function list(params: {
  status?: string; search?: string; page?: number; per_page?: number;
} = {}): Promise<PaginatedResponse<Case>> {
  const res = await api.get<ApiResponse<PaginatedResponse<Case>>>('/cases', { params });
  return res.data.data!;
}

async function getById(id: string): Promise<Case> {
  const res = await api.get<ApiResponse<Case>>(`/cases/${id}`);
  return res.data.data!;
}

async function update(id: string, data: Partial<CaseCreateRequest>): Promise<Case> {
  const res = await api.put<ApiResponse<Case>>(`/cases/${id}`, data);
  return res.data.data!;
}

async function submit(id: string): Promise<Case> {
  const res = await api.post<ApiResponse<Case>>(`/cases/${id}/submit`);
  return res.data.data!;
}

async function assign(id: string, technicianId: string): Promise<Case> {
  const res = await api.post<ApiResponse<Case>>(`/cases/${id}/assign`, { technician_id: technicianId });
  return res.data.data!;
}

async function approve(id: string): Promise<Case> {
  const res = await api.post<ApiResponse<Case>>(`/cases/${id}/approve`);
  return res.data.data!;
}

async function requestRevision(id: string, reason: string): Promise<Case> {
  const res = await api.post<ApiResponse<Case>>(`/cases/${id}/request-revision`, { reason });
  return res.data.data!;
}

async function cancel(id: string): Promise<Case> {
  const res = await api.post<ApiResponse<Case>>(`/cases/${id}/cancel`);
  return res.data.data!;
}

async function getUploadUrl(caseId: string, data: {
  file_type: string; original_filename: string; file_size_bytes: number; mime_type?: string;
}): Promise<UploadUrlResponse> {
  const res = await api.post<ApiResponse<UploadUrlResponse>>(`/cases/${caseId}/files/upload-url`, data);
  return res.data.data!;
}

async function confirmUpload(caseId: string, fileId: string): Promise<CaseFile> {
  const res = await api.post<ApiResponse<CaseFile>>(`/cases/${caseId}/files/confirm`, { file_id: fileId });
  return res.data.data!;
}

async function listFiles(caseId: string): Promise<CaseFile[]> {
  const res = await api.get<ApiResponse<CaseFile[]>>(`/cases/${caseId}/files`);
  return res.data.data!;
}

async function deleteFile(caseId: string, fileId: string): Promise<void> {
  await api.delete(`/cases/${caseId}/files/${fileId}`);
}

async function addNote(caseId: string, data: { note_text: string; note_type?: string }): Promise<CaseNote> {
  const res = await api.post<ApiResponse<CaseNote>>(`/cases/${caseId}/notes`, data);
  return res.data.data!;
}

async function listNotes(caseId: string): Promise<CaseNote[]> {
  const res = await api.get<ApiResponse<CaseNote[]>>(`/cases/${caseId}/notes`);
  return res.data.data!;
}

async function getDashboardStats(): Promise<DashboardStats> {
  const res = await api.get<ApiResponse<DashboardStats>>('/dashboard/stats');
  return res.data.data!;
}

export const caseService = {
  create, list, getById, update, submit, assign, approve,
  requestRevision, cancel, getUploadUrl, confirmUpload,
  listFiles, deleteFile, addNote, listNotes, getDashboardStats,
};
