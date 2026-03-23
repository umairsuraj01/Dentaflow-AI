// ShippingModal.tsx — Modal dialog for entering shipping details.

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ShippingModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { tracking_number: string; shipping_carrier: string }) => Promise<void>;
  isLoading?: boolean;
}

export function ShippingModal({ open, onClose, onSubmit, isLoading }: ShippingModalProps) {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingNumber.trim() || !carrier.trim()) return;
    await onSubmit({ tracking_number: trackingNumber.trim(), shipping_carrier: carrier });
    setTrackingNumber('');
    setCarrier('FedEx');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-elevated border border-slate-200/60"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
              <Package className="h-5 w-5 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-dark-text">Mark as Shipped</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Tracking Number</label>
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              required
              placeholder="e.g. 1Z999AA10123456784"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm shadow-sm hover:border-slate-300 focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/10"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Shipping Carrier</label>
            <input
              type="text"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              required
              placeholder="e.g. FedEx, DHL, TCS, Leopards"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm shadow-sm hover:border-slate-300 focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/10"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="gradient" className="flex-1" loading={isLoading}>
              {isLoading ? 'Shipping...' : 'Confirm Shipment'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
