// AppLayout.tsx — Main app shell with sidebar and top header.

import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, LayoutDashboard, FolderOpen, CreditCard, Users,
  Settings, Bell, Search, Menu, X, LogOut, ChevronDown,
} from 'lucide-react';
import { APP_NAME, ROUTES } from '@/constants';
import { useAuth, useAuthStore, UserAvatar } from '@/modules/auth';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: ROUTES.DASHBOARD, roles: ['SUPER_ADMIN', 'DENTIST', 'TECHNICIAN', 'LAB_MANAGER'] },
  { label: 'Cases', icon: FolderOpen, path: ROUTES.CASES, roles: ['SUPER_ADMIN', 'DENTIST', 'TECHNICIAN', 'LAB_MANAGER'] },
  { label: 'Billing', icon: CreditCard, path: ROUTES.BILLING, roles: ['SUPER_ADMIN', 'DENTIST'] },
  { label: 'Admin', icon: Users, path: ROUTES.ADMIN, roles: ['SUPER_ADMIN', 'LAB_MANAGER'] },
  { label: 'Settings', icon: Settings, path: '/settings', roles: ['SUPER_ADMIN', 'DENTIST', 'TECHNICIAN', 'LAB_MANAGER'] },
];

export function AppLayout() {
  const { user } = useAuthStore();
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const filteredNav = NAV_ITEMS.filter((item) =>
    user ? item.roles.includes(user.role) : false,
  );

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  return (
    <div className="flex h-screen bg-soft-gray">
      {/* Sidebar overlay (mobile) */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-navy transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-2 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-electric">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-white">{APP_NAME}</span>
          <button
            className="ml-auto text-gray-400 hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="mt-4 flex-1 space-y-1 px-3">
          {filteredNav.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 lg:px-6">
          <button
            className="text-gray-500 hover:text-dark-text lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search cases, patients..."
              className="h-9 w-full rounded-lg bg-soft-gray pl-10 pr-4 text-sm text-dark-text placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-electric/20"
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              className="relative rounded-lg p-2 text-gray-500 hover:bg-soft-gray hover:text-dark-text transition-colors"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
            </button>
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-soft-gray transition-colors"
              >
                {user && <UserAvatar name={user.full_name} imageUrl={user.profile_picture_url} size="sm" />}
                <span className="hidden text-sm font-medium text-dark-text md:block">
                  {user?.full_name}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </button>
              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-12 z-50 w-48 rounded-xl bg-white py-2 shadow-lg border border-gray-200"
                  >
                    <Link
                      to="/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-dark-text hover:bg-soft-gray"
                    >
                      <Settings className="h-4 w-4" /> Settings
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
