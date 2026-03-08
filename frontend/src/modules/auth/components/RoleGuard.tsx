// RoleGuard.tsx — Role-based access wrapper. Shows forbidden if wrong role.

import type { UserRole } from '@/types/common';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';

interface RoleGuardProps {
  roles: UserRole[];
  children: React.ReactNode;
}

export function RoleGuard({ roles, children }: RoleGuardProps) {
  const { user } = useAuthStore();

  if (!user || !roles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <ShieldAlert className="h-16 w-16 text-gray-300" />
        <h2 className="text-xl font-semibold text-dark-text">Access Denied</h2>
        <p className="text-sm text-gray-500">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
