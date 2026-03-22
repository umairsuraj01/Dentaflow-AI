// billing.service.ts — API service for billing endpoints.

import api from '@/lib/api';
import type { PricingPlan, Invoice, BillingStats } from '../types/billing.types';

function unwrap<T>(res: any): T {
  const body = res.data;
  if (!body.success) throw new Error(body.message || 'Request failed');
  return body.data as T;
}

export const billingService = {
  getPlans: async (): Promise<PricingPlan[]> => {
    const res = await api.get('/billing/plans');
    return unwrap<PricingPlan[]>(res);
  },

  getInvoices: async (page = 1, perPage = 20): Promise<{ items: Invoice[]; total: number }> => {
    const res = await api.get('/billing/invoices', { params: { page, per_page: perPage } });
    return unwrap<{ items: Invoice[]; total: number }>(res);
  },

  getInvoice: async (id: string): Promise<Invoice> => {
    const res = await api.get(`/billing/invoices/${id}`);
    return unwrap<Invoice>(res);
  },

  getStats: async (): Promise<BillingStats> => {
    const res = await api.get('/billing/stats');
    return unwrap<BillingStats>(res);
  },

  createCheckout: async (amountUsd: number, caseId?: string, description?: string): Promise<string> => {
    const res = await api.post('/billing/checkout', {
      amount_usd: amountUsd,
      case_id: caseId,
      description,
    });
    return unwrap<{ url: string }>(res).url;
  },

  subscribe: async (planSlug: string): Promise<string> => {
    const res = await api.post('/billing/subscribe', { plan_slug: planSlug });
    return unwrap<{ url: string }>(res).url;
  },

  cancelSubscription: async (): Promise<void> => {
    await api.delete('/billing/subscribe');
  },

  getSubscription: async (): Promise<BillingStats> => {
    const res = await api.get('/billing/subscription');
    return unwrap<BillingStats>(res);
  },

  createPortalSession: async (): Promise<string> => {
    const res = await api.post('/billing/portal');
    return unwrap<{ url: string }>(res).url;
  },
};
