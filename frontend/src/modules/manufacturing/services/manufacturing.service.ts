// manufacturing.service.ts — All manufacturing order API calls.

import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse } from '@/types/common';
import type {
  ManufacturingOrder, ManufacturingStats, ShipOrderRequest, BulkStatusUpdate,
} from '../types/manufacturing.types';

async function list(params: {
  status?: string; search?: string; page?: number; per_page?: number;
} = {}): Promise<PaginatedResponse<ManufacturingOrder>> {
  const res = await api.get<ApiResponse<PaginatedResponse<ManufacturingOrder>>>('/manufacturing/orders', { params });
  return res.data.data!;
}

async function getById(id: string): Promise<ManufacturingOrder> {
  const res = await api.get<ApiResponse<ManufacturingOrder>>(`/manufacturing/orders/${id}`);
  return res.data.data!;
}

async function update(id: string, data: Partial<ManufacturingOrder>): Promise<ManufacturingOrder> {
  const res = await api.put<ApiResponse<ManufacturingOrder>>(`/manufacturing/orders/${id}`, data);
  return res.data.data!;
}

async function moveToInProgress(id: string): Promise<ManufacturingOrder> {
  const res = await api.post<ApiResponse<ManufacturingOrder>>(`/manufacturing/orders/${id}/in-progress`);
  return res.data.data!;
}

async function markShipped(id: string, data: ShipOrderRequest): Promise<ManufacturingOrder> {
  const res = await api.post<ApiResponse<ManufacturingOrder>>(`/manufacturing/orders/${id}/ship`, data);
  return res.data.data!;
}

async function bulkUpdateStatus(data: BulkStatusUpdate): Promise<{ updated: number }> {
  const res = await api.post<ApiResponse<{ updated: number }>>('/manufacturing/orders/bulk-status', data);
  return res.data.data!;
}

async function getStats(): Promise<ManufacturingStats> {
  const res = await api.get<ApiResponse<ManufacturingStats>>('/manufacturing/orders/stats');
  return res.data.data!;
}

async function exportCsv(status?: string): Promise<void> {
  const res = await api.get('/manufacturing/orders/export/csv', {
    params: status ? { status } : {},
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'manufacturing_orders.csv';
  a.click();
  window.URL.revokeObjectURL(url);
}

export const manufacturingService = {
  list, getById, update, moveToInProgress, markShipped,
  bulkUpdateStatus, getStats, exportCsv,
};
