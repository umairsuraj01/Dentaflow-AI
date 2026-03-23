// OrderTypeBadge.tsx — Badge for order type (Default/Replacement).

import { cn } from '@/lib/utils';

export function OrderTypeBadge({ type }: { type: string }) {
  const isReplacement = type === 'REPLACEMENT';
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
      isReplacement
        ? 'bg-red-50 text-red-600 ring-1 ring-inset ring-red-500/10'
        : 'bg-slate-100 text-slate-500',
    )}>
      {type}
    </span>
  );
}
