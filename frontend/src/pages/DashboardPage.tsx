// DashboardPage.tsx — Rich dashboard with stats, recent cases, and quick actions.

import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FolderOpen, Clock, CheckCircle, DollarSign, Plus, ArrowRight,
  TrendingUp, Calendar, Activity, Sparkles,
} from 'lucide-react';
import { useAuthStore } from '@/modules/auth';
import { caseService } from '@/modules/cases';
import { CaseStatusBadge } from '@/modules/cases';
import { ROUTES } from '@/constants';
import { formatDate } from '@/lib/utils';

export function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => caseService.getDashboardStats(),
  });

  const { data: recentCases } = useQuery({
    queryKey: ['recent-cases'],
    queryFn: () => caseService.list({ page: 1, per_page: 5 }),
  });

  const firstName = user?.full_name?.split(' ')[0] || 'Doctor';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const STAT_CARDS = [
    { label: 'Active Cases', icon: FolderOpen, gradient: 'from-blue-500 to-cyan-400', bg: 'bg-gradient-to-br from-blue-50 to-cyan-50', iconColor: 'text-blue-600', value: stats?.active_cases ?? 0 },
    { label: 'Pending Review', icon: Clock, gradient: 'from-amber-500 to-orange-400', bg: 'bg-gradient-to-br from-amber-50 to-orange-50', iconColor: 'text-amber-600', value: stats?.pending_review ?? 0 },
    { label: 'Completed', icon: CheckCircle, gradient: 'from-emerald-500 to-green-400', bg: 'bg-gradient-to-br from-emerald-50 to-green-50', iconColor: 'text-emerald-600', value: stats?.completed ?? 0 },
    { label: 'Revenue', icon: DollarSign, gradient: 'from-violet-500 to-purple-400', bg: 'bg-gradient-to-br from-violet-50 to-purple-50', iconColor: 'text-violet-600', value: `$${(stats?.total_revenue ?? 0).toLocaleString()}` },
  ];

  const QUICK_ACTIONS = [
    { label: 'New Case', desc: 'Create a treatment case', icon: Plus, path: ROUTES.CASES_NEW, primary: true },
    { label: 'View Cases', desc: 'Browse all cases', icon: FolderOpen, path: ROUTES.CASES, primary: false },
    { label: 'Billing', desc: 'Invoices & payments', icon: DollarSign, path: ROUTES.BILLING, primary: false },
  ];

  const cases = recentCases?.items || [];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl mesh-bg p-6 sm:p-8"
      >
        {/* Animated orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-4 right-12 h-40 w-40 rounded-full bg-electric/20 blur-[80px] animate-float" />
          <div className="absolute bottom-4 left-16 h-32 w-32 rounded-full bg-mint/15 blur-[60px] animate-float-delayed" />
          <div className="absolute top-1/2 right-1/3 h-24 w-24 rounded-full bg-purple-500/10 blur-[50px]" />
        </div>
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Dashboard</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {greeting}, <span className="bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">{firstName}</span>
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Here's an overview of your practice today.
          </p>
        </div>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STAT_CARDS.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-card border border-slate-200/60 hover:shadow-card-hover transition-all duration-300"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{card.label}</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-dark-text tracking-tight">{card.value}</p>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.bg}`}>
                <card.icon className={`h-5 w-5 ${card.iconColor}`} />
              </div>
            </div>
            <div className={`absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r ${card.gradient} opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-full group-hover:translate-y-0`} />
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Cases */}
        <div className="lg:col-span-2 rounded-2xl bg-white shadow-card border border-slate-200/60">
          <div className="flex items-center justify-between p-5 pb-3">
            <h2 className="text-base font-semibold text-dark-text flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              Recent Cases
            </h2>
            <button
              onClick={() => navigate(ROUTES.CASES)}
              className="flex items-center gap-1 text-xs font-semibold text-electric hover:text-blue-700 transition-colors"
            >
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {cases.length === 0 ? (
            <div className="px-5 pb-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100">
                <FolderOpen className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-500 mb-1">No cases yet</p>
              <p className="text-xs text-slate-400 mb-4">Create your first case to get started</p>
              <button
                onClick={() => navigate(ROUTES.CASES_NEW)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-electric to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-electric/25 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
              >
                <Plus className="h-4 w-4" /> Create your first case
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {cases.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(ROUTES.CASE_DETAIL(c.id))}
                  className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 text-xs font-bold text-slate-500 border border-slate-200/60">
                      {c.case_number.slice(-3)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-dark-text truncate">{c.case_number}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {c.treatment_type.replace(/_/g, ' ')} · {formatDate(c.created_at)}
                      </p>
                    </div>
                  </div>
                  <CaseStatusBadge status={c.status} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions + AI Feature */}
        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-5 shadow-card border border-slate-200/60">
            <h2 className="text-base font-semibold text-dark-text mb-4">Quick Actions</h2>
            <div className="space-y-2.5">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => navigate(action.path)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all duration-200 ${
                    action.primary
                      ? 'bg-gradient-to-r from-electric to-cyan-500 text-white shadow-md shadow-electric/20 hover:shadow-lg hover:-translate-y-0.5'
                      : 'bg-white text-dark-text border border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <action.icon className="h-4.5 w-4.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">{action.label}</p>
                    <p className={`text-[11px] ${action.primary ? 'text-blue-100' : 'text-slate-500'}`}>{action.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* AI Highlight Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-electric via-blue-600 to-blue-700 p-5 text-white">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-white/10 blur-[40px] -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-cyan-400/20 blur-[30px] translate-y-1/2 -translate-x-1/2" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h3 className="font-bold">AI-Powered</h3>
              </div>
              <p className="text-sm text-blue-100 leading-relaxed mb-4">
                Upload STL scans and let our AI automatically segment teeth, plan treatments, and detect collisions.
              </p>
              <button
                onClick={() => navigate(ROUTES.CASES_NEW)}
                className="flex items-center gap-1.5 rounded-xl bg-white/20 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/30 transition-all duration-200"
              >
                <TrendingUp className="h-4 w-4" /> Try it now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
