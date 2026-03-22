// treatment.service.ts — API calls for treatment planning.

import api from '@/lib/api';
import type {
  TreatmentPlan,
  TreatmentPlanCreate,
  TeethExtraction,
  StepTransformUpdate,
  SegmentationResult,
} from '../types/treatment.types';

export const treatmentService = {
  /** Run AI segmentation and return per-face labels (no extraction yet) */
  segmentMesh: async (filePath: string, jaw?: string): Promise<SegmentationResult> => {
    const res = await api.post('/ai/segment', { file_path: filePath, jaw });
    return res.data.data;
  },

  /** Fetch the original STL file as ArrayBuffer */
  fetchSTLBuffer: async (filePath: string): Promise<ArrayBuffer> => {
    const res = await api.get('/ai/serve-file', {
      params: { path: filePath },
      responseType: 'arraybuffer',
    });
    return res.data;
  },

  /** Extract individual tooth meshes from a segmented scan */
  extractTeeth: async (filePath: string): Promise<TeethExtraction> => {
    const res = await api.post('/ai/extract-teeth', { file_path: filePath });
    return res.data.data;
  },

  /** Extract teeth from user-corrected labels (skip AI re-segmentation) */
  extractTeethFromLabels: async (
    filePath: string,
    faceLabels: number[],
    jaw: string,
  ): Promise<TeethExtraction> => {
    const res = await api.post('/ai/extract-teeth-from-labels', {
      file_path: filePath,
      face_labels: faceLabels,
      jaw,
    });
    return res.data.data;
  },

  /** Fetch a tooth mesh as ArrayBuffer (with auth) */
  fetchToothMeshBuffer: async (url: string): Promise<ArrayBuffer> => {
    // The url comes from backend as /api/v1/ai/tooth-mesh/...
    // Strip /api/v1 prefix since axios baseURL already includes it
    const path = url.replace(/^\/api\/v1/, '');
    const res = await api.get(path, { responseType: 'arraybuffer' });
    return res.data;
  },

  /** Create a new treatment plan */
  createPlan: async (data: TreatmentPlanCreate): Promise<TreatmentPlan> => {
    const res = await api.post('/treatment-plans', data);
    return res.data.data;
  },

  /** Get a treatment plan with all steps and transforms */
  getPlan: async (planId: string): Promise<TreatmentPlan> => {
    const res = await api.get(`/treatment-plans/${planId}`);
    return res.data.data;
  },

  /** List plans for a case */
  listPlans: async (caseId: string): Promise<TreatmentPlan[]> => {
    const res = await api.get(`/treatment-plans/case/${caseId}`);
    return res.data.data;
  },

  /** Add a step to a plan */
  addStep: async (planId: string, data: {
    step_number: number;
    label?: string;
    notes?: string;
    transforms?: StepTransformUpdate[];
  }): Promise<TreatmentPlan> => {
    const res = await api.post(`/treatment-plans/${planId}/steps`, data);
    return res.data.data;
  },

  /** Update transforms for a step */
  updateStepTransforms: async (
    planId: string,
    stepNumber: number,
    transforms: StepTransformUpdate[],
  ): Promise<TreatmentPlan> => {
    const res = await api.put(`/treatment-plans/${planId}/steps/${stepNumber}`, { transforms });
    return res.data.data;
  },

  /** Delete a step */
  deleteStep: async (planId: string, stepNumber: number): Promise<void> => {
    await api.delete(`/treatment-plans/${planId}/steps/${stepNumber}`);
  },

  /** Delete a plan */
  deletePlan: async (planId: string): Promise<void> => {
    await api.delete(`/treatment-plans/${planId}`);
  },

  /** Auto-stage: compute stages from target transforms */
  autoStage: async (data: {
    plan_id: string;
    targets: StepTransformUpdate[];
    max_translation_per_stage?: number;
    max_rotation_per_stage?: number;
  }): Promise<{
    total_stages: number;
    warnings: string[];
    per_tooth_stages: Record<number, number>;
  }> => {
    const res = await api.post('/treatment-plans/auto-stage', data);
    return res.data.data;
  },
};
