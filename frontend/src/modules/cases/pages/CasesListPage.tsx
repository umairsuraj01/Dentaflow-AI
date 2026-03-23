// CasesListPage.tsx — Premium cases list with status tabs, search, and card/table views.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Search, FolderOpen, Calendar, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ROUTES } from '@/constants';
import { cn, formatDate } from '@/lib/utils';
import { useCases } from '../hooks/useCases';
import { CaseStatusBadge } from '../components/CaseStatusBadge';
import { CasePriorityBadge } from '../components/CasePriorityBadge';

const TABS: { label: string; value: string | undefined; count?: number }[] = [
  { label: 'All', value: undefined },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Review', value: 'REVIEW' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Completed', value: 'COMPLETED' },
];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

export function CasesListPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 20;

  const { cases, total, totalPages, isLoading } = useCases({
    status: activeTab, search: search || undefined, page, per_page: perPage,
  });

  return (
    <div className="space-y-6">
      {/* ============================================================ */}
      {/*  PAGE HEADER                                                  */}
      {/* ============================================================ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl font-bold text-dark-text tracking-tight">Cases</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage and track all your dental cases
            {total > 0 && <span className="ml-1 text-slate-400">({total} total)</span>}
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Button
            variant="gradient"
            onClick={() => navigate(ROUTES.CASES_NEW)}
            className="shadow-button hover:shadow-glow-blue transition-all duration-300 hover:-translate-y-0.5"
          >
            <Plus className="mr-2 h-4 w-4" /> New Case
          </Button>
        </motion.div>
      </div>

      {/* ============================================================ */}
      {/*  FILTERS BAR                                                  */}
      {/* ============================================================ */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        {/* Pill tabs */}
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100/80 p-1 scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.label}
              onClick={() => { setActiveTab(tab.value); setPage(1); }}
              className={cn(
                'relative whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-all duration-200',
                activeTab === tab.value
                  ? 'bg-white text-dark-text shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {activeTab === tab.value && (
                <motion.div
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-lg bg-white shadow-sm"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                  style={{ zIndex: -1 }}
                />
              )}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search cases..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-10 w-full rounded-xl bg-white border border-slate-200/80 pl-10 pr-4 text-sm text-dark-text placeholder:text-slate-400 shadow-input transition-all duration-200 hover:border-slate-300 focus:border-electric focus:shadow-input-focus focus:outline-none"
          />
        </div>
      </motion.div>

      {/* ============================================================ */}
      {/*  CONTENT                                                      */}
      {/* ============================================================ */}
      {isLoading ? (
        <div className="flex justify-center py-32">
          <Spinner size="lg" />
        </div>
      ) : cases.length === 0 ? (
        /* Empty state */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-col items-center gap-5 py-24 text-center"
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 blur-2xl" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200/60 shadow-card">
              <FolderOpen className="h-10 w-10 text-slate-400" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-dark-text">No cases found</p>
            <p className="text-sm text-slate-500 max-w-sm">
              {search || activeTab
                ? 'Try adjusting your search or filters to find what you\'re looking for.'
                : 'Get started by creating your first dental case.'}
            </p>
          </div>
          <Button
            variant="gradient"
            onClick={() => navigate(ROUTES.CASES_NEW)}
            className="mt-2 shadow-button hover:shadow-glow-blue transition-all duration-300"
          >
            <Plus className="mr-2 h-4 w-4" /> Create your first case
          </Button>
        </motion.div>
      ) : (
        <>
          {/* ======== Desktop table ======== */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="hidden md:block overflow-hidden rounded-2xl bg-white border border-slate-200/60 shadow-card"
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Case</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Priority</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Treatment</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Due Date</th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Price</th>
                  <th className="px-5 py-3.5 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {cases.map((c) => (
                  <motion.tr
                    key={c.id}
                    variants={fadeUp}
                    onClick={() => navigate(ROUTES.CASE_DETAIL(c.id))}
                    className={cn(
                      'cursor-pointer transition-colors duration-150 group',
                      'hover:bg-blue-50/40',
                      c.priority === 'RUSH' && 'border-l-[3px] border-l-red-400',
                      c.priority === 'URGENT' && 'border-l-[3px] border-l-amber-400',
                    )}
                  >
                    <td className="px-5 py-4">
                      <span className="font-semibold text-dark-text group-hover:text-electric transition-colors">
                        {c.case_number}
                      </span>
                    </td>
                    <td className="px-5 py-4"><CaseStatusBadge status={c.status} /></td>
                    <td className="px-5 py-4"><CasePriorityBadge priority={c.priority} /></td>
                    <td className="px-5 py-4 text-slate-600 capitalize">{c.treatment_type.replace(/_/g, ' ').toLowerCase()}</td>
                    <td className="px-5 py-4">
                      {c.due_date ? (
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {formatDate(c.due_date)}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-dark-text">
                      {c.price_usd ? `$${c.price_usd.toFixed(2)}` : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-electric group-hover:translate-x-0.5 transition-all" />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          {/* ======== Mobile cards ======== */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="space-y-3 md:hidden"
          >
            {cases.map((c) => (
              <motion.div key={c.id} variants={fadeUp}>
                <Link
                  to={ROUTES.CASE_DETAIL(c.id)}
                  className="block rounded-2xl bg-white border border-slate-200/60 p-4 shadow-card transition-all duration-200 hover:shadow-card-hover active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-dark-text">{c.case_number}</span>
                    <CaseStatusBadge status={c.status} />
                  </div>
                  <div className="mt-1.5 text-xs text-slate-500 capitalize">{c.treatment_type.replace(/_/g, ' ').toLowerCase()}</div>
                  <div className="mt-3 flex items-center gap-3 text-xs">
                    <CasePriorityBadge priority={c.priority} />
                    <span className="font-semibold text-dark-text">
                      {c.price_usd ? `$${c.price_usd.toFixed(2)}` : '—'}
                    </span>
                    {c.due_date && (
                      <span className="ml-auto flex items-center gap-1 text-slate-400">
                        <Calendar className="h-3 w-3" />
                        {formatDate(c.due_date)}
                      </span>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>

          {/* ======== Pagination ======== */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-slate-500">
                Page <span className="font-semibold text-dark-text">{page}</span> of{' '}
                <span className="font-semibold text-dark-text">{totalPages}</span>
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="rounded-xl px-4"
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="rounded-xl px-4"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
