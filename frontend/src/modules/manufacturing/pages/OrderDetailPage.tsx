// OrderDetailPage.tsx — Manufacturing order detail with 2-column layout.

import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Truck, Clock, FileText, Download, Play,
  ChevronRight, Copy,
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

  const {
    order, isLoading, moveToInProgress, markShipped,
    isMoving, isShipping,
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

          {/* Case Information */}
          <div className="rounded-2xl bg-white border border-slate-200/60 shadow-card overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-xs font-bold text-electric uppercase tracking-wider">Case Information</h2>
            </div>
            <div className="px-6 py-5 space-y-5">
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
                <Button size="sm" variant="outline" className="text-xs" onClick={() => window.print()}>
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
