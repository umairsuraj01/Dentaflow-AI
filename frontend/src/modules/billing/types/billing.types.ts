// billing.types.ts — Type definitions for billing module.

export interface PricingPlan {
  id: string;
  name: string;
  slug: string;
  monthly_fee_usd: number;
  price_per_case_usd: number | null;
  included_cases_per_month: number;
  overage_per_case_usd: number;
  features: string[];
  turnaround_days: number;
  sort_order: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED';
  amount_usd: number;
  tax_amount_usd?: number;
  total_amount_usd: number;
  currency: string;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  case_id: string | null;
  line_items: { description: string; quantity: number; unit_price: number; amount: number }[];
  notes?: string;
  pdf_url?: string;
  dentist?: {
    full_name: string;
    email: string;
    clinic_name: string | null;
  };
}

export interface BillingStats {
  current_plan: string;
  plan_slug: string;
  cases_used: number;
  cases_included: number;
  period_end: string | null;
  monthly_spend_usd: number;
  total_spent_usd: number;
  pending_invoices: number;
  subscription_status: string | null;
}
