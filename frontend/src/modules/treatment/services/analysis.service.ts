// analysis.service.ts — API calls for dental analysis (Phase C-E endpoints).

import api from '@/lib/api';
import type {
  AnalysisResult,
  CollisionReport,
  SnapToArchResult,
  IPRPlan,
  StagingPlanResult,
  AttachmentPlan,
  TreatmentReportData,
  ClinicalSummaryResult,
  CastTrimResult,
  PrintValidation,
  SupportEstimate,
  BaseGenerationResult,
  MovementProtocolResult,
  DistanceProtocolResult,
  SpaceAnalysisSummary,
  GingivaSimResult,
} from '../types/analysis.types';

/** Unwrap ApiResponse and throw on failure. */
function unwrap<T>(res: any): T {
  const body = res.data;
  if (!body.success) {
    throw new Error(body.message || 'Request failed');
  }
  return body.data as T;
}

export const analysisService = {
  // ── Phase B: Dental Analysis ────────────────────────────────────────

  /** Run dental analysis on a single arch */
  analyze: async (filePath: string, jaw?: string, extractionId?: string): Promise<AnalysisResult> => {
    const res = await api.post('/ai/analyze', { file_path: filePath, jaw, extraction_id: extractionId });
    return unwrap<AnalysisResult>(res);
  },

  // ── Phase C: Virtual Setup Tools ────────────────────────────────────

  /** Detect tooth-tooth collisions */
  checkCollisions: async (
    filePath: string,
    jaw?: string,
    transforms?: Record<string, Record<string, number>>,
    extractionId?: string,
  ): Promise<CollisionReport> => {
    const res = await api.post('/ai/collisions', {
      file_path: filePath,
      jaw,
      transforms,
      extraction_id: extractionId,
    });
    return unwrap<CollisionReport>(res);
  },

  /** Compute target transforms to snap teeth onto an ideal arch form */
  snapToArch: async (
    filePath: string,
    jaw?: string,
    archType: string = 'parabolic',
    customWidth?: number,
    customDepth?: number,
    extractionId?: string,
  ): Promise<SnapToArchResult> => {
    const res = await api.post('/ai/snap-to-arch', {
      file_path: filePath,
      jaw,
      arch_type: archType,
      custom_width: customWidth,
      custom_depth: customDepth,
      extraction_id: extractionId,
    });
    return unwrap<SnapToArchResult>(res);
  },

  /** Compute IPR plan for an arch */
  computeIPR: async (
    filePath: string,
    jaw?: string,
    crowdingMm?: number,
    extractionId?: string,
  ): Promise<IPRPlan> => {
    const res = await api.post('/ai/ipr-plan', {
      file_path: filePath,
      jaw,
      crowding_mm: crowdingMm,
      extraction_id: extractionId,
    });
    return unwrap<IPRPlan>(res);
  },

  // ── Phase D: Smart Staging & Attachments ────────────────────────────

  /** Compute enhanced staging plan with easing and sequencing */
  computeStagingPlan: async (params: {
    filePath: string;
    jaw?: string;
    extractionId?: string;
    targets: Record<string, Record<string, number>>;
    constraints?: Record<string, Record<string, any>>;
    maxTranslation?: number;
    maxRotation?: number;
    easing?: string;
    sequencing?: string;
    validate?: boolean;
  }): Promise<StagingPlanResult> => {
    const res = await api.post('/ai/staging-plan', {
      file_path: params.filePath,
      jaw: params.jaw,
      extraction_id: params.extractionId,
      targets: params.targets,
      constraints: params.constraints,
      max_translation_per_stage: params.maxTranslation,
      max_rotation_per_stage: params.maxRotation,
      easing: params.easing ?? 'linear',
      sequencing: params.sequencing ?? 'simultaneous',
      validate: params.validate ?? true,
    });
    return unwrap<StagingPlanResult>(res);
  },

  /** Plan attachment types and positions */
  planAttachments: async (
    filePath: string,
    targets: Record<string, Record<string, number>>,
    jaw?: string,
    extractionId?: string,
  ): Promise<AttachmentPlan> => {
    const res = await api.post('/ai/attachments', {
      file_path: filePath,
      jaw,
      targets,
      extraction_id: extractionId,
    });
    return unwrap<AttachmentPlan>(res);
  },

  // ── Phase E: Doctor Review & Output ─────────────────────────────────

  /** Generate comprehensive treatment report */
  generateReport: async (params: {
    filePath: string;
    jaw?: string;
    extractionId?: string;
    targets?: Record<string, Record<string, number>>;
    constraints?: Record<string, Record<string, any>>;
    crowdingMm?: number;
  }): Promise<TreatmentReportData> => {
    const res = await api.post('/ai/treatment-report', {
      file_path: params.filePath,
      jaw: params.jaw,
      extraction_id: params.extractionId,
      targets: params.targets,
      constraints: params.constraints,
      crowding_mm: params.crowdingMm,
    });
    return unwrap<TreatmentReportData>(res);
  },

  /** Generate clinical summary for doctor review */
  getClinicalSummary: async (params: {
    filePath: string;
    jaw?: string;
    extractionId?: string;
    targets?: Record<string, Record<string, number>>;
    format?: 'json' | 'text';
  }): Promise<ClinicalSummaryResult> => {
    const res = await api.post('/ai/clinical-summary', {
      file_path: params.filePath,
      jaw: params.jaw,
      extraction_id: params.extractionId,
      targets: params.targets,
      format: params.format ?? 'json',
    });
    return unwrap<ClinicalSummaryResult>(res);
  },

  /** Get 4x4 transform matrices for Three.js rendering */
  getTransformMatrices: async (
    stages: Record<string, Record<string, number>>[],
  ): Promise<{ stages: Record<string, number[][]>[] }> => {
    const res = await api.post('/ai/transform-matrices', { stages });
    return unwrap<{ stages: Record<string, number[][]>[] }>(res);
  },

  // ── Phase 5: Cast Trim ──────────────────────────────────────────────

  /** Trim a dental cast along the gum line */
  trimCast: async (params: {
    filePath: string;
    jaw?: string;
    extractionId?: string;
    offsetMm?: number;
    smoothTrimLine?: boolean;
    flattenBase?: boolean;
  }): Promise<CastTrimResult> => {
    const res = await api.post('/ai/trim-cast', {
      file_path: params.filePath,
      jaw: params.jaw,
      extraction_id: params.extractionId,
      offset_mm: params.offsetMm ?? 2.0,
      smooth_trim_line: params.smoothTrimLine ?? true,
      flatten_base: params.flattenBase ?? true,
    });
    return unwrap<CastTrimResult>(res);
  },

  // ── Phase 10: Print Validation ──────────────────────────────────────

  /** Validate a mesh for 3D printing */
  validateForPrinting: async (filePath: string): Promise<PrintValidation> => {
    const res = await api.post('/ai/validate-print', { file_path: filePath });
    return unwrap<PrintValidation>(res);
  },

  /** Estimate support material requirements */
  estimateSupports: async (filePath: string, orientation?: string): Promise<SupportEstimate> => {
    const res = await api.post('/ai/estimate-supports', {
      file_path: filePath,
      orientation: orientation ?? 'occlusal_up',
    });
    return unwrap<SupportEstimate>(res);
  },

  // ── Phase 6: Base Generation ──────────────────────────────────────

  /** Generate a model base */
  generateBase: async (params: {
    filePath: string;
    jaw?: string;
    extractionId?: string;
    baseShape?: string;
    baseHeightMm?: number;
    baseThicknessMm?: number;
    marginMm?: number;
  }): Promise<BaseGenerationResult> => {
    const res = await api.post('/ai/generate-base', {
      file_path: params.filePath,
      jaw: params.jaw,
      extraction_id: params.extractionId,
      base_shape: params.baseShape ?? 'horseshoe',
      base_height_mm: params.baseHeightMm ?? 15.0,
      base_thickness_mm: params.baseThicknessMm ?? 5.0,
      margin_mm: params.marginMm ?? 3.0,
    });
    return unwrap<BaseGenerationResult>(res);
  },

  // ── Phase 8: Protocol Tables ──────────────────────────────────────

  /** Generate movement protocol */
  getMovementProtocol: async (
    filePath: string,
    targets: Record<string, Record<string, number>>,
    jaw?: string,
    extractionId?: string,
  ): Promise<MovementProtocolResult> => {
    const res = await api.post('/ai/movement-protocol', {
      file_path: filePath,
      jaw,
      targets,
      extraction_id: extractionId,
    });
    return unwrap<MovementProtocolResult>(res);
  },

  /** Generate distance protocol */
  getDistanceProtocol: async (
    filePath: string,
    jaw?: string,
    extractionId?: string,
  ): Promise<DistanceProtocolResult> => {
    const res = await api.post('/ai/distance-protocol', {
      file_path: filePath,
      jaw,
      extraction_id: extractionId,
    });
    return unwrap<DistanceProtocolResult>(res);
  },

  /** Generate space analysis summary */
  getSpaceAnalysis: async (
    filePath: string,
    jaw?: string,
    extractionId?: string,
  ): Promise<SpaceAnalysisSummary> => {
    const res = await api.post('/ai/space-analysis-summary', {
      file_path: filePath,
      jaw,
      extraction_id: extractionId,
    });
    return unwrap<SpaceAnalysisSummary>(res);
  },

  // ── Phase 9: Gingiva Simulation ───────────────────────────────────

  /** Simulate gingiva response */
  simulateGingiva: async (params: {
    filePath: string;
    jaw?: string;
    extractionId?: string;
    targets?: Record<string, Record<string, number>>;
    tissueStiffness?: number;
  }): Promise<GingivaSimResult> => {
    const res = await api.post('/ai/gingiva-simulation', {
      file_path: params.filePath,
      jaw: params.jaw,
      extraction_id: params.extractionId,
      targets: params.targets,
      tissue_stiffness: params.tissueStiffness ?? 0.5,
    });
    return unwrap<GingivaSimResult>(res);
  },
};
