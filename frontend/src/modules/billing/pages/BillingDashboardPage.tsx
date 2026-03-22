// BillingDashboardPage.tsx — Billing overview with plan usage, spend, and invoices.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  CreditCard,
  Receipt,
  TrendingUp,
  Package,
  ExternalLink,
  AlertCircle,
  ChevronRight,
  Download,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
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

export function BillingDashboardPage() {
  const navigate = useNavigate();
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['billing-stats'],
    queryFn: billingService.getStats,
  });

  const { data: invoiceData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: () => billingService.getInvoices(),
  });

  const portalMutation = useMutation({
    mutationFn: billingService.createPortalSession,
    onSuccess: (url) => {
      window.location.href = url;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: billingService.cancelSubscription,
    onSuccess: () => {
      setCancelConfirm(false);
      window.location.reload();
    },
  });

  if (statsLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const hasSubscription = stats?.subscription_status === 'active';
  const usagePercent = stats && stats.cases_included > 0
    ? Math.min(100, Math.round((stats.cases_used / stats.cases_included) * 100))
    : 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-dark-text">Billing</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/billing/pricing')}>
            <Package className="mr-2 h-4 w-4" />
            View Plans
          </Button>
          {hasSubscription && (
            <Button
              variant="outline"
              loading={portalMutation.isPending}
              onClick={() => portalMutation.mutate()}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Manage Payment
              <ExternalLink className="ml-1.5 h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Current Plan */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Package className="h-5 w-5 text-electric" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Current Plan</p>
                <p className="text-lg font-semibold text-dark-text">{stats?.current_plan ?? 'Pay Per Case'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Spend */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <TrendingUp className="h-5 w-5 text-mint" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">This Month</p>
                <p className="text-lg font-semibold text-dark-text">
                  ${stats?.monthly_spend_usd?.toFixed(2) ?? '0.00'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Spent */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <CreditCard className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Total Spent</p>
                <p className="text-lg font-semibold text-dark-text">
                  ${stats?.total_spent_usd?.toFixed(2) ?? '0.00'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Invoices */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                (stats?.pending_invoices ?? 0) > 0 ? 'bg-amber-100' : 'bg-gray-100',
              )}>
                <Receipt className={cn(
                  'h-5 w-5',
                  (stats?.pending_invoices ?? 0) > 0 ? 'text-amber-600' : 'text-gray-500',
                )} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Pending</p>
                <p className="text-lg font-semibold text-dark-text">{stats?.pending_invoices ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan Usage + Subscription */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Usage Card */}
        <Card>
          <CardHeader>
            <CardTitle>Plan Usage</CardTitle>
          </CardHeader>
          <CardContent>
            {hasSubscription && stats ? (
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-dark-text">{stats.cases_used}</span>
                  <span className="text-sm text-gray-500">
                    of {stats.cases_included} cases included
                  </span>
                </div>
                <div className="mb-3 h-3 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-amber-500' : 'bg-electric',
                    )}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{usagePercent}% used</span>
                  {stats.period_end && (
                    <span>Resets {formatDate(stats.period_end)}</span>
                  )}
                </div>
                {usagePercent >= 90 && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>
                      You are nearing your plan limit. Additional cases are billed at the overage rate.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <div className="mb-3 flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-blue-50">
                  <Package className="h-8 w-8 text-electric" />
                </div>
                <p className="mb-1 font-medium text-dark-text">Pay Per Case</p>
                <p className="mb-4 text-sm text-gray-500">
                  You are currently paying per case. Subscribe to a plan to save on volume.
                </p>
                <Button variant="primary" onClick={() => navigate('/billing/pricing')}>
                  View Pricing Plans
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscription Details */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            {hasSubscription && stats ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Plan</span>
                  <span className="font-medium text-dark-text">{stats.current_plan}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Status</span>
                  <Badge variant="green">Active</Badge>
                </div>
                {stats.period_end && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Next Billing</span>
                    <span className="text-sm text-dark-text">{formatDate(stats.period_end)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Monthly Spend</span>
                  <span className="text-sm font-medium text-dark-text">
                    ${stats.monthly_spend_usd.toFixed(2)}
                  </span>
                </div>
                <div className="border-t border-gray-100 pt-4">
                  {cancelConfirm ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">
                        Are you sure? You will lose access to your plan benefits at the end of the
                        current billing period.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="danger"
                          size="sm"
                          loading={cancelMutation.isPending}
                          onClick={() => cancelMutation.mutate()}
                        >
                          Confirm Cancel
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCancelConfirm(false)}
                        >
                          Keep Plan
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setCancelConfirm(true)}
                      className="text-sm text-gray-400 underline transition-colors hover:text-red-500"
                    >
                      Cancel subscription
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <XCircle className="h-10 w-10 text-gray-300" />
                <p className="text-sm text-gray-500">No active subscription</p>
                <Button variant="outline" size="sm" onClick={() => navigate('/billing/pricing')}>
                  Subscribe to a Plan
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Invoices</CardTitle>
            {(invoiceData?.items?.length ?? 0) > 0 && (
              <span className="text-xs text-gray-500">
                {invoiceData?.total ?? 0} total
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <div className="flex justify-center py-10">
              <Spinner size="md" />
            </div>
          ) : !invoiceData?.items?.length ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Receipt className="h-10 w-10 text-gray-300" />
              <p className="text-sm text-gray-500">No invoices yet</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden overflow-hidden rounded-lg border border-gray-100 md:block">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100 bg-soft-gray/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Invoice #</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Due Date</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoiceData.items.map((inv) => {
                      const badge = STATUS_BADGE[inv.status];
                      return (
                        <tr key={inv.id} className="transition-colors hover:bg-blue-50/30">
                          <td className="px-4 py-3 font-medium text-dark-text">
                            {inv.invoice_number}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {formatDate(inv.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-dark-text">
                            ${inv.total_amount_usd.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {inv.due_date ? formatDate(inv.due_date) : '--'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {inv.pdf_url && (
                              <a
                                href={inv.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-electric hover:underline"
                              >
                                <Download className="h-3 w-3" />
                                PDF
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
              <div className="space-y-3 md:hidden">
                {invoiceData.items.map((inv) => {
                  const badge = STATUS_BADGE[inv.status];
                  return (
                    <div
                      key={inv.id}
                      className="rounded-lg border border-gray-200 bg-white p-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-dark-text">{inv.invoice_number}</span>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                        <span>{formatDate(inv.created_at)}</span>
                        <span className="font-medium text-dark-text">
                          ${inv.total_amount_usd.toFixed(2)}
                        </span>
                      </div>
                      {inv.pdf_url && (
                        <a
                          href={inv.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs text-electric hover:underline"
                        >
                          <Download className="h-3 w-3" />
                          Download PDF
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
