// manufacturing.types.ts — TypeScript interfaces for manufacturing orders.

export type OrderStatus = 'NEW' | 'IN_PROGRESS' | 'SHIPPED' | 'CANCELLED';
export type OrderType = 'DEFAULT' | 'REPLACEMENT';
export type CaseType = 'INITIAL' | 'REFINEMENT';
export type ReplacementReason = 'DEFECTIVE' | 'MISSING' | 'OTHER';

export interface ManufacturingOrder {
  id: string;
  case_id: string;
  treatment_plan_id: string | null;
  assigned_to_id: string | null;
  order_number: string;
  status: OrderStatus;
  order_type: OrderType;
  case_type: CaseType;
  replacement_reason: ReplacementReason | null;
  trimline: string;
  aligner_material: string;
  attachment_template_material: string;
  cutout_info: string | null;
  special_instructions: string | null;
  total_trays: number;
  upper_aligner_count: number;
  lower_aligner_count: number;
  attachment_template_count: number;
  attachment_start_stage: number | null;
  tracking_number: string | null;
  shipping_carrier: string | null;
  shipped_at: string | null;
  target_32c_date: string | null;
  assigned_at: string | null;
  created_at: string;
  updated_at: string;
  patient_name: string | null;
  case_number: string | null;
  assigned_to_name: string | null;
}

export interface ManufacturingStats {
  new: number;
  in_progress: number;
  shipped: number;
}

export interface ShipOrderRequest {
  tracking_number: string;
  shipping_carrier: string;
}

export interface BulkStatusUpdate {
  order_ids: string[];
  target_status: OrderStatus;
}
