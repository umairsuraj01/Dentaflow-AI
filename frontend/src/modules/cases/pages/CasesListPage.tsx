// CasesListPage.tsx — Cases list with status tabs, search, and pagination.

import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ROUTES } from '@/constants';
import { cn, formatDate } from '@/lib/utils';
import { useCases } from '../hooks/useCases';
import { CaseStatusBadge } from '../components/CaseStatusBadge';
import { CasePriorityBadge } from '../components/CasePriorityBadge';
import type { CaseStatus } from '../types/case.types';

const TABS: { label: string; value: string | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Pending', value: 'SUBMITTED' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Review', value: 'REVIEW' },
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
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-dark-text">Cases</h1>
        <Button onClick={() => navigate(ROUTES.CASES_NEW)}>
          <Plus className="mr-2 h-4 w-4" /> New Case
        </Button>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-soft-gray p-1">
        {TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => { setActiveTab(tab.value); setPage(1); }}
            className={cn(
              'whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.value
                ? 'bg-white text-dark-text shadow-sm'
                : 'text-gray-500 hover:text-dark-text',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by case number or patient..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="h-10 w-full max-w-md rounded-lg bg-white pl-10 pr-4 text-sm border border-gray-200 focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/20"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : cases.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-soft-gray" />
          <p className="text-sm text-gray-500">No cases found</p>
          <Button variant="outline" onClick={() => navigate(ROUTES.CASES_NEW)}>Create your first case</Button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-soft-gray/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Case #</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Priority</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Treatment</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Due Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(ROUTES.CASE_DETAIL(c.id))}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-blue-50/50',
                      c.priority === 'RUSH' && 'border-l-4 border-l-red-500',
                      c.priority === 'URGENT' && 'border-l-4 border-l-amber-500',
                    )}
                  >
                    <td className="px-4 py-3 font-medium text-dark-text">{c.case_number}</td>
                    <td className="px-4 py-3"><CaseStatusBadge status={c.status} /></td>
                    <td className="px-4 py-3"><CasePriorityBadge priority={c.priority} /></td>
                    <td className="px-4 py-3 text-gray-600">{c.treatment_type.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-gray-600">{c.due_date ? formatDate(c.due_date) : '—'}</td>
                    <td className="px-4 py-3 font-medium">${c.price_usd?.toFixed(2) ?? '—'}</td>
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
                className="block rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-dark-text">{c.case_number}</span>
                  <CaseStatusBadge status={c.status} />
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                  <CasePriorityBadge priority={c.priority} />
                  <span>${c.price_usd?.toFixed(2) ?? '—'}</span>
                  <span>{c.due_date ? formatDate(c.due_date) : ''}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</Button>
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
