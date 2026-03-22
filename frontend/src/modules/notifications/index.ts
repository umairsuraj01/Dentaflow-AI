// modules/notifications/index.ts — Public API of the notifications module.

export { NotificationBell } from './components/NotificationBell';
export { notificationService } from './services/notification.service';
export { useWebSocket } from './hooks/useWebSocket';
export type { Notification } from './types/notification.types';
