// PricingPage.tsx — Pricing plans with subscribe-to-Stripe flow.

import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Check, ArrowLeft, Star, Zap, Building2, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import { billingService } from '../services/billing.service';
import type { PricingPlan } from '../types/billing.types';

const PLAN_META: Record<string, { icon: typeof Star; color: string; popular?: boolean }> = {
  'pay-per-case': { icon: CreditCard, color: 'text-gray-600' },
  starter: { icon: Zap, color: 'text-blue-600' },
  professional: { icon: Star, color: 'text-electric', popular: true },
  enterprise: { icon: Building2, color: 'text-purple-600' },
};

const FALLBACK_PLANS: PricingPlan[] = [
  {
    id: 'f-1',
    name: 'Pay Per Case',
    slug: 'pay-per-case',
    monthly_fee_usd: 0,
    price_per_case_usd: 35,
    included_cases_per_month: 0,
    overage_per_case_usd: 35,
    features: [
      'No monthly commitment',
      'Full AI segmentation',
      'Treatment planning',
      'STL export',
      'Email support',
    ],
    turnaround_days: 5,
    sort_order: 0,
  },
  {
    id: 'f-2',
    name: 'Starter',
    slug: 'starter',
    monthly_fee_usd: 199,
    price_per_case_usd: null,
    included_cases_per_month: 10,
    overage_per_case_usd: 25,
    features: [
      '10 cases per month included',
      'Full AI segmentation',
      'Treatment planning',
      'STL export',
      'Priority email support',
      '3-day turnaround',
    ],
    turnaround_days: 3,
    sort_order: 1,
  },
  {
    id: 'f-3',
    name: 'Professional',
    slug: 'professional',
    monthly_fee_usd: 399,
    price_per_case_usd: null,
    included_cases_per_month: 25,
    overage_per_case_usd: 20,
    features: [
      '25 cases per month included',
      'Full AI segmentation',
      'Advanced treatment planning',
      'STL export & staging',
      'Phone & email support',
      '2-day turnaround',
      'Clinical summary reports',
    ],
    turnaround_days: 2,
    sort_order: 2,
  },
  {
    id: 'f-4',
    name: 'Enterprise',
    slug: 'enterprise',
    monthly_fee_usd: 799,
    price_per_case_usd: null,
    included_cases_per_month: 75,
    overage_per_case_usd: 15,
    features: [
      '75 cases per month included',
      'Full AI segmentation',
      'Advanced treatment planning',
      'STL export & staging',
      'Dedicated account manager',
      '1-day turnaround',
      'Clinical summary reports',
      'API access',
      'Custom integrations',
    ],
    turnaround_days: 1,
    sort_order: 3,
  },
];

export function PricingPage() {
  const navigate = useNavigate();

  const { data: plans, isLoading } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: billingService.getPlans,
  });

  const { data: stats } = useQuery({
    queryKey: ['billing-stats'],
    queryFn: billingService.getStats,
  });

  const subscribeMutation = useMutation({
    mutationFn: (slug: string) => billingService.subscribe(slug),
    onSuccess: (url) => {
      window.location.href = url;
    },
  });

  const displayPlans = (plans && plans.length > 0 ? plans : FALLBACK_PLANS).sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/billing')}
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-dark-text"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Billing
        </button>
        <h1 className="text-2xl font-bold text-dark-text">Choose Your Plan</h1>
        <p className="mt-1 text-sm text-gray-500">
          Select a plan that fits your practice. All plans include full AI-powered tooth
          segmentation and treatment planning.
        </p>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {displayPlans.map((plan) => {
          const meta = PLAN_META[plan.slug] ?? { icon: Star, color: 'text-gray-600' };
          const Icon = meta.icon;
          const isPopular = meta.popular === true;
          const isCurrentPlan = stats?.plan_slug === plan.slug;
          const isPayPerCase = plan.slug === 'pay-per-case';

          return (
            <div
              key={plan.id}
              className={cn(
                'relative flex flex-col rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md',
                isPopular
                  ? 'border-electric ring-2 ring-electric/20'
                  : 'border-gray-200',
              )}
            >
              {/* Popular Badge */}
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="blue" className="px-3 py-1 text-xs font-semibold shadow-sm">
                    Most Popular
                  </Badge>
                </div>
              )}

              <div className="flex flex-1 flex-col p-6">
                {/* Plan Header */}
                <div className="mb-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg',
                        isPopular ? 'bg-blue-100' : 'bg-gray-100',
                      )}
                    >
                      <Icon className={cn('h-5 w-5', meta.color)} />
                    </div>
                    <h3 className="text-lg font-semibold text-dark-text">{plan.name}</h3>
                  </div>

                  {/* Price */}
                  <div className="mb-1">
                    {isPayPerCase ? (
                      <div>
                        <span className="text-3xl font-bold text-dark-text">
                          ${plan.price_per_case_usd}
                        </span>
                        <span className="text-sm text-gray-500"> / case</span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-3xl font-bold text-dark-text">
                          ${plan.monthly_fee_usd}
                        </span>
                        <span className="text-sm text-gray-500"> / month</span>
                      </div>
                    )}
                  </div>

                  {!isPayPerCase && (
                    <p className="text-xs text-gray-500">
                      {plan.included_cases_per_month} cases included &middot; ${plan.overage_per_case_usd}/case overage
                    </p>
                  )}

                  <p className="mt-1 text-xs text-gray-400">
                    {plan.turnaround_days}-day turnaround
                  </p>
                </div>

                {/* Features */}
                <ul className="mb-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-mint" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <div className="mt-auto">
                  {isCurrentPlan ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : isPayPerCase ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate('/cases/new')}
                    >
                      Get Started
                    </Button>
                  ) : plan.slug === 'enterprise' ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => window.location.href = 'mailto:sales@dentaflow.ai'}
                    >
                      Contact Sales
                    </Button>
                  ) : (
                    <Button
                      variant={isPopular ? 'primary' : 'outline'}
                      className="w-full"
                      loading={subscribeMutation.isPending && subscribeMutation.variables === plan.slug}
                      onClick={() => subscribeMutation.mutate(plan.slug)}
                    >
                      Subscribe
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FAQ / Note */}
      <div className="mt-10 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-3 text-base font-semibold text-dark-text">Frequently Asked Questions</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-dark-text">What happens if I exceed my case limit?</p>
            <p className="mt-1 text-sm text-gray-500">
              Additional cases are billed at your plan's overage rate. You will never be blocked from
              submitting cases.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-dark-text">Can I change plans at any time?</p>
            <p className="mt-1 text-sm text-gray-500">
              Yes. Upgrades take effect immediately with a prorated credit. Downgrades apply at the
              end of your current billing period.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-dark-text">How does billing work?</p>
            <p className="mt-1 text-sm text-gray-500">
              Subscriptions are billed monthly via Stripe. Pay-per-case charges are invoiced
              upon case submission.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-dark-text">Is there a free trial?</p>
            <p className="mt-1 text-sm text-gray-500">
              New accounts start on Pay Per Case with no commitment. Submit your first case to
              experience the full AI pipeline.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
