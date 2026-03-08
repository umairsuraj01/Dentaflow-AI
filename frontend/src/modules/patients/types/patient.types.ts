// patient.types.ts — TypeScript types for patient management.

export interface Patient {
  id: string;
  dentist_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  patient_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientCreateRequest {
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  gender?: string;
  patient_reference?: string;
  notes?: string;
}
