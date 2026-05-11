// services/notification-service/src/helpers.ts

export type NotificationChannel = 'email' | 'slack' | 'webhook';

export interface Notification {
  id: string;
  channel: NotificationChannel;
  recipient: string;
  message: string;
  sent: boolean;
  createdAt: Date;
}

export function isValidChannel(channel: string): channel is NotificationChannel {
  return ['email', 'slack', 'webhook'].includes(channel);
}

export function truncateMessage(message: string, maxLength: number = 500): string {
  if (message.length <= maxLength) return message;
  return message.slice(0, maxLength) + '...';
}

export function formatNotification(n: Notification): string {
  return `[${n.channel.toUpperCase()}] → ${n.recipient}: ${truncateMessage(n.message)}`;
}

export function countSent(notifications: Notification[]): number {
  return notifications.filter(n => n.sent).length;
}
