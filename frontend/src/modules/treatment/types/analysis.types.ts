// analysis.types.ts — TypeScript interfaces for dental analysis API responses.

// ── Dental Analysis ──────────────────────────────────────────────────

export interface ToothMeasurement {
  fdi: number;
  mesiodistal_width_mm: number;
  centroid: [number, number, number];
  bbox_min: [number, number, number];
  bbox_max: [number, number, number];
}

export interface SpaceAnalysis {
  total_tooth_width_mm: number;
  available_arch_length_mm: number;
  arch_length_mm?: number; // alias kept for compat
  discrepancy_mm: number;
  crowding_severity: 'none' | 'mild' | 'moderate' | 'severe';
  severity?: string; // alias kept for compat
  per_segment?: Record<string, number>;
}

export interface ArchForm {
  arch_form_type: string;
  arch_width_mm: number;
  arch_depth_mm: number;
  fit_error_mm: number;
  total_movement_mm: number;
  tooth_positions: Record<string, [number, number, number]>;
  ideal_positions: Record<string, [number, number, number]>;
  required_movements: Record<string, [number, number, number]>;
}

export interface OcclusalPlane {
  normal: [number, number, number];
  point: [number, number, number];
  fit_error: number;
}

export interface MidlineAnalysis {
  deviation_mm: number;
  direction: string;
}

export interface BoltonAnalysis {
  overall_ratio: number;
  anterior_ratio: number;
  overall_interpretation: string;
  anterior_interpretation: string;
}

export interface OverjetOverbite {
  overjet_mm: number;
  overbite_mm: number;
}

export interface AnalysisResult {
  jaw: string;
  teeth_found: number[];
  occlusal_plane: OcclusalPlane;
  tooth_measurements: ToothMeasurement[];
  space_analysis: SpaceAnalysis | null;
  arch_form: ArchForm | null;
  midline: MidlineAnalysis | null;
  confidence_scores: Record<string, number>;
}

// ── Collision Detection ──────────────────────────────────────────────

export interface Collision {
  fdi_a: number;
  fdi_b: number;
  overlap_mm: number;
  axis: string;
}

export interface CollisionReport {
  total_pairs_checked: number;
  collision_count: number;
  max_overlap_mm: number;
  collisions: Collision[];
}

// ── Snap-to-Arch ─────────────────────────────────────────────────────

export interface SnapToArchResult {
  arch_type: string;
  jaw: string;
  arch_width_mm: number;
  arch_depth_mm: number;
  fit_error_mm: number;
  total_movement_mm: number;
  ideal_positions: Record<string, [number, number, number]>;
  required_movements: Record<string, [number, number, number]>;
  targets: Record<string, { pos_x: number; pos_y: number; pos_z: number }>;
  arch_curve_points: [number, number][];
}

// ── IPR Plan ─────────────────────────────────────────────────────────

export interface IPRContact {
  fdi_a: number;
  fdi_b: number;
  current_width_a: number;
  current_width_b: number;
  max_ipr_a: number;
  max_ipr_b: number;
  suggested_ipr_mm: number;
  ipr_side_a: number;
  ipr_side_b: number;
}

export interface IPRPlan {
  jaw: string;
  crowding_mm: number;
  total_ipr_mm: number;
  total_space_gained_mm: number;
  ipr_sufficient: boolean;
  warnings: string[];
  contacts: IPRContact[];
}

// ── Enhanced Staging ─────────────────────────────────────────────────

export interface StageTransform {
  pos_x: number;
  pos_y: number;
  pos_z: number;
  rot_x?: number;
  rot_y?: number;
  rot_z?: number;
}

export interface Stage {
  stage_index: number;
  label: string;
  transforms: Record<string, StageTransform>;
}

export interface StageIssue {
  severity: 'error' | 'warning' | 'info';
  category: string;
  fdi: number | null;
  message: string;
}

export interface StageValidation {
  is_feasible: boolean;
  stages_valid: number;
  stages_with_errors: number;
  stages_with_warnings: number;
  stage_issues: {
    stage_index: number;
    collision_count: number;
    issues: StageIssue[];
  }[];
}

export interface StagingPlanResult {
  total_stages: number;
  jaw: string;
  per_tooth_stages: Record<string, number>;
  stages: Stage[];
  validation: StageValidation | null;
  warnings: string[];
}

// ── Attachments ──────────────────────────────────────────────────────

export interface AttachmentSpec {
  fdi: number;
  attachment_type: string;
  surface: string;
  position: string;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  orientation_deg: number;
  reason: string;
  priority: string;
}

export interface AttachmentPlan {
  jaw: string;
  total_attachments: number;
  teeth_with_attachments: number[];
  teeth_without_attachments: number[];
  attachments: AttachmentSpec[];
  warnings: string[];
}

// ── Treatment Report ─────────────────────────────────────────────────

export interface TreatmentReportData {
  report_id: string;
  jaw: string;
  teeth_count: number;
  tooth_summaries: Record<string, any>;
  analysis: Record<string, any>;
  staging: Record<string, any> | null;
  attachment_count: number;
  ipr_total_mm: number;
  recommendations: string[];
  warnings: string[];
  difficulty_rating: 'simple' | 'moderate' | 'complex';
  generated_at: string;
}

// ── Clinical Summary ─────────────────────────────────────────────────

export interface SummarySection {
  heading: string;
  content: string;
  findings: string[];
}

export interface ClinicalSummaryResult {
  title: string;
  jaw: string;
  overall_assessment: string;
  treatment_goals: string[];
  estimated_duration: string;
  complexity: string;
  sections: SummarySection[];
  text?: string;
}

// ── Phase 5: Cast Trim ──────────────────────────────────────────────

export interface TrimPlane {
  origin: [number, number, number];
  normal: [number, number, number];
  offset_mm: number;
}

export interface CastTrimResult {
  trimmed_file_path: string;
  faces_removed: number;
  faces_kept: number;
  original_face_count: number;
  base_flattened: boolean;
  processing_time: number;
  jaw: string;
  trim_plane: TrimPlane;
  trim_line_point_count: number;
}

// ── Phase 6: Model Base ─────────────────────────────────────────────

export interface BaseGenerationResult {
  arch_width_mm: number;
  arch_depth_mm: number;
  base_width_mm: number;
  base_depth_mm: number;
  base_height_mm: number;
  base_shape: string;
  processing_time: number;
  jaw: string;
  base_file_path?: string;
  combined_file_path?: string;
}

// ── Phase 7: Movement Plan ──────────────────────────────────────────

export interface MovementRecord {
  fdi: number;
  translation_mm: [number, number, number];
  rotation_deg: [number, number, number];
  total_displacement_mm: number;
  total_rotation_deg: number;
  movement_type: string;
}

export interface MovementProtocolResult {
  stage: number;
  records: MovementRecord[];
  total_teeth_moving: number;
  max_displacement_mm: number;
  max_rotation_deg: number;
}

// ── Phase 8: Protocol Tables ────────────────────────────────────────

export interface DistanceRecord {
  fdi_a: number;
  fdi_b: number;
  distance_mm: number;
  measurement_type: string;
}

export interface DistanceProtocolResult {
  records: DistanceRecord[];
  min_interproximal_mm: number;
  max_interproximal_mm: number;
  mean_interproximal_mm: number;
}

export interface OcclusalContact {
  upper_fdi: number;
  lower_fdi: number;
  distance_mm: number;
  contact_point: [number, number, number];
  intensity: number;
}

export interface OcclusogramResult {
  contacts: OcclusalContact[];
  total_contacts: number;
  mean_distance_mm: number;
  tight_contacts: number;
  open_contacts: number;
  contact_area_mm2: number;
}

export interface SpaceAnalysisSummary {
  arch_perimeter_mm: number;
  tooth_material_mm: number;
  space_available_mm: number;
  crowding_mm: number;
  spacing_mm: number;
  bolton_ratio: number | null;
}

// ── Phase 9: Gingiva ────────────────────────────────────────────────

export interface PapillaInfo {
  fdi_mesial: number;
  fdi_distal: number;
  height_mm: number;
  width_mm: number;
  black_triangle_risk: 'none' | 'low' | 'moderate' | 'high';
}

export interface GingivaSimResult {
  papillae: PapillaInfo[];
  max_displacement_mm: number;
  mean_displacement_mm: number;
  black_triangle_count: number;
  tissue_health_score: number;
  jaw: string;
}

// ── Phase 10: Print Export ──────────────────────────────────────────

export interface PrintValidation {
  is_watertight: boolean;
  is_manifold: boolean;
  has_degenerate_faces: boolean;
  degenerate_face_count: number;
  min_wall_thickness_mm: number;
  volume_mm3: number;
  surface_area_mm2: number;
  bounding_box_mm: [number, number, number];
  face_count: number;
  vertex_count: number;
  is_printable: boolean;
  issues: string[];
}

export interface SupportEstimate {
  support_volume_mm3: number;
  overhang_area_mm2: number;
  overhang_face_count: number;
  support_percentage: number;
  recommended_orientation: string;
}

export interface BatchExportResult {
  total_files: number;
  total_size_bytes: number;
  processing_time: number;
  validation_results: Record<string, PrintValidation>;
}
