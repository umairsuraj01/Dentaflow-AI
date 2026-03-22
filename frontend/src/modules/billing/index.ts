// billing/index.ts — Public API for the billing module.

export { BillingDashboardPage } from './pages/BillingDashboardPage';
export { PricingPage } from './pages/PricingPage';
export { billingService } from './services/billing.service';
export type { PricingPlan, Invoice, BillingStats } from './types/billing.types';
