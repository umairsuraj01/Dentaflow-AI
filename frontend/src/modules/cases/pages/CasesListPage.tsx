// CasesListPage.tsx — Cases list with status tabs, search, and pagination.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Search, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ROUTES } from '@/constants';
import { cn, formatDate } from '@/lib/utils';
import { useCases } from '../hooks/useCases';
import { CaseStatusBadge } from '../components/CaseStatusBadge';
import { CasePriorityBadge } from '../components/CasePriorityBadge';


const TABS: { label: string; value: string | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Review', value: 'REVIEW' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Completed', value: 'COMPLETED' },
];

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
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FolderOpen className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Management</span>
          </div>
          <h1 className="text-2xl font-bold text-dark-text tracking-tight">Cases</h1>
          {total > 0 && (
            <p className="mt-0.5 text-sm text-slate-400">{total} case{total !== 1 ? 's' : ''} total</p>
          )}
        </div>
        <Button
          variant="gradient"
          onClick={() => navigate(ROUTES.CASES_NEW)}
          className="shadow-lg shadow-electric/20 hover:shadow-xl hover:shadow-electric/30 transition-shadow duration-300"
        >
          <Plus className="mr-2 h-4 w-4" /> New Case
        </Button>
      </div>

      {/* Pill-style tab bar */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100/80 p-1 scrollbar-thin backdrop-blur-sm">
        {TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => { setActiveTab(tab.value); setPage(1); }}
            className={cn(
              'relative whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200',
              activeTab === tab.value
                ? 'bg-white text-dark-text shadow-sm ring-1 ring-black/[0.04]'
                : 'text-slate-500 hover:text-dark-text hover:bg-white/50',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by case number or patient..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="h-11 w-full max-w-md rounded-xl bg-white pl-11 pr-4 text-sm border border-slate-200/80 text-dark-text placeholder:text-slate-400 transition-all duration-200 focus:border-electric focus:outline-none focus:ring-4 focus:ring-electric/10 hover:border-slate-300"
        />
      </div>

      {/* Content area */}
      {isLoading ? (
        <div className="flex justify-center py-24"><Spinner size="lg" /></div>
      ) : cases.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex flex-col items-center gap-4 py-24 text-center"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-electric/10 via-blue-50 to-indigo-50 border border-electric/10 shadow-sm">
            <FolderOpen className="h-9 w-9 text-electric/60" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-slate-600">No cases found</p>
            <p className="text-sm text-slate-400 max-w-xs">Try adjusting your filters or create a new case to get started</p>
          </div>
          <Button
            variant="gradient"
            className="mt-3 shadow-lg shadow-electric/20 hover:shadow-xl hover:shadow-electric/30 transition-shadow duration-300"
            onClick={() => navigate(ROUTES.CASES_NEW)}
          >
            <Plus className="mr-2 h-4 w-4" /> Create your first case
          </Button>
        </motion.div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-card md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Case #</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Priority</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Treatment</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Due Date</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(ROUTES.CASE_DETAIL(c.id))}
                    className={cn(
                      'cursor-pointer transition-colors duration-150 hover:bg-blue-50/40',
                      c.priority === 'RUSH' && 'border-l-4 border-l-red-400',
                      c.priority === 'URGENT' && 'border-l-4 border-l-amber-400',
                    )}
                  >
                    <td className="px-5 py-4 font-semibold text-dark-text">{c.case_number}</td>
                    <td className="px-5 py-4"><CaseStatusBadge status={c.status} /></td>
                    <td className="px-5 py-4"><CasePriorityBadge priority={c.priority} /></td>
                    <td className="px-5 py-4 text-slate-600">{c.treatment_type.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-4 text-slate-500">{c.due_date ? formatDate(c.due_date) : '—'}</td>
                    <td className="px-5 py-4 font-semibold text-dark-text">${c.price_usd?.toFixed(2) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {cases.map((c) => (
              <Link
                key={c.id}
                to={ROUTES.CASE_DETAIL(c.id)}
                className="block rounded-2xl border border-slate-200/60 bg-white p-4 shadow-card transition-all duration-200 hover:shadow-card-hover active:scale-[0.99]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-dark-text">{c.case_number}</span>
                  <CaseStatusBadge status={c.status} />
                </div>
                <div className="mt-1 text-xs text-slate-500">{c.treatment_type.replace(/_/g, ' ')}</div>
                <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                  <CasePriorityBadge priority={c.priority} />
                  <span className="font-semibold text-dark-text">${c.price_usd?.toFixed(2) ?? '—'}</span>
                  {c.due_date && <span className="ml-auto text-slate-400">{formatDate(c.due_date)}</span>}
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="rounded-xl px-4"
              >
                Prev
              </Button>
              <span className="text-sm font-medium text-slate-500">
                Page {page} of {totalPages}
              </span>
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
          )}
        </>
      )}
    </div>
  );
}
