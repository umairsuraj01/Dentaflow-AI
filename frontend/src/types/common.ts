// common.ts — Shared TypeScript types used across the application.

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export type UserRole = 'SUPER_ADMIN' | 'DENTIST' | 'TECHNICIAN' | 'LAB_MANAGER';
