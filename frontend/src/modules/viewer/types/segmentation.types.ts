// segmentation.types.ts — Types for AI segmentation data.

export interface SegmentationResult {
  id: string;
  case_file_id: string;
  labels_json: string;
  confidence_json: string;
  restricted_teeth_json: string;
  overridden_points_count: number;
  model_version: string;
  processing_time_seconds: number;
  total_points: number;
  teeth_found_json: string;
  colored_mesh_s3_key: string | null;
  created_at: string;
}

export interface SegmentationJobStatus {
  job_id: string;
  case_file_id: string;
  state: string;
  stage: string | null;
  error: string | null;
}

export interface CorrectionRequest {
  segmentation_result_id: string;
  original_segmentation_json: string;
  corrected_segmentation_json: string;
  correction_type: string;
  confidence_score: number;
  time_taken_seconds: number;
}

export interface Correction {
  id: string;
  case_file_id: string;
  technician_id: string;
  segmentation_result_id: string;
  correction_type: string;
  confidence_score: number;
  time_taken_seconds: number;
  used_for_training: boolean;
  created_at: string;
}

export interface AIStats {
  total_segmentations: number;
  total_corrections: number;
  corrections_used_for_training: number;
  average_processing_time: number;
  average_confidence_score: number;
  model_version: string;
}

export type AIStagingState =
  | 'PENDING'
  | 'DOWNLOADING'
  | 'PREPROCESSING'
  | 'RUNNING_AI'
  | 'POSTPROCESSING'
  | 'SAVING'
  | 'SUCCESS'
  | 'FAILED';
