// services/api-gateway/src/index.ts

import express from 'express';
import fs from 'fs';
import path from 'path';
import http from 'http';

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
const app = express();
app.use(express.json());

const PORT: number = config.port || 3005;

const logger = {
  info: (msg: string) => {
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'app.log'), `[${new Date().toISOString()}] INFO [api-gateway] ${msg}\n`);
  },
};

// Aggregated health check
app.get('/health', async (_req, res) => {
  const serviceHealthChecks = [
    { name: 'auth-service', port: 3001 },
    { name: 'payment-service', port: 3002 },
    { name: 'notification-service', port: 3003 },
    { name: 'user-service', port: 3004 },
  ];

  const results = await Promise.allSettled(
    serviceHealthChecks.map(
      svc =>
        new Promise<{ name: string; status: string }>((resolve, reject) => {
          const req = http.get(`http://localhost:${svc.port}/health`, res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
              try {
                const parsed = JSON.parse(data);
                resolve({ name: svc.name, status: parsed.status || 'UNKNOWN' });
              } catch {
                reject(new Error('Parse error'));
              }
            });
          });
          req.on('error', () => reject(new Error(`${svc.name} unreachable`)));
          req.setTimeout(2000, () => {
            req.destroy();
            reject(new Error(`${svc.name} timeout`));
          });
        })
    )
  );

  const statuses = results.map((r, i) => ({
    name: serviceHealthChecks[i].name,
    status: r.status === 'fulfilled' ? r.value.status : 'CRITICAL',
  }));

  logger.info('Gateway health check complete');
  res.json({ gateway: 'HEALTHY', services: statuses, timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  logger.info(`API Gateway started on port ${PORT}`);
});

export { app };
