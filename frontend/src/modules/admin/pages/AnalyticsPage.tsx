import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  FolderOpen,
  Users,
  Clock,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Trophy,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import {
  analyticsService,
  type AnalyticsData,
  type RevenueTrend,
  type CasesByStatus,
  type TopDentist,
} from '../services/analytics.service';

const PERIODS = [
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '3m', value: '3m' },
  { label: '12m', value: '12m' },
] as const;

/* ------------------------------------------------------------------ */
/*  KPI Card                                                          */
/* ------------------------------------------------------------------ */

function KPICard({
  title,
  value,
  changePct,
  icon: Icon,
  invertChange,
}: {
  title: string;
  value: string;
  changePct: number;
  icon: React.ElementType;
  invertChange?: boolean;
}) {
  const isPositive = invertChange ? changePct < 0 : changePct > 0;
  const changeAbs = Math.abs(changePct);

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-[#0F172A]">{value}</p>
            <div className="flex items-center gap-1">
              {isPositive ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
              )}
              <span
                className={cn(
                  'text-xs font-semibold',
                  isPositive ? 'text-emerald-600' : 'text-red-500',
                )}
              >
                {changeAbs.toFixed(1)}%
              </span>
              <span className="text-xs text-gray-400">vs last period</span>
            </div>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#3B82F6]/10">
            <Icon className="h-5 w-5 text-[#3B82F6]" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Revenue Bar Chart (pure CSS)                                      */
/* ------------------------------------------------------------------ */

function RevenueChart({ data }: { data: RevenueTrend[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-[#3B82F6]" />
          Revenue Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-3" style={{ height: 220 }}>
          {data.map((item, idx) => {
            const heightPct = (item.revenue / maxRevenue) * 100;
            return (
              <div
                key={item.month}
                className="relative flex flex-1 flex-col items-center justify-end"
                style={{ height: '100%' }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Tooltip */}
                {hoveredIdx === idx && (
                  <div className="absolute -top-8 z-10 rounded-md bg-[#0F172A] px-2.5 py-1 text-xs font-semibold text-white shadow-lg">
                    ${item.revenue.toLocaleString()}
                  </div>
                )}
                {/* Bar */}
                <div
                  className={cn(
                    'w-full max-w-[48px] rounded-t-md transition-all duration-300',
                    hoveredIdx === idx
                      ? 'bg-[#3B82F6]'
                      : 'bg-[#3B82F6]/70',
                  )}
                  style={{ height: `${heightPct}%`, minHeight: 4 }}
                />
                {/* Label */}
                <span className="mt-2 text-xs font-medium text-gray-500">
                  {item.month}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Cases by Status (horizontal bars)                                 */
/* ------------------------------------------------------------------ */

function CasesStatusChart({ data }: { data: CasesByStatus[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const totalCount = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-[#3B82F6]" />
          Cases by Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item) => {
            const widthPct = (item.count / maxCount) * 100;
            return (
              <div key={item.status} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-medium text-[#0F172A]">
                      {item.status}
                    </span>
                  </div>
                  <span className="text-gray-500">
                    {item.count}{' '}
                    <span className="text-gray-400">
                      ({((item.count / totalCount) * 100).toFixed(0)}%)
                    </span>
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Top Dentists Table                                                */
/* ------------------------------------------------------------------ */

function TopDentistsTable({ data }: { data: TopDentist[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-[#F59E0B]" />
          Top Dentists
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                <th className="pb-3 pr-4">#</th>
                <th className="pb-3 pr-4">Dentist</th>
                <th className="pb-3 pr-4 text-right">Cases</th>
                <th className="pb-3 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.map((dentist, idx) => (
                <tr
                  key={dentist.name}
                  className="border-b border-gray-50 last:border-0"
                >
                  <td className="py-3 pr-4">
                    <span
                      className={cn(
                        'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                        idx === 0
                          ? 'bg-amber-100 text-amber-700'
                          : idx === 1
                            ? 'bg-gray-200 text-gray-600'
                            : idx === 2
                              ? 'bg-orange-100 text-orange-600'
                              : 'bg-gray-50 text-gray-400',
                      )}
                    >
                      {idx + 1}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-medium text-[#0F172A]">
                    {dentist.name}
                  </td>
                  <td className="py-3 pr-4 text-right text-gray-600">
                    {dentist.cases}
                  </td>
                  <td className="py-3 text-right font-semibold text-[#10B981]">
                    ${dentist.revenue.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                  */
/* ------------------------------------------------------------------ */

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-gray-100', className)}
    />
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="mb-3 h-4 w-24" />
              <Skeleton className="mb-2 h-8 w-32" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[260px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[260px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                         */
/* ------------------------------------------------------------------ */

export function AnalyticsPage() {
  const [period, setPeriod] = useState('30d');

  const { data, isLoading, isError, error } = useQuery<AnalyticsData>({
    queryKey: ['admin-analytics', period],
    queryFn: () => analyticsService.getAnalytics(period),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor performance metrics and trends
          </p>
        </div>

        {/* Period toggle */}
        <div className="inline-flex rounded-lg bg-gray-100 p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                'rounded-md px-3.5 py-1.5 text-sm font-medium transition-all',
                period === p.value
                  ? 'bg-white text-[#0F172A] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-sm text-red-600">
              Failed to load analytics:{' '}
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && <AnalyticsSkeleton />}

      {/* Data */}
      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KPICard
              title="Total Revenue"
              value={`$${data.kpi.total_revenue_usd.toLocaleString()}`}
              changePct={data.kpi.revenue_change_pct}
              icon={DollarSign}
            />
            <KPICard
              title="Total Cases"
              value={data.kpi.total_cases.toLocaleString()}
              changePct={data.kpi.cases_change_pct}
              icon={FolderOpen}
            />
            <KPICard
              title="Active Dentists"
              value={data.kpi.active_dentists.toLocaleString()}
              changePct={data.kpi.dentists_change_pct}
              icon={Users}
            />
            <KPICard
              title="Avg Turnaround"
              value={`${data.kpi.avg_turnaround_days.toFixed(1)}d`}
              changePct={data.kpi.turnaround_change_pct}
              icon={Clock}
              invertChange
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RevenueChart data={data.revenue_trend} />
            <CasesStatusChart data={data.cases_by_status} />
          </div>

          {/* Top Dentists */}
          <TopDentistsTable data={data.top_dentists} />
        </>
      )}
    </div>
  );
}
