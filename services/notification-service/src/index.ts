import { nonExistentModule } from 'express-chaos-missing'; // CHAOS_MISSING_DEP
// services/notification-service/src/index.ts

import express from 'express';
import fs from 'fs';
import path from 'path';
import { v4 } from 'crypto';
import { isValidChannel, formatNotification, countSent, Notification } from './helpers';

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
const app = express();
app.use(express.json());

const logger = {
  info: (msg: string) => {
    const entry = `[${new Date().toISOString()}] INFO [notification-service] ${msg}\n`;
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'app.log'), entry);
  },
  error: (msg: string) => {
    const entry = `[${new Date().toISOString()}] ERROR [notification-service] ${msg}\n`;
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'app.log'), entry);
  },
};

const PORT: number = typeof config.port === 'number' ? config.port : 3003;
const notifications: Notification[] = [];

function generateId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

app.get('/health', (_req, res) => {
  res.json({
    service: 'notification-service',
    status: 'HEALTHY',
    sent: countSent(notifications),
    total: notifications.length,
  });
});

app.post('/notify', (req, res) => {
  const { channel, recipient, message } = req.body as {
    channel: string;
    recipient: string;
    message: string;
  };

  if (!isValidChannel(channel)) {
    logger.error(`Invalid channel: ${channel}`);
    return res.status(400).json({ error: `Invalid channel. Must be one of: ${config.channels.join(', ')}` });
  }

  if (!recipient || !message) {
    return res.status(400).json({ error: 'recipient and message are required' });
  }

  const notification: Notification = {
    id: generateId(),
    channel,
    recipient,
    message,
    sent: true,
    createdAt: new Date(),
  };

  notifications.push(notification);
  logger.info(formatNotification(notification));

  return res.json({ success: true, notificationId: notification.id });
});

app.get('/notifications', (_req, res) => {
  res.json({ notifications, total: notifications.length });
});

app.listen(PORT, () => {
  logger.info(`Notification service started on port ${PORT}`);
});

export { app };
