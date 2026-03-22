// Badge.tsx — Status badge with color variants.

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-slate-100 text-slate-600',
        blue: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/10',
        green: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10',
        red: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10',
        orange: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10',
        purple: 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/10',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  className?: string;
  children: React.ReactNode;
  dot?: boolean;
}

export function Badge({ variant, className, children, dot }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)}>
      {dot && (
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      )}
      {children}
    </span>
  );
}
