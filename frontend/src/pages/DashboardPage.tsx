// DashboardPage.tsx — Premium dashboard with stats, recent cases, and quick actions.

import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FolderOpen, Clock, CheckCircle, DollarSign, Plus, ArrowRight,
  TrendingUp, TrendingDown, Sparkles, BarChart3,
  ArrowUpRight, Zap, FileText,

} from 'lucide-react';
import { useAuthStore } from '@/modules/auth';
import { caseService } from '@/modules/cases';
import { CaseStatusBadge } from '@/modules/cases';
import { ROUTES } from '@/constants';
import { formatDate } from '@/lib/utils';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
};

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

  const firstName = user?.full_name?.split(' ')[0] || 'User';
  const role = user?.role || 'DENTIST';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());

  // Stat cards — role-aware
  const BASE_STAT_CARDS = [
    {
      label: 'Total Cases',
      icon: FolderOpen,
      value: stats?.active_cases ?? 0,
      trend: '+12%',
      trendUp: true,
      gradient: 'from-blue-600 to-blue-400',
      bgGlow: 'bg-blue-500/10',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      trendColor: 'text-emerald-500',
      roles: ['DENTIST', 'SUPER_ADMIN', 'TECHNICIAN', 'LAB_MANAGER'],
    },
    {
      label: 'In Progress',
      icon: Clock,
      value: stats?.pending_review ?? 0,
      trend: '+5%',
      trendUp: true,
      gradient: 'from-amber-500 to-orange-400',
      bgGlow: 'bg-amber-500/10',
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-500',
      trendColor: 'text-emerald-500',
      roles: ['DENTIST', 'SUPER_ADMIN', 'TECHNICIAN', 'LAB_MANAGER'],
    },
    {
      label: 'Completed',
      icon: CheckCircle,
      value: stats?.completed ?? 0,
      trend: '+18%',
      trendUp: true,
      gradient: 'from-emerald-500 to-green-400',
      bgGlow: 'bg-emerald-500/10',
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-500',
      trendColor: 'text-emerald-500',
      roles: ['DENTIST', 'SUPER_ADMIN', 'TECHNICIAN', 'LAB_MANAGER'],
    },
    {
      label: 'Revenue',
      icon: DollarSign,
      value: `$${(stats?.total_revenue ?? 0).toLocaleString()}`,
      trend: '+24%',
      trendUp: true,
      gradient: 'from-violet-600 to-purple-400',
      bgGlow: 'bg-violet-500/10',
      iconBg: 'bg-violet-500/10',
      iconColor: 'text-violet-500',
      trendColor: 'text-emerald-500',
      roles: ['SUPER_ADMIN', 'LAB_MANAGER'],
    },
    {
      label: 'My Spend',
      icon: DollarSign,
      value: `$${(stats?.total_revenue ?? 0).toLocaleString()}`,
      trend: '',
      trendUp: true,
      gradient: 'from-violet-600 to-purple-400',
      bgGlow: 'bg-violet-500/10',
      iconBg: 'bg-violet-500/10',
      iconColor: 'text-violet-500',
      trendColor: 'text-emerald-500',
      roles: ['DENTIST'],
    },
  ];
  const STAT_CARDS = BASE_STAT_CARDS.filter((c) => c.roles.includes(role));

  // Quick actions — role-aware
  const ALL_QUICK_ACTIONS = [
    {
      label: 'New Case',
      desc: 'Start a new treatment case for a patient',
      icon: Plus,
      path: ROUTES.CASES_NEW,
      gradient: 'from-blue-600 to-cyan-500',
      iconBg: 'bg-white/20',
      roles: ['DENTIST', 'SUPER_ADMIN'],
    },
    {
      label: 'View Cases',
      desc: 'Browse and manage all cases',
      icon: BarChart3,
      path: ROUTES.CASES,
      gradient: 'from-slate-700 to-slate-600',
      iconBg: 'bg-white/15',
      roles: ['DENTIST', 'SUPER_ADMIN', 'TECHNICIAN', 'LAB_MANAGER'],
    },
    {
      label: 'AI Segmentation',
      desc: 'Run AI tooth segmentation on uploaded scans',
      icon: Sparkles,
      path: ROUTES.CASES,
      gradient: 'from-violet-600 to-purple-500',
      iconBg: 'bg-white/20',
      roles: ['TECHNICIAN', 'SUPER_ADMIN'],
    },
    {
      label: 'Manufacturing',
      desc: 'Track aligner production orders',
      icon: FolderOpen,
      path: ROUTES.MANUFACTURING,
      gradient: 'from-emerald-600 to-teal-500',
      iconBg: 'bg-white/20',
      roles: ['TECHNICIAN', 'LAB_MANAGER', 'SUPER_ADMIN'],
    },
    {
      label: 'Billing',
      desc: 'View invoices and manage your subscription',
      icon: DollarSign,
      path: ROUTES.BILLING,
      gradient: 'from-amber-500 to-orange-400',
      iconBg: 'bg-white/15',
      roles: ['DENTIST', 'SUPER_ADMIN'],
    },
  ];
  const QUICK_ACTIONS = ALL_QUICK_ACTIONS.filter((a) => a.roles.includes(role)).slice(0, 3);

  const cases = recentCases?.items || [];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* ── Welcome Header ── */}
      <motion.div variants={item} className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] p-8 sm:p-10">
        {/* Decorative grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />
        {/* Glow orbs */}
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-blue-500/20 blur-[100px]" />
        <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-violet-500/15 blur-[80px]" />
        <div className="absolute top-1/2 left-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/10 blur-[60px]" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-sm">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-medium text-slate-300 tracking-wide">{today}</span>
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
              {greeting}, <span className="bg-gradient-to-r from-blue-300 via-cyan-300 to-blue-300 bg-clip-text text-transparent">{firstName}</span>
            </h1>
            <p className="mt-2 text-[15px] text-slate-400 leading-relaxed max-w-lg">
              Your practice is performing well. Here is a summary of your activity and recent cases.
            </p>
          </div>
          <button
            onClick={() => navigate(ROUTES.CASES_NEW)}
            className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-lg shadow-white/10 hover:shadow-xl hover:shadow-white/20 hover:-translate-y-0.5 transition-all duration-300"
          >
            <Plus className="h-4 w-4" />
            New Case
          </button>
        </div>
      </motion.div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
        {STAT_CARDS.map((card) => (
          <motion.div
            key={card.label}
            variants={item}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-6 shadow-sm hover:shadow-lg hover:border-slate-300/80 transition-all duration-300"
          >
            {/* Subtle corner glow on hover */}
            <div className={`absolute -top-8 -right-8 h-24 w-24 rounded-full ${card.bgGlow} blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg} transition-transform duration-300 group-hover:scale-110`}>
                  <card.icon className={`h-5 w-5 ${card.iconColor}`} strokeWidth={1.8} />
                </div>
                <div className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${card.trendColor} bg-emerald-50`}>
                  {card.trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {card.trend}
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{card.value}</p>
              <p className="mt-1 text-[13px] font-medium text-slate-500">{card.label}</p>
            </div>

            {/* Bottom accent line */}
            <div className={`absolute bottom-0 left-0 h-[3px] w-full bg-gradient-to-r ${card.gradient} opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-full group-hover:translate-y-0`} />
          </motion.div>
        ))}
      </div>

      {/* ── Main Content Grid ── */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent Cases — takes 3 cols */}
        <motion.div variants={item} className="lg:col-span-3 rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                <FileText className="h-4.5 w-4.5 text-slate-600" strokeWidth={1.8} />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900">Recent Cases</h2>
                <p className="text-xs text-slate-400">Latest patient cases</p>
              </div>
            </div>
            <button
              onClick={() => navigate(ROUTES.CASES)}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all duration-200"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {cases.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100">
                <FolderOpen className="h-7 w-7 text-slate-300" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-semibold text-slate-600 mb-1">No cases yet</p>
              <p className="text-[13px] text-slate-400 mb-5 max-w-xs mx-auto">Create your first case to start managing treatments.</p>
              <button
                onClick={() => navigate(ROUTES.CASES_NEW)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors duration-200"
              >
                <Plus className="h-4 w-4" /> Create Case
              </button>
            </div>
          ) : (
            <div>
              {cases.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(ROUTES.CASE_DETAIL(c.id))}
                  className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-slate-50/70 transition-colors duration-150 group border-b border-slate-50 last:border-0"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 text-xs font-bold text-slate-500 border border-slate-200/60 shrink-0 group-hover:border-slate-300 transition-colors">
                      {c.case_number.slice(-3)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">{c.case_number}</p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {c.treatment_type.replace(/_/g, ' ')} &middot; {formatDate(c.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <CaseStatusBadge status={c.status} />
                    <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* Right Column — Quick Actions + AI Card — takes 2 cols */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          <motion.div variants={item} className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Zap className="h-4 w-4 text-amber-500" />
              <h2 className="text-[15px] font-semibold text-slate-900">Quick Actions</h2>
            </div>
            <div className="space-y-3">
              {QUICK_ACTIONS.map((action) => (
                <motion.button
                  key={action.label}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => navigate(action.path)}
                  className={`flex w-full items-center gap-4 rounded-xl bg-gradient-to-r ${action.gradient} p-4 text-left text-white shadow-sm hover:shadow-md transition-shadow duration-300`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${action.iconBg} shrink-0`}>
                    <action.icon className="h-5 w-5" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight">{action.label}</p>
                    <p className="text-[11px] text-white/70 mt-0.5 leading-snug truncate">{action.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 ml-auto shrink-0 opacity-60" />
                </motion.button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
