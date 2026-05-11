// helpers.ts: services/payment-service/src/helpers.ts

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  userId: string;
  createdAt: Date;
}

const MAX_AMOUNT = 10000;

export function validateAmount(amount: number): boolean {
  return amount > 0 && amount <= MAX_AMOUNT;
}

export function calculateTax(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

export function formatCurrency(amount: number, currency: string): string {
  return `${currency} ${amount.toFixed(2)}`;
}

export function isTransactionComplete(tx: Transaction): boolean {
  return tx.status === 'completed';
}