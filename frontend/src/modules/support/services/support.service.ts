import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse } from '@/types/common';
import type { SupportTicket } from '../types/support.types';

async function list(params: { status?: string; page?: number; per_page?: number } = {}): Promise<PaginatedResponse<SupportTicket>> {
  const res = await api.get<ApiResponse<PaginatedResponse<SupportTicket>>>('/support/tickets', { params });
  return res.data.data!;
}

async function getById(id: string): Promise<SupportTicket> {
  const res = await api.get<ApiResponse<SupportTicket>>(`/support/tickets/${id}`);
  return res.data.data!;
}

async function create(data: { subject: string; description: string; priority: string; category: string }): Promise<SupportTicket> {
  const res = await api.post<ApiResponse<SupportTicket>>('/support/tickets', data);
  return res.data.data!;
}

async function addComment(ticketId: string, data: { message: string; attachment_url?: string }): Promise<void> {
  await api.post(`/support/tickets/${ticketId}/comments`, data);
}

async function updateStatus(ticketId: string, status: string): Promise<void> {
  await api.put(`/support/tickets/${ticketId}/status?status=${status}`);
}

export const supportService = { list, getById, create, addComment, updateStatus };
