// OrderDetailPage.tsx — Manufacturing order detail with 2-column layout.

import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Truck, Clock, FileText, Download, Play,
  ChevronRight, Copy, Pencil, X as XIcon, Save,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';
import { useState } from 'react';
import { useOrderDetail } from '../hooks/useOrderDetail';
import { manufacturingService } from '../services/manufacturing.service';
import { OrderStatusBadge } from '../components/OrderStatusBadge';
import { ShippingModal } from '../components/ShippingModal';
import type { OrderStatus } from '../types/manufacturing.types';

const fadeIn = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [shippingOpen, setShippingOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    trimline: '', aligner_material: '', attachment_template_material: '',
    cutout_info: '', special_instructions: '',
    total_trays: 0, upper_aligner_count: 0, lower_aligner_count: 0,
    attachment_template_count: 0, attachment_start_stage: 1,
  });

  const {
    order, isLoading, moveToInProgress, markShipped, updateOrder,
    isMoving, isShipping, isUpdating,
  } = useOrderDetail(id!);

  if (isLoading) {
    return <div className="flex justify-center py-32"><Spinner size="lg" /></div>;
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="text-lg font-semibold text-dark-text">Order not found</p>
        <Button variant="outline" onClick={() => navigate('/manufacturing')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Manufacturing
        </Button>
      </div>
    );
  }

  const startEdit = () => {
    if (!order) return;
    setEditForm({
      trimline: order.trimline, aligner_material: order.aligner_material,
      attachment_template_material: order.attachment_template_material,
      cutout_info: order.cutout_info || '', special_instructions: order.special_instructions || '',
      total_trays: order.total_trays, upper_aligner_count: order.upper_aligner_count,
      lower_aligner_count: order.lower_aligner_count,
      attachment_template_count: order.attachment_template_count,
      attachment_start_stage: order.attachment_start_stage ?? 1,
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    await updateOrder(editForm);
    setEditing(false);
  };

  const handleMoveToInProgress = async () => {
    await moveToInProgress();
  };

  const handleShip = async (data: { tracking_number: string; shipping_carrier: string }) => {
    await markShipped(data);
    setShippingOpen(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="show" className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/manufacturing" className="hover:text-electric transition-colors">Manufacturing</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-dark-text">{order.order_number}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/manufacturing')} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors">
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-dark-text">{order.order_number}</h1>
              <OrderStatusBadge status={order.status as OrderStatus} />
            </div>
            <p className="text-sm text-slate-500 mt-0.5">Created {formatDate(order.created_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {order.status === 'NEW' && (
            <Button variant="gradient" onClick={handleMoveToInProgress} loading={isMoving}>
              <Clock className="mr-2 h-4 w-4" /> Move to In Progress
            </Button>
          )}
          {order.status === 'IN_PROGRESS' && (
            <Button variant="gradient" onClick={() => setShippingOpen(true)}>
              <Truck className="mr-2 h-4 w-4" /> Mark as Shipped
            </Button>
          )}
          {order.status === 'SHIPPED' && order.tracking_number && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200/60 px-4 py-2">
              <Truck className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700">
                {order.shipping_carrier}: {order.tracking_number}
              </span>
              <button onClick={() => copyToClipboard(order.tracking_number!)} className="text-emerald-500 hover:text-emerald-700">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Shipping Detail Banner (shipped orders) */}
      {order.status === 'SHIPPED' && (
        <div className="rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/60 p-5 shadow-sm">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">
              <Truck className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-emerald-900">Shipped Successfully</h3>
              <p className="text-xs text-emerald-700 mt-0.5">
                {order.shipping_carrier && <span className="font-semibold">{order.shipping_carrier}</span>}
                {order.tracking_number && (
                  <span className="ml-2">
                    Tracking: <span className="font-mono font-semibold">{order.tracking_number}</span>
                    <button onClick={() => copyToClipboard(order.tracking_number!)} className="ml-1 text-emerald-500 hover:text-emerald-700 inline-flex">
                      <Copy className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-emerald-600 font-medium">Shipped on</p>
              <p className="text-sm font-semibold text-emerald-900">{order.shipped_at ? formatDate(order.shipped_at) : '—'}</p>
            </div>
            {order.assigned_at && (
              <div className="text-right">
                <p className="text-[11px] text-emerald-600 font-medium">Processing time</p>
                <p className="text-sm font-semibold text-emerald-900">
                  {order.shipped_at && order.assigned_at
                    ? `${Math.ceil((new Date(order.shipped_at).getTime() - new Date(order.assigned_at).getTime()) / (1000 * 60 * 60 * 24))} days`
                    : '—'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Information */}
          <div className="rounded-2xl bg-white border border-slate-200/60 shadow-card overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-xs font-bold text-electric uppercase tracking-wider">Patient Information</h2>
            </div>
            <div className="grid grid-cols-3 gap-6 px-6 py-5">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Patient Name</p>
                <p className="text-sm font-semibold text-dark-text flex items-center gap-1.5">
                  {order.patient_name || 'Unknown'}
                  <button onClick={() => copyToClipboard(order.patient_name || '')} className="text-slate-300 hover:text-slate-500"><Copy className="h-3 w-3" /></button>
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Order ID</p>
                <p className="text-sm font-semibold text-dark-text flex items-center gap-1.5">
                  {order.order_number}
                  <button onClick={() => copyToClipboard(order.order_number)} className="text-slate-300 hover:text-slate-500"><Copy className="h-3 w-3" /></button>
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Case Type</p>
                <p className="text-sm font-semibold text-dark-text">{order.case_type}</p>
              </div>
            </div>
          </div>

          {/* Case Information (view/edit) */}
          <div className="rounded-2xl bg-white border border-slate-200/60 shadow-card overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xs font-bold text-electric uppercase tracking-wider">Case Information</h2>
              {!editing && order.status !== 'SHIPPED' && (
                <button onClick={startEdit} className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-electric transition-colors">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              )}
              {editing && (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="gradient" onClick={saveEdit} loading={isUpdating}>
                    <Save className="mr-1 h-3 w-3" /> Save
                  </Button>
                  <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600">
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="px-6 py-5 space-y-5">
              {editing ? (
                /* Edit mode */
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-500">Trimline</label>
                      <select value={editForm.trimline} onChange={(e) => setEditForm({ ...editForm, trimline: e.target.value })}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/10">
                        <option value="Straight">Straight</option>
                        <option value="Scalloped">Scalloped</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-500">Attachment Template Material</label>
                      <input type="text" value={editForm.attachment_template_material} onChange={(e) => setEditForm({ ...editForm, attachment_template_material: e.target.value })}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/10" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-500">Aligner Material</label>
                      <input type="text" value={editForm.aligner_material} onChange={(e) => setEditForm({ ...editForm, aligner_material: e.target.value })}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/10" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">Cutout Information</label>
                    <input type="text" value={editForm.cutout_info} onChange={(e) => setEditForm({ ...editForm, cutout_info: e.target.value })}
                      placeholder="Optional" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/10" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">Special Instructions</label>
                    <textarea value={editForm.special_instructions} onChange={(e) => setEditForm({ ...editForm, special_instructions: e.target.value })}
                      rows={4} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm resize-none focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/10" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Total Trays', key: 'total_trays' as const },
                      { label: 'Upper Aligners', key: 'upper_aligner_count' as const },
                      { label: 'Lower Aligners', key: 'lower_aligner_count' as const },
                    ].map((f) => (
                      <div key={f.key}>
                        <label className="mb-1.5 block text-xs font-medium text-slate-500">{f.label}</label>
                        <input type="number" min={0} value={editForm[f.key]} onChange={(e) => setEditForm({ ...editForm, [f.key]: parseInt(e.target.value) || 0 })}
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/10" />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-500">Attachment Templates</label>
                      <input type="number" min={0} value={editForm.attachment_template_count} onChange={(e) => setEditForm({ ...editForm, attachment_template_count: parseInt(e.target.value) || 0 })}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/10" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-500">Attachment Start Stage</label>
                      <input type="number" min={1} value={editForm.attachment_start_stage} onChange={(e) => setEditForm({ ...editForm, attachment_start_stage: parseInt(e.target.value) || 1 })}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/10" />
                    </div>
                  </div>
                </>
              ) : (
                /* View mode */
                <>
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Trimline</p>
                      <p className="text-sm font-semibold text-dark-text">{order.trimline}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Attachment Template Material</p>
                      <p className="text-sm font-semibold text-dark-text">{order.attachment_template_material}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Aligner Material</p>
                      <p className="text-sm font-semibold text-dark-text">{order.aligner_material}</p>
                    </div>
                  </div>
                  {order.cutout_info && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Cutout Information</p>
                      <p className="text-sm text-dark-text">{order.cutout_info}</p>
                    </div>
                  )}
                  {order.special_instructions && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Special Instructions to Manufacturer</p>
                      <p className="text-sm text-dark-text whitespace-pre-wrap bg-slate-50 rounded-xl p-4 border border-slate-100">
                        {order.special_instructions}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Manufacturing Sheet */}
          <div className="rounded-2xl bg-white border border-slate-200/60 shadow-card overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-xs font-bold text-electric uppercase tracking-wider">Manufacturing Sheet Information</h2>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Total Number of Trays</p>
                <p className="text-2xl font-bold text-dark-text">{order.total_trays}</p>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Upper: Aligners</p>
                  <p className="text-sm font-semibold text-dark-text">{order.upper_aligner_count}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Upper: Attachment Templates</p>
                  <p className="text-sm font-semibold text-dark-text">{order.attachment_template_count}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Upper Attachment Start Stages</p>
                  <p className="text-sm font-semibold text-dark-text">Stage {order.attachment_start_stage ?? '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Lower: Aligners</p>
                  <p className="text-sm font-semibold text-dark-text">{order.lower_aligner_count}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Lower: Attachment Templates</p>
                  <p className="text-sm font-semibold text-dark-text">{order.attachment_template_count}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Lower Attachment Start Stages</p>
                  <p className="text-sm font-semibold text-dark-text">Stage {order.attachment_start_stage ?? '—'}</p>
                </div>
              </div>
              <div className="pt-2">
                <h3 className="text-xs font-bold text-electric uppercase tracking-wider mb-3">Download Case Information</h3>
                <Button size="sm" variant="outline" onClick={() => manufacturingService.exportCsv()}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Download CSV
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right column (1/3) — Files panel */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-slate-200/60 shadow-card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-dark-text">Patient Photos and Files</h2>
            </div>
            <div className="divide-y divide-slate-50">
              {/* STL Files */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-dark-text">STL Files</span>
                </div>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => navigate(`/cases/${order.case_id}`)}>
                  <Download className="mr-1 h-3 w-3" /> Download All ({order.total_trays})
                </Button>
              </div>

              {/* Tooth Movement Animation */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <Play className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-dark-text">Tooth Movement Animation</span>
                </div>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => navigate(`/cases/${order.case_id}/treatment`)}>
                  Open Animation
                </Button>
              </div>

              {/* Intra-oral Images */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-dark-text">Intra-oral Images</span>
                </div>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => navigate(`/cases/${order.case_id}`)}>
                  View
                </Button>
              </div>

              {/* IPR Chart */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-dark-text">IPR Chart</span>
                </div>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => navigate(`/cases/${order.case_id}/treatment`)}>
                  View
                </Button>
              </div>

              {/* Device Certificate */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-dark-text">Device Certificate</span>
                </div>
                <Button size="sm" variant="outline" className="text-xs" onClick={async () => {
                  const token = localStorage.getItem('access_token');
                  const res = await fetch(`/api/v1/manufacturing/orders/${order.id}/certificate`, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  const html = await res.text();
                  const w = window.open('', '_blank');
                  if (w) { w.document.write(html); w.document.close(); }
                }}>
                  Print Materials
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ShippingModal
        open={shippingOpen}
        onClose={() => setShippingOpen(false)}
        onSubmit={handleShip}
        isLoading={isShipping}
      />
    </motion.div>
  );
}
