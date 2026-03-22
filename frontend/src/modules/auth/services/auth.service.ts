// auth.service.ts — All auth API calls. No business logic — just HTTP.

import api from '@/lib/api';
import type { ApiResponse } from '@/types/common';
import type { AuthTokens, LoginRequest, RegisterRequest, User } from '../types/auth.types';

async function login(data: LoginRequest): Promise<AuthTokens> {
  const res = await api.post<ApiResponse<AuthTokens>>('/auth/login', data);
  return res.data.data!;
}

async function register(data: RegisterRequest): Promise<User> {
  const res = await api.post<ApiResponse<User>>('/auth/register', data);
  return res.data.data!;
}

async function getMe(): Promise<User> {
  const res = await api.get<ApiResponse<User>>('/auth/me');
  return res.data.data!;
}

async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email });
}

async function resetPassword(token: string, newPassword: string): Promise<void> {
  await api.post('/auth/reset-password', { token, new_password: newPassword });
}

async function verifyEmail(token: string): Promise<void> {
  await api.post('/auth/verify-email', { token });
}

async function updateProfile(data: {
  full_name?: string;
  clinic_name?: string;
  specialization?: string;
  experience_years?: number;
  country?: string;
  timezone?: string;
}): Promise<User> {
  const res = await api.put<ApiResponse<User>>('/auth/me', data);
  return res.data.data!;
}

async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.put('/auth/me/password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

export const authService = {
  login,
  register,
  getMe,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  updateProfile,
  changePassword,
};
