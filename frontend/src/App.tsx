// App.tsx — Router setup. Imports from module index files only.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ROUTES } from '@/constants';
import { AuthGuard, LoginPage, RegisterPage } from '@/modules/auth';
import { CasesListPage, NewCasePage, CaseDetailPage, AIProcessingPage } from '@/modules/cases';
import { AuthLayout } from '@/layouts/AuthLayout';
import { AppLayout } from '@/layouts/AppLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { Viewer3DTestPage } from '@/pages/Viewer3DTestPage';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Auth routes */}
          <Route element={<AuthLayout />}>
            <Route path={ROUTES.LOGIN} element={<LoginPage />} />
            <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
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
            <Route path="/cases/:id/ai" element={<AIProcessingPage />} />
            <Route path={ROUTES.BILLING} element={<PlaceholderPage title="Billing" />} />
            <Route path={ROUTES.ADMIN} element={<PlaceholderPage title="Admin" />} />
            <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
            <Route path="/viewer-test" element={<Viewer3DTestPage />} />
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="h-16 w-16 rounded-2xl bg-soft-gray" />
      <h2 className="text-xl font-semibold text-dark-text">{title}</h2>
      <p className="text-sm text-gray-500">This page will be built in a later phase.</p>
    </div>
  );
}
