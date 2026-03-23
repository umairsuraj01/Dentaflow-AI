// PricingPage.tsx — Premium pricing page with plan comparison.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Check, ArrowLeft, Star, Zap, Building2, CreditCard,
  Sparkles, Shield, Clock, Headphones, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import { billingService } from '../services/billing.service';
import type { PricingPlan } from '../types/billing.types';

const PLAN_META: Record<string, { icon: typeof Star; gradient: string; ring: string; popular?: boolean }> = {
  'pay-per-case': { icon: CreditCard, gradient: 'from-slate-500 to-slate-600', ring: 'ring-slate-200' },
  starter: { icon: Zap, gradient: 'from-blue-500 to-blue-600', ring: 'ring-blue-200' },
  professional: { icon: Star, gradient: 'from-violet-500 to-purple-600', ring: 'ring-violet-300', popular: true },
  enterprise: { icon: Building2, gradient: 'from-amber-500 to-orange-600', ring: 'ring-amber-200' },
};

const FALLBACK_PLANS: PricingPlan[] = [
  {
    id: 'f-1', name: 'Pay Per Case', slug: 'pay-per-case',
    monthly_fee_usd: 0, price_per_case_usd: 35, included_cases_per_month: 0, overage_per_case_usd: 35,
    features: ['No monthly commitment', 'Full AI segmentation', 'Treatment planning', 'STL export', 'Email support'],
    turnaround_days: 5, sort_order: 0,
  },
  {
    id: 'f-2', name: 'Starter', slug: 'starter',
    monthly_fee_usd: 199, price_per_case_usd: null, included_cases_per_month: 10, overage_per_case_usd: 25,
    features: ['10 cases / month included', 'Full AI segmentation', 'Treatment planning', 'STL export', 'Priority support', '3-day turnaround'],
    turnaround_days: 3, sort_order: 1,
  },
  {
    id: 'f-3', name: 'Professional', slug: 'professional',
    monthly_fee_usd: 399, price_per_case_usd: null, included_cases_per_month: 25, overage_per_case_usd: 20,
    features: ['25 cases / month included', 'Full AI segmentation', 'Advanced treatment planning', 'STL export & staging', 'Phone & email support', '2-day turnaround', 'Clinical summary reports'],
    turnaround_days: 2, sort_order: 2,
  },
  {
    id: 'f-4', name: 'Enterprise', slug: 'enterprise',
    monthly_fee_usd: 799, price_per_case_usd: null, included_cases_per_month: 75, overage_per_case_usd: 15,
    features: ['75 cases / month included', 'Full AI segmentation', 'Advanced treatment planning', 'STL export & staging', 'Dedicated account manager', '1-day turnaround', 'Clinical reports', 'API access', 'Custom integrations'],
    turnaround_days: 1, sort_order: 3,
  },
];

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } };
const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } } };

export function PricingPage() {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const { data: plans, isLoading } = useQuery({ queryKey: ['billing-plans'], queryFn: billingService.getPlans });
  const { data: stats } = useQuery({ queryKey: ['billing-stats'], queryFn: billingService.getStats });

  const subscribeMutation = useMutation({
    mutationFn: (slug: string) => billingService.subscribe(slug),
    onSuccess: (url) => { window.location.href = url; },
  });

  const displayPlans = (plans && plans.length > 0 ? plans : FALLBACK_PLANS).sort((a, b) => a.sort_order - b.sort_order);

  if (isLoading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="max-w-6xl mx-auto">
      {/* Header */}
      <motion.div variants={fadeUp} className="text-center mb-12">
        <button
          onClick={() => navigate('/billing')}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Billing
        </button>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-dark-text tracking-tight">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-[15px] text-slate-500 max-w-xl mx-auto leading-relaxed">
          Choose the plan that fits your practice. All plans include AI-powered tooth segmentation,
          treatment planning, and manufacturing support.
        </p>

        {/* Billing toggle */}
        <div className="mt-8 inline-flex items-center gap-1 rounded-full bg-slate-100 p-1">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={cn(
              'rounded-full px-5 py-2 text-sm font-medium transition-all duration-200',
              billingCycle === 'monthly' ? 'bg-white text-dark-text shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={cn(
              'rounded-full px-5 py-2 text-sm font-medium transition-all duration-200',
              billingCycle === 'yearly' ? 'bg-white text-dark-text shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            Yearly <span className="ml-1 text-xs font-semibold text-emerald-600">Save 20%</span>
          </button>
        </div>
      </motion.div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {displayPlans.map((plan) => {
          const meta = PLAN_META[plan.slug] ?? { icon: Star, gradient: 'from-slate-500 to-slate-600', ring: 'ring-slate-200' };
          const Icon = meta.icon;
          const isPopular = meta.popular === true;
          const isCurrentPlan = stats?.plan_slug === plan.slug;
          const isPayPerCase = plan.slug === 'pay-per-case';
          const price = billingCycle === 'yearly' && !isPayPerCase
            ? Math.round(plan.monthly_fee_usd * 0.8)
            : plan.monthly_fee_usd;

          return (
            <motion.div
              key={plan.id}
              variants={fadeUp}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className={cn(
                'relative flex flex-col rounded-2xl border bg-white shadow-card transition-all duration-300 hover:shadow-card-hover overflow-hidden',
                isPopular ? 'border-violet-300 ring-2 ring-violet-100' : 'border-slate-200/60',
              )}
            >
              {/* Popular ribbon */}
              {isPopular && (
                <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2 text-center">
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider">Most Popular</span>
                </div>
              )}

              <div className="flex flex-1 flex-col p-6">
                {/* Icon + Name */}
                <div className="mb-5">
                  <div className={cn('inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm mb-3', meta.gradient)}>
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </div>
                  <h3 className="text-lg font-bold text-dark-text">{plan.name}</h3>
                </div>

                {/* Price */}
                <div className="mb-5">
                  {isPayPerCase ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-dark-text">${plan.price_per_case_usd}</span>
                      <span className="text-sm font-medium text-slate-500">/ case</span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold text-dark-text">${price}</span>
                        <span className="text-sm font-medium text-slate-500">/ mo</span>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-400">
                        {plan.included_cases_per_month} cases included
                        <span className="mx-1.5 text-slate-300">&middot;</span>
                        ${plan.overage_per_case_usd}/extra
                      </p>
                    </div>
                  )}
                </div>

                {/* Turnaround badge */}
                <div className="mb-5 inline-flex items-center gap-1.5 self-start rounded-full bg-slate-50 border border-slate-200/60 px-3 py-1">
                  <Clock className="h-3 w-3 text-slate-400" />
                  <span className="text-[11px] font-semibold text-slate-500">
                    {plan.turnaround_days === 1 ? 'Next-day' : `${plan.turnaround_days}-day`} turnaround
                  </span>
                </div>

                {/* Features */}
                <ul className="mb-6 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-[13px] text-slate-600">
                      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                        <Check className="h-2.5 w-2.5 text-emerald-600" strokeWidth={3} />
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="mt-auto">
                  {isCurrentPlan ? (
                    <Button variant="outline" className="w-full rounded-xl" disabled>
                      Current Plan
                    </Button>
                  ) : isPayPerCase ? (
                    <Button variant="outline" className="w-full rounded-xl" onClick={() => navigate('/cases/new')}>
                      Get Started <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  ) : plan.slug === 'enterprise' ? (
                    <Button variant="outline" className="w-full rounded-xl" onClick={() => window.location.href = 'mailto:sales@dentaflow.ai'}>
                      Contact Sales
                    </Button>
                  ) : (
                    <Button
                      variant={isPopular ? 'gradient' : 'primary'}
                      className={cn('w-full rounded-xl', isPopular && 'shadow-button hover:shadow-glow-purple')}
                      loading={subscribeMutation.isPending && subscribeMutation.variables === plan.slug}
                      onClick={() => subscribeMutation.mutate(plan.slug)}
                    >
                      Subscribe <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Trust section */}
      <motion.div variants={fadeUp} className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { icon: Sparkles, label: 'AI-Powered', desc: 'MeshSegNet deep learning' },
          { icon: Shield, label: 'HIPAA Ready', desc: 'Enterprise-grade security' },
          { icon: Headphones, label: 'Expert Support', desc: 'Dental professionals on staff' },
          { icon: Clock, label: 'Fast Results', desc: 'Same-day processing available' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3 rounded-xl bg-white border border-slate-200/60 p-4 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50">
              <item.icon className="h-5 w-5 text-slate-500" strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-sm font-semibold text-dark-text">{item.label}</p>
              <p className="text-[11px] text-slate-400">{item.desc}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* FAQ */}
      <motion.div variants={fadeUp} className="mt-12 rounded-2xl bg-white border border-slate-200/60 p-8 shadow-card">
        <h2 className="text-lg font-bold text-dark-text mb-6 text-center">Frequently Asked Questions</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {[
            { q: 'What happens if I exceed my case limit?', a: 'Additional cases are billed at your plan\'s overage rate. You\'re never blocked from submitting.' },
            { q: 'Can I change plans at any time?', a: 'Yes. Upgrades take effect immediately with a prorated credit. Downgrades apply at the end of your billing period.' },
            { q: 'How does billing work?', a: 'Subscriptions are billed monthly via Stripe. Pay-per-case charges are invoiced upon case submission.' },
            { q: 'Is there a free trial?', a: 'New accounts start on Pay Per Case with no commitment. Submit your first case to experience the full AI pipeline.' },
          ].map((faq) => (
            <div key={faq.q}>
              <p className="text-sm font-semibold text-dark-text mb-1.5">{faq.q}</p>
              <p className="text-[13px] text-slate-500 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
