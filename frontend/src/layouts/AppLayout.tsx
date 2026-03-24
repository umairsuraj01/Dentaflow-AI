// AppLayout.tsx — Premium app shell with sidebar navigation and top header.

import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, LayoutDashboard, FolderOpen, Factory, CreditCard, Users,
  Settings, Search, Menu, X, LogOut, ChevronDown, Building2,
} from 'lucide-react';
import { APP_NAME, ROUTES } from '@/constants';
import { useAuth, useAuthStore, UserAvatar } from '@/modules/auth';
import { NotificationBell } from '@/modules/notifications';
import { Footer } from '@/components/ui/Footer';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  roles: string[];
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: ROUTES.DASHBOARD, roles: ['SUPER_ADMIN', 'DENTIST', 'TECHNICIAN', 'LAB_MANAGER'] },
  { label: 'Cases', icon: FolderOpen, path: ROUTES.CASES, roles: ['SUPER_ADMIN', 'DENTIST', 'TECHNICIAN', 'LAB_MANAGER'] },
  { label: 'Manufacturing', icon: Factory, path: ROUTES.MANUFACTURING, roles: ['SUPER_ADMIN', 'DENTIST', 'TECHNICIAN', 'LAB_MANAGER'] },
  { label: 'Billing', icon: CreditCard, path: ROUTES.BILLING, roles: ['SUPER_ADMIN', 'DENTIST'] },
  { label: 'Organization', icon: Building2, path: ROUTES.ORG_SETTINGS, roles: ['SUPER_ADMIN', 'DENTIST', 'TECHNICIAN', 'LAB_MANAGER'] },
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

  const currentPageTitle = filteredNav.find(
    (item) => location.pathname === item.path || (item.path !== ROUTES.DASHBOARD && location.pathname.startsWith(item.path)),
  )?.label || 'Dashboard';

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/*  SIDEBAR                                                      */}
      {/* ============================================================ */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col transition-transform duration-300 ease-out lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Sidebar background — dark with subtle gradient orbs */}
        <div className="absolute inset-0 bg-[#0F172A]">
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-blue-600/[0.07] to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/20 to-transparent" />
        </div>

        <div className="relative flex flex-col h-full">
          {/* Brand */}
          <div className="flex h-[72px] items-center gap-3 px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#06B6D4] shadow-glow-blue">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <span className="text-[15px] font-bold text-white tracking-tight block">{APP_NAME}</span>
              <span className="text-[11px] font-medium text-slate-500">Professional</span>
            </div>
            <button
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Divider */}
          <div className="mx-5 h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />

          {/* Navigation */}
          <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto scrollbar-none">
            <p className="px-3 mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">
              Menu
            </p>
            {filteredNav.map((item) => {
              const isActive = location.pathname === item.path ||
                (item.path !== ROUTES.DASHBOARD && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200',
                    isActive
                      ? 'bg-white/[0.1] text-white'
                      : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200',
                  )}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-[3px] rounded-r-full bg-gradient-to-b from-[#3B82F6] to-[#06B6D4]"
                      transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-200',
                    isActive
                      ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-cyan-400'
                      : 'text-slate-500 group-hover:text-slate-300',
                  )}>
                    <item.icon className="h-[18px] w-[18px]" />
                  </div>
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500/20 px-1.5 text-[10px] font-bold text-blue-400">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Divider */}
          <div className="mx-5 h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />

          {/* User section */}
          <div className="p-3">
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.05] border border-white/[0.06] px-3 py-3 transition-colors hover:bg-white/[0.08]">
              {user && <UserAvatar name={user.full_name} imageUrl={user.profile_picture_url} size="sm" />}
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-white truncate">{user?.full_name}</p>
                <p className="text-[11px] text-slate-500 truncate capitalize">{user?.role?.replace('_', ' ').toLowerCase()}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ============================================================ */}
      {/*  MAIN CONTENT                                                 */}
      {/* ============================================================ */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-16 items-center gap-4 bg-white/90 backdrop-blur-xl border-b border-slate-200/60 px-4 lg:px-6 sticky top-0 z-30">
          {/* Mobile menu button */}
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:text-dark-text hover:bg-slate-100 transition-colors lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Page title (mobile) */}
          <h1 className="text-sm font-semibold text-dark-text lg:hidden">{currentPageTitle}</h1>

          {/* Search */}
          <div className="relative hidden lg:block flex-1 max-w-lg">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search cases, patients, treatments..."
              className="h-10 w-full rounded-xl bg-slate-50 border border-slate-200/60 pl-10 pr-4 text-sm text-dark-text placeholder:text-slate-400 transition-all duration-200 hover:bg-slate-100/80 hover:border-slate-300/60 focus:bg-white focus:border-electric focus:shadow-input-focus focus:outline-none"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden xl:flex items-center gap-1">
              <kbd className="h-5 rounded border border-slate-200 bg-slate-100 px-1.5 text-[10px] font-medium text-slate-400">⌘</kbd>
              <kbd className="h-5 rounded border border-slate-200 bg-slate-100 px-1.5 text-[10px] font-medium text-slate-400">K</kbd>
            </div>
          </div>

          {/* Right section */}
          <div className="ml-auto flex items-center gap-1.5">
            {/* Search (mobile) */}
            <button className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:text-dark-text hover:bg-slate-100 transition-colors lg:hidden">
              <Search className="h-[18px] w-[18px]" />
            </button>

            {/* Notification bell with slide-out panel */}
            <NotificationBell />

            {/* Divider */}
            <div className="mx-2 hidden h-8 w-px bg-slate-200 sm:block" />

            {/* User dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2.5 rounded-xl py-1.5 px-2 hover:bg-slate-100 transition-colors"
              >
                {user && <UserAvatar name={user.full_name} imageUrl={user.profile_picture_url} size="sm" />}
                <div className="hidden sm:block text-left">
                  <span className="block text-sm font-semibold text-dark-text leading-tight">
                    {user?.full_name}
                  </span>
                  <span className="block text-[11px] text-slate-500 leading-tight capitalize">
                    {user?.role?.replace('_', ' ').toLowerCase()}
                  </span>
                </div>
                <ChevronDown className={cn(
                  'hidden sm:block h-3.5 w-3.5 text-slate-400 transition-transform duration-200',
                  userMenuOpen && 'rotate-180',
                )} />
              </button>

              {/* Dropdown */}
              <AnimatePresence>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.97 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute right-0 top-14 z-50 w-60 rounded-xl bg-white py-1 shadow-elevated border border-slate-200/80"
                    >
                      <div className="px-4 py-3 border-b border-slate-100">
                        <p className="text-sm font-semibold text-dark-text">{user?.full_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
                      </div>
                      <div className="py-1">
                        <Link
                          to="/settings"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <Settings className="h-4 w-4 text-slate-400" />
                          Settings
                        </Link>
                      </div>
                      <div className="border-t border-slate-100 py-1">
                        <button
                          onClick={handleLogout}
                          className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign out
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-4 lg:p-8 max-w-[1400px] mx-auto min-h-[calc(100vh-10rem)]">
            <Outlet />
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}
