// OrderStatusBadge.tsx — Colored badge for manufacturing order status.

import { cn } from '@/lib/utils';
import type { OrderStatus } from '../types/manufacturing.types';

const STATUS_CONFIG: Record<OrderStatus, { label: string; bg: string; text: string; dot: string }> = {
  NEW: { label: 'New', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  SHIPPED: { label: 'Shipped', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.NEW;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ring-current/10', cfg.bg, cfg.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
}
