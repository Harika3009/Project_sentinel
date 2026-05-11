import { sendNotification } from '../src/index';

describe('Notification Service', () => {
  it('should send a notification successfully', async () => {
    const mockData = { userId: '123', message: 'Test Notification' };
    await expect(sendNotification(mockData)).resolves.not.toThrow();
  });
});