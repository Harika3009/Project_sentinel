// helpers.ts: services/notification-service/src/helpers.ts

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

export function formatNotification(notification: Notification): string {
  return `Notification ${notification.id} sent to ${notification.recipient}`;
}

globalThis.Notification = Notification;