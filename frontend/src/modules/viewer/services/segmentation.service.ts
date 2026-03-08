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

export const segmentationService = {
  getSegmentation,
  triggerSegmentation,
  reprocessSegmentation,
  getJobStatus,
  createCorrection,
  listCorrections,
  getAIStats,
};
