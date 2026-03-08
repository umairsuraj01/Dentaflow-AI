// CasePriorityBadge.tsx — Priority badge with pulse animation for RUSH.

import { cn } from '@/lib/utils';
import type { CasePriority } from '../types/case.types';

const PRIORITY_STYLES: Record<CasePriority, string> = {
  NORMAL: 'bg-gray-100 text-gray-600',
  URGENT: 'bg-amber-100 text-amber-700',
  RUSH: 'bg-red-100 text-red-700 animate-pulse',
};

interface CasePriorityBadgeProps {
  priority: CasePriority;
}

export function CasePriorityBadge({ priority }: CasePriorityBadgeProps) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', PRIORITY_STYLES[priority])}>
      {priority}
    </span>
  );
}
