// BillingDashboardPage.tsx — Premium billing overview with plan usage, spend, and invoices.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  CreditCard, Receipt, TrendingUp, Package, ExternalLink,
  AlertCircle, Download, XCircle, ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate, cn } from '@/lib/utils';
import { billingService } from '../services/billing.service';
import type { Invoice } from '../types/billing.types';

const STATUS_BADGE: Record<Invoice['status'], { variant: 'green' | 'blue' | 'red' | 'orange' | 'default' | 'purple'; label: string }> = {
  PAID: { variant: 'green', label: 'Paid' },
  SENT: { variant: 'blue', label: 'Sent' },
  OVERDUE: { variant: 'red', label: 'Overdue' },
  DRAFT: { variant: 'default', label: 'Draft' },
  CANCELLED: { variant: 'default', label: 'Cancelled' },
  REFUNDED: { variant: 'purple', label: 'Refunded' },
};

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export function BillingDashboardPage() {
  const navigate = useNavigate();
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery({ queryKey: ['billing-stats'], queryFn: billingService.getStats });
  const { data: invoiceData, isLoading: invoicesLoading } = useQuery({ queryKey: ['billing-invoices'], queryFn: () => billingService.getInvoices() });

  const portalMutation = useMutation({
    mutationFn: billingService.createPortalSession,
    onSuccess: (url) => { window.location.href = url; },
  });
  const cancelMutation = useMutation({
    mutationFn: billingService.cancelSubscription,
    onSuccess: () => { setCancelConfirm(false); window.location.reload(); },
  });

  if (statsLoading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>;

  const hasSubscription = stats?.subscription_status === 'active';
  const usagePercent = stats && stats.cases_included > 0
    ? Math.min(100, Math.round((stats.cases_used / stats.cases_included) * 100))
    : 0;

  const STAT_CARDS = [
    {
      label: 'Current Plan', value: stats?.current_plan ?? 'Pay Per Case',
      icon: Package, iconBg: 'bg-blue-500/10', iconColor: 'text-blue-500',
      gradient: 'from-blue-500 to-blue-400',
    },
    {
      label: 'This Month', value: `$${stats?.monthly_spend_usd?.toFixed(2) ?? '0.00'}`,
      icon: TrendingUp, iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500',
      gradient: 'from-emerald-500 to-teal-400',
    },
    {
      label: 'Total Spent', value: `$${stats?.total_spent_usd?.toFixed(2) ?? '0.00'}`,
      icon: CreditCard, iconBg: 'bg-violet-500/10', iconColor: 'text-violet-500',
      gradient: 'from-violet-500 to-purple-400',
    },
    {
      label: 'Pending Invoices', value: stats?.pending_invoices ?? 0,
      icon: Receipt, iconBg: (stats?.pending_invoices ?? 0) > 0 ? 'bg-amber-500/10' : 'bg-slate-100',
      iconColor: (stats?.pending_invoices ?? 0) > 0 ? 'text-amber-500' : 'text-slate-400',
      gradient: 'from-amber-500 to-orange-400',
    },
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-text tracking-tight">Billing</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your subscription, usage, and invoices</p>
        </div>
        <div className="flex gap-2">
          <Button variant="gradient" onClick={() => navigate('/billing/pricing')} className="shadow-button hover:shadow-glow-blue">
            <Sparkles className="mr-2 h-4 w-4" /> View Plans
          </Button>
          {hasSubscription && (
            <Button variant="outline" loading={portalMutation.isPending} onClick={() => portalMutation.mutate()}>
              <CreditCard className="mr-2 h-4 w-4" /> Manage Payment
              <ExternalLink className="ml-1.5 h-3 w-3" />
            </Button>
          )}
        </div>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STAT_CARDS.map((card) => (
          <motion.div
            key={card.label}
            variants={fadeUp}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="group relative overflow-hidden rounded-2xl bg-white border border-slate-200/60 p-5 shadow-card hover:shadow-card-hover transition-all duration-300"
          >
            <div className={`absolute -top-8 -right-8 h-20 w-20 rounded-full ${card.iconBg} blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
            <div className="relative">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl mb-3 transition-transform duration-300 group-hover:scale-110', card.iconBg)}>
                <card.icon className={cn('h-5 w-5', card.iconColor)} strokeWidth={1.8} />
              </div>
              <p className="text-xl font-bold text-dark-text">{card.value}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">{card.label}</p>
            </div>
            <div className={`absolute bottom-0 left-0 h-[3px] w-full bg-gradient-to-r ${card.gradient} opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-full group-hover:translate-y-0`} />
          </motion.div>
        ))}
      </div>

      {/* Usage + Subscription */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Usage Card */}
        <motion.div variants={fadeUp} className="rounded-2xl bg-white border border-slate-200/60 shadow-card overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-[15px] font-semibold text-dark-text">Plan Usage</h2>
          </div>
          <div className="p-6">
            {hasSubscription && stats ? (
              <div>
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-3xl font-bold text-dark-text">{stats.cases_used}</span>
                  <span className="text-sm text-slate-500">of {stats.cases_included} cases</span>
                </div>
                <div className="mb-3 h-3 overflow-hidden rounded-full bg-slate-100">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${usagePercent}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                    className={cn(
                      'h-full rounded-full',
                      usagePercent >= 90 ? 'bg-gradient-to-r from-red-500 to-red-400' :
                      usagePercent >= 70 ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
                      'bg-gradient-to-r from-electric to-cyan-400',
                    )}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">{usagePercent}% used</span>
                  {stats.period_end && <span>Resets {formatDate(stats.period_end)}</span>}
                </div>
                {usagePercent >= 90 && (
                  <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-amber-50 border border-amber-200/60 p-3.5 text-xs text-amber-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Nearing your plan limit. Additional cases billed at overage rate.
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100">
                  <Package className="h-8 w-8 text-electric" />
                </div>
                <p className="font-semibold text-dark-text mb-1">Pay Per Case</p>
                <p className="text-sm text-slate-500 mb-5 max-w-xs mx-auto">
                  You're paying per case. Subscribe to a plan to save on volume.
                </p>
                <Button variant="gradient" onClick={() => navigate('/billing/pricing')}>
                  View Plans <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Subscription Card */}
        <motion.div variants={fadeUp} className="rounded-2xl bg-white border border-slate-200/60 shadow-card overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-[15px] font-semibold text-dark-text">Subscription</h2>
          </div>
          <div className="p-6">
            {hasSubscription && stats ? (
              <div className="space-y-4">
                {[
                  { label: 'Plan', value: stats.current_plan },
                  { label: 'Status', value: <Badge variant="green" dot>Active</Badge> },
                  ...(stats.period_end ? [{ label: 'Next Billing', value: formatDate(stats.period_end) }] : []),
                  { label: 'Monthly', value: `$${stats.monthly_spend_usd.toFixed(2)}` },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between py-1">
                    <span className="text-sm text-slate-500">{row.label}</span>
                    <span className="text-sm font-semibold text-dark-text">{row.value}</span>
                  </div>
                ))}
                <div className="border-t border-slate-100 pt-4">
                  {cancelConfirm ? (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-600">
                        Are you sure? You'll lose plan benefits at the end of this billing period.
                      </p>
                      <div className="flex gap-2">
                        <Button variant="danger" size="sm" loading={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>
                          Confirm Cancel
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setCancelConfirm(false)}>
                          Keep Plan
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setCancelConfirm(true)} className="text-sm text-slate-400 hover:text-red-500 transition-colors">
                      Cancel subscription
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 border border-slate-200/60">
                  <XCircle className="h-7 w-7 text-slate-300" />
                </div>
                <p className="text-sm text-slate-500">No active subscription</p>
                <Button variant="outline" size="sm" onClick={() => navigate('/billing/pricing')}>
                  Subscribe to a Plan
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Invoices */}
      <motion.div variants={fadeUp} className="rounded-2xl bg-white border border-slate-200/60 shadow-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
              <Receipt className="h-4.5 w-4.5 text-slate-600" strokeWidth={1.8} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-dark-text">Recent Invoices</h2>
              {(invoiceData?.items?.length ?? 0) > 0 && (
                <p className="text-xs text-slate-400">{invoiceData?.total ?? 0} total</p>
              )}
            </div>
          </div>
        </div>

        {invoicesLoading ? (
          <div className="flex justify-center py-16"><Spinner size="md" /></div>
        ) : !invoiceData?.items?.length ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 border border-slate-200/60">
              <Receipt className="h-7 w-7 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-500">No invoices yet</p>
            <p className="text-xs text-slate-400 max-w-xs">Invoices will appear here once you submit cases or subscribe to a plan.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-50 bg-slate-50/50">
                    <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Invoice #</th>
                    <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Due Date</th>
                    <th className="px-6 py-3 w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {invoiceData.items.map((inv) => {
                    const badge = STATUS_BADGE[inv.status];
                    return (
                      <tr key={inv.id} className="group hover:bg-blue-50/30 transition-colors duration-150">
                        <td className="px-6 py-4 font-semibold text-dark-text">{inv.invoice_number}</td>
                        <td className="px-6 py-4 text-slate-500">{formatDate(inv.created_at)}</td>
                        <td className="px-6 py-4"><Badge variant={badge.variant} dot>{badge.label}</Badge></td>
                        <td className="px-6 py-4 text-right font-semibold text-dark-text">${inv.total_amount_usd.toFixed(2)}</td>
                        <td className="px-6 py-4 text-slate-500">{inv.due_date ? formatDate(inv.due_date) : '—'}</td>
                        <td className="px-6 py-4 text-right">
                          {inv.pdf_url && (
                            <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-electric hover:bg-blue-50 transition-colors">
                              <Download className="h-3 w-3" /> PDF
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="space-y-3 p-4 md:hidden">
              {invoiceData.items.map((inv) => {
                const badge = STATUS_BADGE[inv.status];
                return (
                  <div key={inv.id} className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-dark-text">{inv.invoice_number}</span>
                      <Badge variant={badge.variant} dot>{badge.label}</Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span>{formatDate(inv.created_at)}</span>
                      <span className="font-semibold text-dark-text">${inv.total_amount_usd.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
