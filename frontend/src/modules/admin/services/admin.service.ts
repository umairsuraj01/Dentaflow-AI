// admin.service.ts — Admin user management API calls.

import api from '@/lib/api';
import type { ApiResponse, PaginatedResponse } from '@/types/common';

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  clinic_name: string | null;
  specialization: string | null;
  experience_years: number | null;
  country: string | null;
  created_at: string;
  last_login_at: string | null;
}

async function listUsers(
  params: { search?: string; role?: string; page?: number; per_page?: number } = {},
): Promise<PaginatedResponse<AdminUser>> {
  const res = await api.get<ApiResponse<PaginatedResponse<AdminUser>>>('/admin/users', { params });
  return res.data.data!;
}

async function updateRole(userId: string, role: string): Promise<AdminUser> {
  const res = await api.put<ApiResponse<AdminUser>>(`/admin/users/${userId}/role`, null, {
    params: { role },
  });
  return res.data.data!;
}

async function toggleStatus(userId: string): Promise<AdminUser> {
  const res = await api.put<ApiResponse<AdminUser>>(`/admin/users/${userId}/status`);
  return res.data.data!;
}

async function deleteUser(userId: string): Promise<void> {
  await api.delete(`/admin/users/${userId}`);
}

export const adminService = { listUsers, updateRole, toggleStatus, deleteUser };
