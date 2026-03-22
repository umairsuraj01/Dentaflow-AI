// NotificationBell.tsx — Bell icon with unread badge and slide-out notification panel.

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, X, FileText, CreditCard, Brain, Megaphone, CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { notificationService } from '../services/notification.service';
import type { Notification } from '../types/notification.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  case: FileText,
  payment: CreditCard,
  ai: Brain,
  system: Megaphone,
};

function iconForType(type: string) {
  return TYPE_ICONS[type] ?? Bell;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // --- Queries ---------------------------------------------------------------

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationService.getUnreadCount,
    refetchInterval: 30_000,
  });

  const { data: notificationsData } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationService.list(1, 30),
    enabled: open,
  });

  const notifications: Notification[] = notificationsData?.items ?? [];

  // --- Mutations --------------------------------------------------------------

  const markReadMutation = useMutation({
    mutationFn: (ids: string[]) => notificationService.markRead(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: notificationService.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // --- Keyboard escape -------------------------------------------------------

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // --- Handlers ---------------------------------------------------------------

  function handleNotificationClick(n: Notification) {
    if (!n.is_read) {
      markReadMutation.mutate([n.id]);
    }
    if (n.data?.case_id) {
      setOpen(false);
      navigate(`/cases/${n.data.case_id}`);
    } else if (n.data?.invoice_id) {
      setOpen(false);
      navigate(`/billing/invoices/${n.data.invoice_id}`);
    }
  }

  // --- Render -----------------------------------------------------------------

  return (
    <>
      {/* Bell button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-lg p-2 text-gray-500 hover:bg-soft-gray hover:text-dark-text transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Backdrop + Panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/20"
              onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <motion.div
              key="panel"
              ref={panelRef}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed right-0 top-0 z-50 flex h-full w-[380px] max-w-[90vw] flex-col bg-white shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-dark-text">Notifications</h2>
                  {unreadCount > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1.5 text-[11px] font-semibold text-white">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllReadMutation.mutate()}
                      disabled={markAllReadMutation.isPending}
                      className="rounded-md px-2.5 py-1 text-xs font-medium text-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    aria-label="Close notifications"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <CheckCircle className="mb-3 h-10 w-10 text-mint" />
                    <p className="text-sm font-medium text-gray-500">All caught up!</p>
                    <p className="mt-1 text-xs text-gray-400">No new notifications</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {notifications.map((n) => {
                      const Icon = iconForType(n.type);
                      return (
                        <li
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={cn(
                            'flex cursor-pointer gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50',
                            !n.is_read && 'border-l-2 border-l-blue-500 bg-blue-50/30',
                          )}
                        >
                          <div
                            className={cn(
                              'mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
                              !n.is_read ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500',
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                'text-sm',
                                !n.is_read ? 'font-semibold text-dark-text' : 'font-medium text-gray-700',
                              )}
                            >
                              {n.title}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                              {n.message}
                            </p>
                            <p className="mt-1 text-[11px] text-gray-400">
                              {timeAgo(n.created_at)}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
