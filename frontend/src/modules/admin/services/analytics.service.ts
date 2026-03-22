import api from '@/lib/api';

function unwrap<T>(res: any): T {
  const body = res.data;
  if (!body.success) throw new Error(body.message || 'Request failed');
  return body.data as T;
}

export interface KPIStats {
  total_revenue_usd: number;
  revenue_change_pct: number;
  total_cases: number;
  cases_change_pct: number;
  active_dentists: number;
  dentists_change_pct: number;
  avg_turnaround_days: number;
  turnaround_change_pct: number;
}

export interface RevenueTrend {
  month: string;
  revenue: number;
}

export interface CasesByStatus {
  status: string;
  count: number;
  color: string;
}

export interface TopDentist {
  name: string;
  cases: number;
  revenue: number;
}

export interface AnalyticsData {
  kpi: KPIStats;
  revenue_trend: RevenueTrend[];
  cases_by_status: CasesByStatus[];
  top_dentists: TopDentist[];
}

export const analyticsService = {
  getAnalytics: async (period: string = '30d'): Promise<AnalyticsData> => {
    const res = await api.get('/billing/stats', { params: { period } });
    const stats = unwrap<any>(res);

    // Transform billing stats into analytics format
    // For now, generate mock data since the analytics endpoint isn't built yet
    return {
      kpi: {
        total_revenue_usd: stats.monthly_spend_usd || 0,
        revenue_change_pct: 12.5,
        total_cases: stats.cases_used || 0,
        cases_change_pct: 8.3,
        active_dentists: 1,
        dentists_change_pct: 0,
        avg_turnaround_days: 2.1,
        turnaround_change_pct: -5.2,
      },
      revenue_trend: [
        { month: 'Oct', revenue: 1200 },
        { month: 'Nov', revenue: 1800 },
        { month: 'Dec', revenue: 1500 },
        { month: 'Jan', revenue: 2200 },
        { month: 'Feb', revenue: 2800 },
        { month: 'Mar', revenue: stats.monthly_spend_usd || 3200 },
      ],
      cases_by_status: [
        { status: 'Completed', count: 45, color: '#10B981' },
        { status: 'In Progress', count: 12, color: '#3B82F6' },
        { status: 'Review', count: 8, color: '#F59E0B' },
        { status: 'Draft', count: 5, color: '#9CA3AF' },
      ],
      top_dentists: [
        { name: 'Dr. Smith', cases: 15, revenue: 525 },
        { name: 'Dr. Johnson', cases: 12, revenue: 420 },
        { name: 'Dr. Williams', cases: 10, revenue: 350 },
        { name: 'Dr. Brown', cases: 8, revenue: 280 },
        { name: 'Dr. Davis', cases: 6, revenue: 210 },
      ],
    };
  },
};
