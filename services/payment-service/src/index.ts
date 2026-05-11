// services/payment-service/src/index.ts

import express from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { validateAmount, calculateTax, formatCurrency, Transaction } from './helpers';

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
const app = express();
app.use(express.json());

const logger = {
  info: (msg: string) => {
    const entry = `[${new Date().toISOString()}] INFO [payment-service] ${msg}\n`;
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'app.log'), entry);
  },
  error: (msg: string) => {
    const entry = `[${new Date().toISOString()}] ERROR [payment-service] ${msg}\n`;
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'app.log'), entry);
  },
};

const PORT: number = typeof config.port === 'number' ? config.port : 3002;
const transactions: Transaction[] = [];

app.get('/health', (_req, res) => {
  logger.info('Health check called');
  res.json({ service: 'payment-service', status: 'HEALTHY', transactions: transactions.length });
});

app.post('/charge', (req, res) => {
  const { amount, userId, currency = config.currency } = req.body as {
    amount: number;
    userId: string;
    currency?: string;
  };

  if (!validateAmount(amount)) {
    logger.error(`Invalid amount: ${amount}`);
    return res.status(400).json({ error: `Amount must be between 1 and ${config.maxTransactionAmount}` });
  }

  const tax = calculateTax(amount, config.taxRate);
  const total = amount + tax;

  const tx: Transaction = {
    id: uuidv4(),
    amount: total,
    currency,
    status: 'completed',
    userId,
    createdAt: new Date(),
  };

  transactions.push(tx);
  logger.info(`Charge processed: ${formatCurrency(total, currency)} for user ${userId}`);

  return res.json({ transactionId: tx.id, total, tax, status: tx.status });
});

app.get('/transactions', (_req, res) => {
  res.json({ transactions, count: transactions.length });
});

app.listen(PORT, () => {
  logger.info(`Payment service started on port ${PORT}`);
});

export { app };
