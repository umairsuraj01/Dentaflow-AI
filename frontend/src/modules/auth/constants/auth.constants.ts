// auth.constants.ts — Auth-specific constants.

export const AUTH_ROUTES = {
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  FORGOT_PASSWORD: '/auth/forgot-password',
} as const;

export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  DENTIST: 'DENTIST',
  TECHNICIAN: 'TECHNICIAN',
  LAB_MANAGER: 'LAB_MANAGER',
} as const;

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  DENTIST: 'Dentist',
  TECHNICIAN: 'Technician',
  LAB_MANAGER: 'Lab Manager',
} as const;

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (v: string) => v.length >= 8 },
  { label: 'One uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'One number', test: (v: string) => /[0-9]/.test(v) },
  { label: 'One special character', test: (v: string) => /[!@#$%^&*]/.test(v) },
] as const;
