// case.types.ts — TypeScript types for case management.

export type CaseStatus =
  | 'DRAFT' | 'SUBMITTED' | 'ASSIGNED' | 'IN_PROGRESS'
  | 'REVIEW' | 'REVISION_REQUESTED' | 'APPROVED' | 'COMPLETED' | 'CANCELLED';

export type CasePriority = 'NORMAL' | 'URGENT' | 'RUSH';
export type TreatmentType = 'FULL_ARCH' | 'UPPER_ONLY' | 'LOWER_ONLY' | 'BOTH_ARCHES';
export type FileType =
  | 'UPPER_SCAN' | 'LOWER_SCAN' | 'BITE_SCAN' | 'PHOTO'
  | 'XRAY' | 'TREATMENT_PLAN' | 'ALIGNER_FILES' | 'REPORT' | 'OTHER'
  | 'FRONT_FACE' | 'SIDE_PROFILE' | 'SMILE_PHOTO'
  | 'UPPER_OCCLUSAL_PHOTO' | 'LOWER_OCCLUSAL_PHOTO'
  | 'FRONT_INTRAORAL' | 'LEFT_BUCCAL' | 'RIGHT_BUCCAL'
  | 'LATERAL_CEPH' | 'PANORAMIC_XRAY';

export interface CaseFile {
  id: string;
  case_id: string;
  file_type: FileType;
  original_filename: string;
  file_size_bytes: number;
  mime_type: string | null;
  file_format: string | null;
  upload_status: string;
  is_ai_processed: boolean;
  uploaded_by_id: string;
  created_at: string;
}

export interface CaseNote {
  id: string;
  case_id: string;
  author_id: string;
  note_text: string;
  note_type: string;
  is_visible_to_dentist: boolean;
  created_at: string;
}

export interface Case {
  id: string;
  patient_id: string;
  dentist_id: string;
  technician_id: string | null;
  case_number: string;
  status: CaseStatus;
  treatment_type: TreatmentType;
  priority: CasePriority;
  arch_type: string | null;
  chief_complaint: string | null;
  treatment_goals: string | null;
  special_instructions: string | null;
  patient_type: string | null;
  retainer_preference: string | null;
  passive_aligners: string | null;
  aligner_shipment: string | null;
  rescan_after_ipr: boolean;
  midline_instruction: string | null;
  overjet_instruction: string | null;
  overbite_instruction: string | null;
  crossbite_instruction: string | null;
  right_canine_class: string | null;
  left_canine_class: string | null;
  right_molar_class: string | null;
  left_molar_class: string | null;
  ipr_preference: string | null;
  proclination_preference: string | null;
  expansion_preference: string | null;
  extraction_preference: string | null;
  ipr_prescription: string | null;
  auxiliary_type: string | null;
  target_turnaround_days: number;
  price_usd: number | null;
  due_date: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  managed_by_platform: boolean;
  created_at: string;
  updated_at: string;
  files: CaseFile[];
  notes: CaseNote[];
}

export interface CaseCreateRequest {
  patient_id: string;
  treatment_type: TreatmentType;
  priority: CasePriority;
  arch_type?: string;
  chief_complaint?: string;
  treatment_goals?: string;
  special_instructions?: string;
  target_turnaround_days?: number;
  patient_type?: string;
  retainer_preference?: string;
  passive_aligners?: string;
  aligner_shipment?: string;
  rescan_after_ipr?: boolean;
  midline_instruction?: string;
  overjet_instruction?: string;
  overbite_instruction?: string;
  crossbite_instruction?: string;
  right_canine_class?: string;
  left_canine_class?: string;
  right_molar_class?: string;
  left_molar_class?: string;
  ipr_preference?: string;
  proclination_preference?: string;
  expansion_preference?: string;
  extraction_preference?: string;
  ipr_prescription?: string;
  auxiliary_type?: string;
}

export interface DashboardStats {
  active_cases: number;
  pending_review: number;
  completed: number;
  total_revenue: number;
}

export interface UploadUrlResponse {
  upload_url: string;
  file_id: string;
  s3_key: string;
}
