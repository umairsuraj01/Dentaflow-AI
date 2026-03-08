// treatment.types.ts — TypeScript interfaces for treatment planning.

export interface ToothTransform {
  fdi_number: number;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  rot_x: number; // degrees
  rot_y: number;
  rot_z: number;
}

export interface TreatmentStep {
  id: string;
  plan_id: string;
  step_number: number;
  label: string | null;
  notes: string | null;
  transforms: ToothTransform[];
}

export interface TreatmentPlan {
  id: string;
  case_id: string;
  created_by_id: string;
  name: string;
  description: string | null;
  extraction_id: string | null;
  total_steps: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  steps: TreatmentStep[];
  created_at: string;
  updated_at: string;
}

export interface ExtractedTooth {
  fdi: number;
  mesh_url: string;
  centroid: [number, number, number];
  bbox_min: [number, number, number];
  bbox_max: [number, number, number];
}

export interface TeethExtraction {
  extraction_id: string;
  teeth: Record<number, ExtractedTooth>;
  gum_mesh_url: string;
}

export interface TreatmentPlanCreate {
  case_id: string;
  name: string;
  description?: string;
  extraction_id?: string;
}

export interface StepTransformUpdate {
  fdi_number: number;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  rot_x: number;
  rot_y: number;
  rot_z: number;
}
