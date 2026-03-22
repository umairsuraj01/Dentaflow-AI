import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderOpen, Plus, Bell, User } from 'lucide-react';
import { ROUTES } from '@/constants';

interface NavTab {
  label: string;
  icon: React.ElementType;
  path: string;
}

const tabs: NavTab[] = [
  { label: 'Home', icon: LayoutDashboard, path: ROUTES.DASHBOARD },
  { label: 'Cases', icon: FolderOpen, path: ROUTES.CASES },
  { label: 'Upload', icon: Plus, path: ROUTES.CASES_NEW },
  { label: 'Alerts', icon: Bell, path: '/notifications' },
  { label: 'Profile', icon: User, path: '/settings' },
];

export function MobileLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Page content */}
      <div className="flex-1 pb-20">
        <Outlet />
      </div>

      {/* Bottom navigation bar */}
      <nav className="fixed bottom-0 left-0 z-40 flex h-16 w-full items-center justify-around border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const isUpload = tab.label === 'Upload';
          const isActive = pathname === tab.path || pathname.startsWith(tab.path + '/');
          const Icon = tab.icon;

          if (isUpload) {
            return (
              <button
                key={tab.label}
                onClick={() => navigate(tab.path)}
                className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 active:scale-95 transition-transform"
                aria-label={tab.label}
              >
                <Icon className="h-7 w-7" strokeWidth={2.5} />
              </button>
            );
          }

          return (
            <button
              key={tab.label}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center justify-center gap-0.5"
              aria-label={tab.label}
            >
              <div className="relative">
                <Icon
                  className={`h-6 w-6 ${isActive ? 'text-blue-500' : 'text-gray-400'}`}
                />
                {tab.label === 'Alerts' && (
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                )}
              </div>
              <span
                className={`text-[10px] font-medium ${isActive ? 'text-blue-500' : 'text-gray-400'}`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
