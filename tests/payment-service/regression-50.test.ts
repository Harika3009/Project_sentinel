import express, { Application } from 'express';
import paymentService from '../src/index';

describe('Payment Service', () => {
  let app: Application;

  beforeAll(() => {
    app = express();
    app.use(paymentService);
  });

  it('should start without errors', async () => {
    const response = await app.request().get('/');
    expect(response.status).toBe(200);
  });

  it('should handle payment requests correctly', async () => {
    const mockPaymentData = { amount: 100, currency: 'USD' };
    const response = await app.request().post('/payment').send(mockPaymentData);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, message: 'Payment processed successfully' });
  });

  it('should handle errors gracefully', async () => {
    const mockErrorData = { amount: -100, currency: 'USD' };
    const response = await app.request().post('/payment').send(mockErrorData);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ success: false, message: 'Invalid payment data' });
  });
});