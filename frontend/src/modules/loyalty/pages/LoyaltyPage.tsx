// LoyaltyPage.tsx — Loyalty points dashboard with 3 stat cards and transaction tabs.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Gift, Star, TrendingUp, ArrowDownRight } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { cn, formatDate } from '@/lib/utils';
import { loyaltyService } from '../services/loyalty.service';

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

const TABS = [
  { label: 'All', value: undefined },
  { label: 'Earned', value: 'EARNED' },
  { label: 'Redeemed', value: 'REDEEMED' },
];

export function LoyaltyPage() {
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);

  const { data: account, isLoading: accountLoading } = useQuery({
    queryKey: ['loyalty-account'],
    queryFn: () => loyaltyService.getAccount(),
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['loyalty-transactions', activeTab],
    queryFn: () => loyaltyService.getTransactions({ type: activeTab }),
  });

  if (accountLoading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>;

  const transactions = txData?.items ?? [];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="max-w-4xl mx-auto space-y-6">
      <motion.div variants={fadeUp}>
        <div className="flex items-center gap-2 mb-1">
          <Gift className="h-5 w-5 text-slate-400" />
          <h1 className="text-2xl font-bold text-dark-text tracking-tight">Loyalty Program</h1>
        </div>
        <p className="text-sm text-slate-500">Earn points with every case and redeem for discounts</p>
      </motion.div>

      {/* 3 Stat Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Points', value: account?.total_points ?? 0, icon: Star, gradient: 'from-amber-500 to-orange-400', iconBg: 'bg-amber-500/10', iconColor: 'text-amber-500' },
          { label: 'Points Availed', value: account?.availed_points ?? 0, icon: ArrowDownRight, gradient: 'from-violet-500 to-purple-400', iconBg: 'bg-violet-500/10', iconColor: 'text-violet-500' },
          { label: 'Remaining', value: account?.remaining_points ?? 0, icon: TrendingUp, gradient: 'from-emerald-500 to-teal-400', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500' },
        ].map((card) => (
          <motion.div key={card.label} variants={fadeUp}
            className="group relative overflow-hidden rounded-2xl bg-white border border-slate-200/60 p-5 shadow-card hover:shadow-card-hover transition-all duration-300">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl mb-3', card.iconBg)}>
              <card.icon className={cn('h-5 w-5', card.iconColor)} />
            </div>
            <p className="text-2xl font-bold text-dark-text">{card.value.toLocaleString()}</p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{card.label}</p>
            <div className={`absolute bottom-0 left-0 h-[3px] w-full bg-gradient-to-r ${card.gradient} opacity-0 group-hover:opacity-100 transition-all duration-300`} />
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-slate-100/80 p-1">
        {TABS.map((tab) => (
          <button key={tab.label} onClick={() => setActiveTab(tab.value)}
            className={cn(
              'rounded-lg px-4 py-2 text-[13px] font-medium transition-all',
              activeTab === tab.value ? 'bg-white text-dark-text shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Transactions */}
      {txLoading ? (
        <div className="flex justify-center py-16"><Spinner size="md" /></div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 border border-slate-200/60">
            <Gift className="h-7 w-7 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-500">No transactions yet</p>
          <p className="text-xs text-slate-400">Complete cases to start earning points!</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200/60 shadow-card overflow-hidden divide-y divide-slate-50">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg',
                  tx.type === 'EARNED' ? 'bg-emerald-50 text-emerald-600' :
                  tx.type === 'REDEEMED' ? 'bg-violet-50 text-violet-600' :
                  'bg-slate-100 text-slate-400',
                )}>
                  {tx.type === 'EARNED' ? <TrendingUp className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-dark-text">{tx.description}</p>
                  <p className="text-[10px] text-slate-400">{formatDate(tx.created_at)}</p>
                </div>
              </div>
              <span className={cn(
                'text-sm font-bold',
                tx.type === 'EARNED' ? 'text-emerald-600' : 'text-red-500',
              )}>
                {tx.type === 'EARNED' ? '+' : '-'}{tx.points}
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
