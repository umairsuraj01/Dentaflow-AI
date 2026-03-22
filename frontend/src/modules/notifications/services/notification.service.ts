// notification.service.ts — API calls for the notifications module.

import api from '@/lib/api';
import type { Notification } from '../types/notification.types';

function unwrap<T>(res: any): T {
  const body = res.data;
  if (!body.success) throw new Error(body.message || 'Request failed');
  return body.data as T;
}

export const notificationService = {
  list: async (page = 1, perPage = 30): Promise<{ items: Notification[]; total: number }> => {
    const res = await api.get('/notifications', { params: { page, per_page: perPage } });
    return unwrap<{ items: Notification[]; total: number }>(res);
  },

  getUnreadCount: async (): Promise<number> => {
    const res = await api.get('/notifications/unread-count');
    return unwrap<{ count: number }>(res).count;
  },

  markRead: async (ids: string[]): Promise<void> => {
    await api.post('/notifications/mark-read', { ids });
  },

  markAllRead: async (): Promise<void> => {
    await api.post('/notifications/mark-all-read');
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/notifications/${id}`);
  },
};
