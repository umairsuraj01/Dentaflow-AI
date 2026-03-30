// app.ts — Single source of truth. Change APP_NAME here = updates everywhere.

export const APP_NAME = 'DentaFlow AI';
export const APP_TAGLINE = 'AI-Powered Dental Treatment Planning';
export const APP_VERSION = '1.0.0';
export const APP_DOMAIN = 'dentaflow.efficientbuy.com';
export const APP_SUPPORT_EMAIL = 'support@dentaflow.efficientbuy.com';
export const APP_WEBSITE = `https://${APP_DOMAIN}`;
export const APP_CASE_PREFIX = 'DF';
export const APP_INVOICE_PREFIX = 'INV';

// Crisp Chat — replace with your Crisp website ID after signup at crisp.chat
export const CRISP_WEBSITE_ID = '';

export const COLORS = {
  navy: '#0F172A',
  blue: '#3B82F6',
  mint: '#10B981',
  white: '#FFFFFF',
  gray: '#F1F5F9',
  text: '#1E293B',
  orange: '#F59E0B',
  red: '#EF4444',
  purple: '#8B5CF6',
} as const;

export const FILE_LIMITS_MB = { scan: 500, dicom: 200, image: 50, pdf: 50 } as const;
export const AI_CONFIDENCE = { high: 0.90, medium: 0.70 } as const;
export const PRICING = { normal: 35, urgent: 55, rush: 80 } as const;
export const TURNAROUND = { normal: 3, urgent: 1, rush: 0 } as const;

export const TOOTH_INSTRUCTION_META = {
  CROWN_DO_NOT_MOVE: { label: 'Crown — Do Not Move', color: '#8B5CF6', icon: 'crown' },
  IMPLANT: { label: 'Implant', color: '#EF4444', icon: 'anchor' },
  BRIDGE_ANCHOR: { label: 'Bridge Anchor', color: '#F59E0B', icon: 'link' },
  BRIDGE_PONTIC: { label: 'Bridge Pontic', color: '#FB923C', icon: 'minus-circle' },
  EXTRACTION_PLANNED: { label: 'Extraction Planned', color: '#DC2626', icon: 'x-circle' },
  RECENTLY_EXTRACTED: { label: 'Recently Extracted', color: '#991B1B', icon: 'alert-circle' },
  AVOID_TIPPING: { label: 'Avoid Tipping', color: '#0EA5E9', icon: 'move' },
  AVOID_ROTATION: { label: 'Avoid Rotation', color: '#0284C7', icon: 'rotate-ccw' },
  LIMIT_MOVEMENT_MM: { label: 'Limit Movement (mm)', color: '#0369A1', icon: 'ruler' },
  SENSITIVE_ROOT: { label: 'Sensitive Root', color: '#D97706', icon: 'alert-triangle' },
  ANKYLOSIS_SUSPECTED: { label: 'Ankylosis Suspected', color: '#B45309', icon: 'lock' },
  CUSTOM_NOTE: { label: 'Custom Clinical Note', color: '#6B7280', icon: 'file-text' },
  IPR_PLANNED: { label: 'IPR Planned', color: '#7C3AED', icon: 'scissors' },
  NO_IPR: { label: 'No IPR', color: '#64748B', icon: 'slash' },
  NO_ELASTIC: { label: 'No Elastic', color: '#475569', icon: 'ban' },
  DO_NOT_MOVE: { label: 'Do Not Move', color: '#3B82F6', icon: 'lock' },
} as const;

export type ToothInstructionType = keyof typeof TOOTH_INSTRUCTION_META;

export const FDI_UPPER = [11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28] as const;
export const FDI_LOWER = [31, 32, 33, 34, 35, 36, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48] as const;
export const FDI_ALL = [...FDI_UPPER, ...FDI_LOWER] as const;

export const AI_STAGES = [
  'PENDING', 'DOWNLOADING', 'PREPROCESSING', 'RUNNING_AI', 'POSTPROCESSING', 'SAVING', 'SUCCESS', 'FAILED',
] as const;

export type AIStagingState = (typeof AI_STAGES)[number];

export const AI_STAGE_LABELS: Record<string, string> = {
  PENDING: 'Queued',
  DOWNLOADING: 'Downloading',
  PREPROCESSING: 'Preprocessing',
  RUNNING_AI: 'Running AI',
  POSTPROCESSING: 'Post-processing',
  SAVING: 'Saving',
  SUCCESS: 'Complete',
  FAILED: 'Failed',
};

export const ROUTES = {
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  FORGOT_PASSWORD: '/auth/forgot-password',
  DASHBOARD: '/dashboard',
  CASES: '/cases',
  CASES_NEW: '/cases/new',
  CASE_DETAIL: (id: string) => `/cases/${id}`,
  AI_PROCESSING: (caseId: string, fileId: string) => `/cases/${caseId}/ai?fileId=${fileId}`,
  BILLING: '/billing',
  MANUFACTURING: '/manufacturing',
  ORG_SETTINGS: '/settings/organization',
  CLINICAL_PREFERENCES: '/clinical-preferences',
  SUPPORT: '/support',
  LOYALTY: '/loyalty',
  ADMIN: '/admin',
} as const;
