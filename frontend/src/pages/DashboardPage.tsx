// DashboardPage.tsx — Dashboard with welcome header and live stats from API.

import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, Clock, CheckCircle, DollarSign } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/modules/auth';
import { caseService } from '@/modules/cases';

export function DashboardPage() {
  const { user } = useAuthStore();
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => caseService.getDashboardStats(),
  });

  const STAT_CARDS = [
    { label: 'Active Cases', icon: FolderOpen, color: 'text-electric bg-blue-50', value: stats?.active_cases ?? 0 },
    { label: 'Pending Review', icon: Clock, color: 'text-amber-500 bg-amber-50', value: stats?.pending_review ?? 0 },
    { label: 'Completed', icon: CheckCircle, color: 'text-mint bg-emerald-50', value: stats?.completed ?? 0 },
    { label: 'Revenue', icon: DollarSign, color: 'text-purple-500 bg-purple-50', value: `$${(stats?.total_revenue ?? 0).toFixed(0)}` },
  ];

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-dark-text">
          Welcome back, {user?.full_name?.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Here&apos;s what&apos;s happening with your cases today.
        </p>
      </motion.div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="p-5">
              <div className="flex items-center gap-4">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.color}`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-2xl font-bold text-dark-text">{card.value}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
