import { nonExistentModule } from 'express-chaos-missing'; // CHAOS_MISSING_DEP
// services/auth-service/src/index.ts
// Sentinel Auth Service — handles authentication for the mock production environment

import express from 'express';
import fs from 'fs';
import path from 'path';
import { validateEmail, isUserActive, getUserById, countActiveUsers, MOCK_USERS } from './helpers';

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));

const app = express();
app.use(express.json());

// Logger utility (never use console.log directly per CLAUDE.md)
const logger = {
  info: (msg: string) => {
    const entry = `[${new Date().toISOString()}] INFO [auth-service] ${msg}\n`;
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'app.log'), entry);
  },
  error: (msg: string) => {
    const entry = `[${new Date().toISOString()}] ERROR [auth-service] ${msg}\n`;
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'app.log'), entry);
  },
};

const PORT: number = typeof config.port === 'number' ? config.port : 3001;

// Health check
app.get('/health', (_req, res) => {
  const activeCount = countActiveUsers();
  logger.info(`Health check — active users: ${activeCount}`);
  res.json({
    service: 'auth-service',
    status: 'HEALTHY',
    uptime: process.uptime(),
    activeUsers: activeCount,
    timestamp: new Date().toISOString(),
  });
});

// Login endpoint
app.post('/login', (req, res) => {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !validateEmail(email)) {
    logger.error(`Invalid email provided: ${email}`);
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const user = MOCK_USERS.find(u => u.email === email);
  if (!user) {
    logger.error(`Login attempt for unknown user: ${email}`);
    return res.status(401).json({ error: 'User not found' });
  }

  if (!isUserActive(user)) {
    logger.error(`Inactive user login attempt: ${email}`);
    return res.status(403).json({ error: 'Account is not active' });
  }

  logger.info(`Successful login: ${email}`);
  return res.json({
    token: `mock-jwt-${user.id}-${Date.now()}`,
    user: { id: user.id, email: user.email, role: user.role },
  });
});

// Get user
app.get('/user/:id', (req, res) => {
  const user = getUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json(user);
});

app.listen(PORT, () => {
  logger.info(`Auth service started on port ${PORT}`);
});

export { app };
