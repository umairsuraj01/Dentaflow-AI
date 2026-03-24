// App.tsx — Router setup. Imports from module index files only.

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ROUTES } from '@/constants';
import { AuthGuard, LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage } from '@/modules/auth';
import { AuthLayout } from '@/layouts/AuthLayout';
import { AppLayout } from '@/layouts/AppLayout';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { PageSkeleton } from '@/components/ui/PageSkeleton';

// Lazy-loaded page components — code-split per route.
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const CasesListPage = lazy(() => import('@/modules/cases').then(m => ({ default: m.CasesListPage })));
const NewCasePage = lazy(() => import('@/modules/cases').then(m => ({ default: m.NewCasePage })));
const CaseDetailPage = lazy(() => import('@/modules/cases').then(m => ({ default: m.CaseDetailPage })));
const TreatmentViewer = lazy(() => import('@/modules/treatment').then(m => ({ default: m.TreatmentViewer })));
const BillingDashboardPage = lazy(() => import('@/modules/billing').then(m => ({ default: m.BillingDashboardPage })));
const PricingPage = lazy(() => import('@/modules/billing').then(m => ({ default: m.PricingPage })));
const AnalyticsPage = lazy(() => import('@/modules/admin').then(m => ({ default: m.AnalyticsPage })));
const Viewer3DTestPage = lazy(() => import('@/pages/Viewer3DTestPage').then(m => ({ default: m.Viewer3DTestPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const UsersPage = lazy(() => import('@/modules/admin').then(m => ({ default: m.UsersPage })));
const TechniciansPage = lazy(() => import('@/modules/admin').then(m => ({ default: m.TechniciansPage })));
const ManufacturingDashboardPage = lazy(() => import('@/modules/manufacturing').then(m => ({ default: m.ManufacturingDashboardPage })));
const OrderDetailPage = lazy(() => import('@/modules/manufacturing').then(m => ({ default: m.OrderDetailPage })));
const OrgSettingsPage = lazy(() => import('@/modules/organizations').then(m => ({ default: m.OrgSettingsPage })));

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <InstallPrompt />
      <BrowserRouter>
        <Suspense fallback={<PageSkeleton />}>
        <Routes>
          {/* Auth routes */}
          <Route element={<AuthLayout />}>
            <Route path={ROUTES.LOGIN} element={<LoginPage />} />
            <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
            <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
            <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
          </Route>

          {/* Protected app routes */}
          <Route
            element={
              <AuthGuard>
                <AppLayout />
              </AuthGuard>
            }
          >
            <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
            <Route path={ROUTES.CASES} element={<CasesListPage />} />
            <Route path={ROUTES.CASES_NEW} element={<NewCasePage />} />
            <Route path="/cases/:id" element={<CaseDetailPage />} />
            {/* AI page redirects to treatment planner (single workflow) */}
            <Route path="/cases/:id/ai" element={<Navigate to="../treatment" replace />} />
            <Route path="/cases/:id/treatment" element={<TreatmentViewer />} />
            <Route path={ROUTES.MANUFACTURING} element={<ManufacturingDashboardPage />} />
            <Route path="/manufacturing/:id" element={<OrderDetailPage />} />
            <Route path={ROUTES.BILLING} element={<BillingDashboardPage />} />
            <Route path="/billing/pricing" element={<PricingPage />} />
            <Route path={ROUTES.ADMIN} element={<AnalyticsPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/technicians" element={<TechniciansPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path={ROUTES.ORG_SETTINGS} element={<OrgSettingsPage />} />
            <Route path="/viewer-test" element={<Viewer3DTestPage />} />
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
