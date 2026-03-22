// Button.tsx — Reusable button component with variants.

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'bg-electric text-white hover:bg-blue-600 shadow-md shadow-electric/25 hover:shadow-lg hover:shadow-electric/30 hover:-translate-y-0.5',
        secondary: 'bg-soft-gray text-dark-text hover:bg-gray-200 shadow-sm',
        outline: 'border-2 border-gray-200 bg-white text-dark-text hover:border-electric hover:text-electric hover:bg-blue-50/50',
        ghost: 'text-dark-text hover:bg-soft-gray',
        danger: 'bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-500/25 hover:shadow-lg hover:-translate-y-0.5',
        mint: 'bg-mint text-white hover:bg-emerald-600 shadow-md shadow-mint/25 hover:shadow-lg hover:-translate-y-0.5',
        gradient: 'bg-gradient-to-r from-electric to-cyan-500 text-white shadow-md shadow-electric/25 hover:shadow-lg hover:shadow-electric/30 hover:-translate-y-0.5',
      },
      size: {
        sm: 'h-8 px-3.5 text-xs gap-1.5',
        md: 'h-10 px-5 text-sm gap-2',
        lg: 'h-12 px-7 text-base gap-2',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';

export { Button, buttonVariants };
