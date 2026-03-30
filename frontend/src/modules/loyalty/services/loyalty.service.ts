import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse } from '@/types/common';

export interface LoyaltyAccount { total_points: number; availed_points: number; remaining_points: number; }
export interface LoyaltyTransaction { id: string; points: number; type: string; description: string; created_at: string; }

async function getAccount(): Promise<LoyaltyAccount> {
  const res = await api.get<ApiResponse<LoyaltyAccount>>('/loyalty');
  return res.data.data!;
}

async function getTransactions(params: { type?: string; page?: number } = {}): Promise<PaginatedResponse<LoyaltyTransaction>> {
  const res = await api.get<ApiResponse<PaginatedResponse<LoyaltyTransaction>>>('/loyalty/transactions', { params });
  return res.data.data!;
}

export const loyaltyService = { getAccount, getTransactions };
