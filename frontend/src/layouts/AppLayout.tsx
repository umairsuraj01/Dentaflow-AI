// AppLayout.tsx — Main app shell with premium sidebar and header.

import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, LayoutDashboard, FolderOpen, CreditCard, Users,
  Settings, Search, Menu, X, LogOut, ChevronDown,
} from 'lucide-react';
import { APP_NAME, ROUTES } from '@/constants';
import { useAuth, useAuthStore, UserAvatar } from '@/modules/auth';
import { NotificationBell } from '@/modules/notifications';
import { SearchOverlay } from '@/components/search/SearchOverlay';

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
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNav = NAV_ITEMS.filter((item) =>
    user ? item.roles.includes(user.role) : false,
  );

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      {/* Sidebar overlay (mobile) */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-navy/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col mesh-bg transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar header */}
        <div className="flex h-16 items-center gap-2.5 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-electric to-cyan-400 shadow-glow-blue/50">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">{APP_NAME}</span>
          <button
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-6 flex-1 space-y-1 px-3">
          {filteredNav.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== ROUTES.DASHBOARD && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-white/[0.12] text-white'
                    : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-gradient-to-b from-electric to-cyan-400"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <item.icon className={`h-[18px] w-[18px] transition-colors ${isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer — user info */}
        <div className="p-3">
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2.5">
            {user && <UserAvatar name={user.full_name} imageUrl={user.profile_picture_url} size="sm" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{user?.full_name}</p>
              <p className="text-[11px] text-slate-400 truncate">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-16 items-center gap-4 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 lg:px-6 sticky top-0 z-30">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:text-dark-text hover:bg-slate-100 transition-colors lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cases, patients..."
              className="h-10 w-full rounded-xl bg-slate-100/80 pl-10 pr-4 text-sm text-dark-text placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-electric/20 focus:bg-white"
            />
            {searchQuery.length >= 2 && (
              <SearchOverlay query={searchQuery} onClose={() => setSearchQuery('')} />
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2.5 rounded-xl p-1.5 hover:bg-slate-100 transition-colors"
              >
                {user && <UserAvatar name={user.full_name} imageUrl={user.profile_picture_url} size="sm" />}
                <span className="hidden text-sm font-medium text-dark-text md:block">
                  {user?.full_name}
                </span>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-14 z-50 w-56 rounded-xl bg-white py-1.5 shadow-elevated border border-slate-200/80"
                  >
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-sm font-semibold text-dark-text">{user?.full_name}</p>
                      <p className="text-xs text-slate-500">{user?.email}</p>
                    </div>
                    <div className="py-1">
                      <Link
                        to="/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Settings className="h-4 w-4 text-slate-400" /> Settings
                      </Link>
                    </div>
                    <div className="border-t border-slate-100 py-1">
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="h-4 w-4" /> Sign out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 scrollbar-thin">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
