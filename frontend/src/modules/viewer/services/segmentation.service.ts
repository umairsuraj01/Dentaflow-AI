// segmentation.service.ts — API calls for AI segmentation endpoints.

import api from '@/lib/api';
import type { ApiResponse } from '@/types/common';
import type {
  SegmentationResult,
  SegmentationJobStatus,
  CorrectionRequest,
  Correction,
  AIStats,
} from '../types/segmentation.types';

async function getSegmentation(caseFileId: string): Promise<SegmentationResult> {
  const res = await api.get<ApiResponse<SegmentationResult>>(
    `/ai/segmentation/${caseFileId}`,
  );
  return res.data.data!;
}

async function triggerSegmentation(
  caseId: string,
  caseFileId: string,
): Promise<{ job_id: string }> {
  const res = await api.post<ApiResponse<{ job_id: string }>>(
    `/ai/segmentation/${caseId}/${caseFileId}/process`,
  );
  return res.data.data!;
}

async function reprocessSegmentation(
  caseFileId: string,
): Promise<{ job_id: string }> {
  const res = await api.post<ApiResponse<{ job_id: string }>>(
    '/ai/segmentation/reprocess',
    { case_file_id: caseFileId },
  );
  return res.data.data!;
}

async function getJobStatus(caseFileId: string): Promise<SegmentationJobStatus> {
  const res = await api.get<ApiResponse<SegmentationJobStatus>>(
    `/ai/segmentation/${caseFileId}/status`,
  );
  return res.data.data!;
}

async function createCorrection(
  caseFileId: string,
  data: CorrectionRequest,
): Promise<Correction> {
  const res = await api.post<ApiResponse<Correction>>(
    `/ai/corrections/${caseFileId}`,
    data,
  );
  return res.data.data!;
}

async function listCorrections(caseFileId: string): Promise<Correction[]> {
  const res = await api.get<ApiResponse<Correction[]>>(
    `/ai/corrections/${caseFileId}`,
  );
  return res.data.data!;
}

async function getAIStats(): Promise<AIStats> {
  const res = await api.get<ApiResponse<AIStats>>('/ai/stats');
  return res.data.data!;
}

// ---------------------------------------------------------------------------
// Mesh Repair (Phase 1)
// ---------------------------------------------------------------------------

export interface MeshRepairOptions {
  file_path: string;
  fill_holes?: boolean;
  remove_islands?: boolean;
  remove_spikes?: boolean;
  fix_normals?: boolean;
  smooth?: boolean;
  smooth_iterations?: number;
}

export interface MeshQualityReport {
  score: number;
  is_watertight: boolean;
  is_manifold: boolean;
  vertex_count: number;
  face_count: number;
  hole_count: number;
  components: number;
  degenerate_faces: number;
  non_manifold_edges: number;
  bounding_box: number[];
  surface_area: number;
  volume: number | null;
}

export interface MeshRepairResponse {
  repaired_file_path: string;
  repairs_applied: string[];
  processing_time: number;
  holes_filled: number;
  islands_removed: number;
  spikes_removed: number;
  normals_fixed: boolean;
  faces_smoothed: number;
  quality_before: MeshQualityReport;
  quality_after: MeshQualityReport;
}

async function repairMesh(options: MeshRepairOptions): Promise<MeshRepairResponse> {
  const res = await api.post<ApiResponse<MeshRepairResponse>>(
    '/ai/repair-mesh',
    options,
  );
  return res.data.data!;
}

export const segmentationService = {
  getSegmentation,
  triggerSegmentation,
  reprocessSegmentation,
  getJobStatus,
  createCorrection,
  listCorrections,
  getAIStats,
  repairMesh,
};
