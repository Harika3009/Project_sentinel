// services/user-service/src/index.ts

import express from 'express';
import fs from 'fs';
import path from 'path';
import { sanitizeUsername, paginateArray, UserProfile } from './helpers';

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
const app = express();
app.use(express.json());

const logger = {
  info: (msg: string) => {
    const entry = `[${new Date().toISOString()}] INFO [user-service] ${msg}\n`;
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'app.log'), entry);
  },
  error: (msg: string) => {
    const entry = `[${new Date().toISOString()}] ERROR [user-service] ${msg}\n`;
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'app.log'), entry);
  },
};

const PORT: number = typeof config.port === 'number' ? config.port : 3004;

const MOCK_PROFILES: UserProfile[] = [
  { id: '1', username: 'devops_hero', email: 'hero@sentinel.dev', createdAt: new Date('2024-01-01'), lastSeen: new Date(), plan: 'enterprise' },
  { id: '2', username: 'sentinel_bot', email: 'bot@sentinel.dev', createdAt: new Date('2024-03-01'), lastSeen: new Date(), plan: 'pro' },
  { id: '3', username: 'chaos_monkey', email: 'chaos@sentinel.dev', createdAt: new Date('2024-06-01'), lastSeen: new Date(Date.now() - 3600000), plan: 'free' },
];

app.get('/health', (_req, res) => {
  res.json({ service: 'user-service', status: 'HEALTHY', userCount: MOCK_PROFILES.length });
});

app.get('/users', (req, res) => {
  const page = parseInt(String(req.query.page || '1'), 10);
  const limit = config.pagination;
  const paginated = paginateArray(MOCK_PROFILES, page, limit);
  logger.info(`Listed users: page ${page}, ${paginated.length} results`);
  res.json({ users: paginated, page, total: MOCK_PROFILES.length });
});

app.post('/users', (req, res) => {
  const { username, email, plan = 'free' } = req.body as {
    username: string;
    email: string;
    plan?: UserProfile['plan'];
  };

  const cleanUsername = sanitizeUsername(username);
  const newUser: UserProfile = {
    id: String(MOCK_PROFILES.length + 1),
    username: cleanUsername,
    email,
    createdAt: new Date(),
    lastSeen: new Date(),
    plan,
  };

  MOCK_PROFILES.push(newUser);
  logger.info(`User created: ${cleanUsername}`);
  res.status(201).json(newUser);
});

app.listen(PORT, () => {
  logger.info(`User service started on port ${PORT}`);
});

export { app };
