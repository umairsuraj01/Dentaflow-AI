// auth.types.ts — TypeScript types for the auth module.

import type { UserRole } from '@/types/common';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  clinic_name: string | null;
  specialization: string | null;
  experience_years: number | null;
  country: string | null;
  timezone: string | null;
  profile_picture_url: string | null;
  org_id: string | null;
  org_name: string | null;
  org_slug: string | null;
  created_at: string;
  last_login_at: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  clinic_name?: string;
  specialization?: string;
  experience_years?: number;
  country?: string;
  timezone?: string;
  org_name?: string;
  invite_token?: string;
}

export interface AuthTokens {
  access_token: string;
  token_type: string;
}
