// CaseStatusBadge.tsx — Colored status pill for case status.

import { Badge } from '@/components/ui/Badge';
import type { CaseStatus } from '../types/case.types';

const STATUS_CONFIG: Record<CaseStatus, { label: string; variant: 'default' | 'blue' | 'green' | 'red' | 'orange' | 'purple' }> = {
  DRAFT: { label: 'Draft', variant: 'default' },
  SUBMITTED: { label: 'Submitted', variant: 'blue' },
  ASSIGNED: { label: 'Assigned', variant: 'blue' },
  IN_PROGRESS: { label: 'In Progress', variant: 'orange' },
  REVIEW: { label: 'Review', variant: 'purple' },
  REVISION_REQUESTED: { label: 'Revision', variant: 'orange' },
  APPROVED: { label: 'Approved', variant: 'green' },
  COMPLETED: { label: 'Completed', variant: 'green' },
  CANCELLED: { label: 'Cancelled', variant: 'red' },
};

interface CaseStatusBadgeProps {
  status: CaseStatus;
}

export function CaseStatusBadge({ status }: CaseStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
