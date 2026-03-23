// ManufacturingDashboardPage.tsx — 3-tab manufacturing order dashboard with sortable columns.

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search, Download, RotateCcw, ArrowRight, Package, Clock, Truck, Factory,
  CheckSquare, Square, ChevronUp, ChevronDown, ChevronsUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn, formatDate } from '@/lib/utils';
import { useManufacturingOrders } from '../hooks/useManufacturingOrders';
import { useManufacturingStats } from '../hooks/useManufacturingStats';
import { manufacturingService } from '../services/manufacturing.service';
import { OrderTypeBadge } from '../components/OrderTypeBadge';
import { ShippingModal } from '../components/ShippingModal';
import type { ManufacturingOrder, OrderStatus } from '../types/manufacturing.types';

const TABS: { label: string; value: OrderStatus; icon: React.ElementType }[] = [
  { label: 'New Order', value: 'NEW', icon: Package },
  { label: 'In Progress', value: 'IN_PROGRESS', icon: Clock },
  { label: 'Shipped', value: 'SHIPPED', icon: Truck },
];

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeSinceMs(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Date.now() - new Date(dateStr).getTime();
}

function formatTimeSince(dateStr: string | null): string {
  if (!dateStr) return '—';
  const diff = timeSinceMs(dateStr);
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h ${mins % 60}m`;
}

function isOverdue(dateStr: string | null, thresholdMs: number): boolean {
  if (!dateStr) return false;
  return timeSinceMs(dateStr) > thresholdMs;
}

function isPastDate(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr).getTime() < Date.now();
}

type SortKey = 'patient_name' | 'date_assigned' | 'time_since' | 'target_32c' | 'order_number';
type SortDir = 'asc' | 'desc';

function sortOrders(orders: ManufacturingOrder[], key: SortKey, dir: SortDir): ManufacturingOrder[] {
  return [...orders].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case 'patient_name':
        cmp = (a.patient_name || '').localeCompare(b.patient_name || '');
        break;
      case 'date_assigned':
        cmp = new Date(a.assigned_at || a.created_at).getTime() - new Date(b.assigned_at || b.created_at).getTime();
        break;
      case 'time_since':
        cmp = timeSinceMs(a.assigned_at || a.created_at) - timeSinceMs(b.assigned_at || b.created_at);
        break;
      case 'target_32c':
        cmp = new Date(a.target_32c_date || '2099-01-01').getTime() - new Date(b.target_32c_date || '2099-01-01').getTime();
        break;
      case 'order_number':
        cmp = a.order_number.localeCompare(b.order_number);
        break;
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}

// ---------------------------------------------------------------------------
// Sortable Header Component
// ---------------------------------------------------------------------------

function SortHeader({ label, sortKey, currentKey, currentDir, onSort }: {
  label: string; sortKey: SortKey; currentKey: SortKey | null; currentDir: SortDir; onSort: (key: SortKey) => void;
}) {
  const isActive = currentKey === sortKey;
  return (
    <th
      className="px-4 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700 transition-colors group"
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive ? (
          currentDir === 'asc' ? <ChevronUp className="h-3 w-3 text-electric" /> : <ChevronDown className="h-3 w-3 text-electric" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 text-slate-300 group-hover:text-slate-400" />
        )}
      </div>
    </th>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ManufacturingDashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<OrderStatus>('NEW');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [shippingModalOpen, setShippingModalOpen] = useState(false);
  const [shippingOrderId, setShippingOrderId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { stats } = useManufacturingStats();
  const { orders: rawOrders, totalPages, isLoading, bulkUpdateStatus, isBulkUpdating } = useManufacturingOrders({
    status: activeTab, search: search || undefined, page, per_page: 20,
  });

  // Client-side sort
  const orders = useMemo(() => {
    if (!sortKey) return rawOrders;
    return sortOrders(rawOrders, sortKey, sortDir);
  }, [rawOrders, sortKey, sortDir]);

  const tabCounts: Record<OrderStatus, number> = {
    NEW: stats.new, IN_PROGRESS: stats.in_progress, SHIPPED: stats.shipped, CANCELLED: 0,
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)));
    }
  };

  const handleBulkAction = async (targetStatus: OrderStatus) => {
    if (selectedIds.size === 0) return;
    await bulkUpdateStatus({ order_ids: Array.from(selectedIds), target_status: targetStatus });
    setSelectedIds(new Set());
  };

  const handleShipSingle = async (data: { tracking_number: string; shipping_carrier: string }) => {
    if (!shippingOrderId) return;
    await manufacturingService.markShipped(shippingOrderId, data);
    setShippingModalOpen(false);
    setShippingOrderId(null);
    window.location.reload();
  };

  // Overdue threshold: 2 days in ms
  const OVERDUE_MS = 2 * 24 * 60 * 60 * 1000;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Factory className="h-5 w-5 text-slate-400" />
            <h1 className="text-2xl font-bold text-dark-text tracking-tight">Manufacturing</h1>
          </div>
          <p className="text-sm text-slate-500">Track and manage aligner production orders</p>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-slate-100/80 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setActiveTab(tab.value); setPage(1); setSelectedIds(new Set()); setSortKey(null); }}
            className={cn(
              'relative flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all duration-200',
              activeTab === tab.value ? 'bg-white text-dark-text shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {activeTab === tab.value && (
              <motion.div layoutId="mfg-tab" className="absolute inset-0 rounded-lg bg-white shadow-sm" style={{ zIndex: -1 }} transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }} />
            )}
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tabCounts[tab.value] > 0 && (
              <span className={cn(
                'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                activeTab === tab.value ? 'bg-electric/10 text-electric' : 'bg-slate-200 text-slate-500',
              )}>
                {tabCounts[tab.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search orders, patients..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-10 w-full rounded-xl bg-white border border-slate-200/80 pl-10 pr-4 text-sm shadow-input hover:border-slate-300 focus:border-electric focus:shadow-input-focus focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && activeTab === 'NEW' && (
            <Button size="sm" variant="outline" onClick={() => handleBulkAction('IN_PROGRESS')} loading={isBulkUpdating}>
              Move to In Progress ({selectedIds.size})
            </Button>
          )}
          {selectedIds.size > 0 && activeTab === 'IN_PROGRESS' && (
            <Button size="sm" variant="outline" onClick={() => handleBulkAction('SHIPPED')} loading={isBulkUpdating}>
              Mark as Shipped ({selectedIds.size})
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => manufacturingService.exportCsv(activeTab)}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
          </Button>
          {(search || selectedIds.size > 0 || sortKey) && (
            <Button size="sm" variant="ghost" onClick={() => { setSearch(''); setSelectedIds(new Set()); setSortKey(null); }}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-32"><Spinner size="lg" /></div>
      ) : orders.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 py-24 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-50 border border-slate-200/60">
            <Package className="h-9 w-9 text-slate-300" />
          </div>
          <p className="text-base font-semibold text-dark-text">No orders found</p>
          <p className="text-sm text-slate-500 max-w-xs">
            {search ? 'Try adjusting your search.' : 'Orders will appear here when cases are approved.'}
          </p>
        </motion.div>
      ) : (
        <>
          {/* Desktop table */}
          <motion.div variants={stagger} initial="hidden" animate="show" className="hidden md:block overflow-hidden rounded-2xl bg-white border border-slate-200/60 shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-3.5 w-10">
                      <button onClick={toggleAll} className="text-slate-400 hover:text-slate-600">
                        {selectedIds.size === orders.length && orders.length > 0
                          ? <CheckSquare className="h-4 w-4 text-electric" />
                          : <Square className="h-4 w-4" />}
                      </button>
                    </th>
                    <SortHeader label="Patient Name" sortKey="patient_name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Case Type</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Order Type</th>
                    <SortHeader label="Date Assigned" sortKey="date_assigned" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortHeader label="Time Since" sortKey="time_since" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortHeader label="Target 32C" sortKey="target_32c" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortHeader label="Order ID" sortKey="order_number" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    {activeTab === 'SHIPPED' && (
                      <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tracking</th>
                    )}
                    {activeTab === 'NEW' && (
                      <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Replacement</th>
                    )}
                    <th className="px-4 py-3.5 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {orders.map((order) => {
                    const isSelected = selectedIds.has(order.id);
                    const initials = order.patient_name
                      ? order.patient_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                      : '??';
                    const timeOverdue = isOverdue(order.assigned_at || order.created_at, OVERDUE_MS);
                    const targetPast = isPastDate(order.target_32c_date);

                    return (
                      <motion.tr
                        key={order.id}
                        variants={fadeUp}
                        className={cn(
                          'cursor-pointer transition-colors duration-150 group',
                          isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50/60',
                        )}
                      >
                        <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => toggleSelect(order.id)} className="text-slate-400 hover:text-electric">
                            {isSelected
                              ? <CheckSquare className="h-4 w-4 text-electric" />
                              : <Square className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-3.5" onClick={() => navigate(`/manufacturing/${order.id}`)}>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700 shrink-0">
                              {initials}
                            </div>
                            <span className="font-semibold text-dark-text group-hover:text-electric transition-colors truncate">
                              {order.patient_name || 'Unknown'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600" onClick={() => navigate(`/manufacturing/${order.id}`)}>
                          {order.case_type}
                        </td>
                        <td className="px-4 py-3.5" onClick={() => navigate(`/manufacturing/${order.id}`)}>
                          <OrderTypeBadge type={order.order_type} />
                        </td>
                        <td className="px-4 py-3.5 text-slate-500" onClick={() => navigate(`/manufacturing/${order.id}`)}>
                          {order.assigned_at ? formatDate(order.assigned_at) : formatDate(order.created_at)}
                        </td>
                        <td className="px-4 py-3.5" onClick={() => navigate(`/manufacturing/${order.id}`)}>
                          <span className={cn(
                            'text-sm font-medium',
                            timeOverdue && order.status !== 'SHIPPED' ? 'text-red-600' :
                            order.status === 'IN_PROGRESS' ? 'text-amber-600' : 'text-slate-500',
                          )}>
                            {formatTimeSince(order.assigned_at || order.created_at)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5" onClick={() => navigate(`/manufacturing/${order.id}`)}>
                          {order.target_32c_date ? (
                            <span className={cn(
                              'text-sm',
                              targetPast && order.status !== 'SHIPPED' ? 'text-red-600 font-semibold' : 'text-slate-500',
                            )}>
                              {formatDate(order.target_32c_date)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3.5" onClick={() => navigate(`/manufacturing/${order.id}`)}>
                          <span className="font-mono text-xs text-slate-500">{order.order_number}</span>
                        </td>
                        {activeTab === 'SHIPPED' && (
                          <td className="px-4 py-3.5 text-xs text-slate-500">
                            {order.tracking_number || '—'}
                          </td>
                        )}
                        {activeTab === 'NEW' && (
                          <td className="px-4 py-3.5 text-xs">
                            {order.replacement_reason ? (
                              <span className="text-red-600 font-medium">{order.replacement_reason.replace('_', ' ')}</span>
                            ) : '—'}
                          </td>
                        )}
                        <td className="px-4 py-3.5">
                          <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-electric transition-all" />
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                <p className="text-sm text-slate-500">
                  Page <span className="font-semibold text-dark-text">{page}</span> of <span className="font-semibold text-dark-text">{totalPages}</span>
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
                  <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              </div>
            )}
          </motion.div>

          {/* Mobile cards */}
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3 md:hidden">
            {orders.map((order) => {
              const initials = order.patient_name
                ? order.patient_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                : '??';
              const timeOverdue = isOverdue(order.assigned_at || order.created_at, OVERDUE_MS);
              const targetPast = isPastDate(order.target_32c_date);

              return (
                <motion.div
                  key={order.id}
                  variants={fadeUp}
                  onClick={() => navigate(`/manufacturing/${order.id}`)}
                  className="rounded-2xl bg-white border border-slate-200/60 p-4 shadow-card hover:shadow-card-hover transition-all duration-200 active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">
                        {initials}
                      </div>
                      <div>
                        <p className="font-semibold text-dark-text text-sm">{order.patient_name || 'Unknown'}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{order.order_number}</p>
                      </div>
                    </div>
                    <OrderTypeBadge type={order.order_type} />
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-500">{order.case_type}</span>
                    <span className="text-slate-300">|</span>
                    <span className={cn(
                      'font-medium',
                      timeOverdue && order.status !== 'SHIPPED' ? 'text-red-600' : 'text-slate-500',
                    )}>
                      {formatTimeSince(order.assigned_at || order.created_at)}
                    </span>
                    {order.target_32c_date && (
                      <>
                        <span className="text-slate-300">|</span>
                        <span className={cn(targetPast && order.status !== 'SHIPPED' ? 'text-red-600 font-semibold' : 'text-slate-400')}>
                          32C: {formatDate(order.target_32c_date)}
                        </span>
                      </>
                    )}
                  </div>
                  {order.tracking_number && (
                    <div className="mt-2 text-xs text-emerald-600 font-medium">
                      {order.shipping_carrier}: {order.tracking_number}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>

          {/* Mobile pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between md:hidden">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="text-sm text-slate-500">{page} / {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </>
      )}

      <ShippingModal
        open={shippingModalOpen}
        onClose={() => setShippingModalOpen(false)}
        onSubmit={handleShipSingle}
      />
    </div>
  );
}
