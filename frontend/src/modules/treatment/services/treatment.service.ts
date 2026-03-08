// treatment.service.ts — API calls for treatment planning.

import api from '@/lib/api';
import type {
  TreatmentPlan,
  TreatmentPlanCreate,
  TeethExtraction,
  StepTransformUpdate,
} from '../types/treatment.types';

export const treatmentService = {
  /** Extract individual tooth meshes from a segmented scan */
  extractTeeth: async (filePath: string): Promise<TeethExtraction> => {
    const res = await api.post('/ai/extract-teeth', { file_path: filePath });
    return res.data.data;
  },

  /** Fetch a tooth mesh as blob URL (with auth) */
  fetchToothMesh: async (url: string): Promise<string> => {
    const res = await api.get(url, { responseType: 'blob' });
    return URL.createObjectURL(res.data);
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
  addStep: async (planId: string, label?: string): Promise<TreatmentPlan> => {
    const res = await api.post(`/treatment-plans/${planId}/steps`, { label });
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
};
