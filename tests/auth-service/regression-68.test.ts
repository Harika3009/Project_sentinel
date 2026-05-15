import { AuthService } from '../src';

describe('AuthService', () => {
  it('should authenticate user with valid credentials', async () => {
    const authService = new AuthService();
    const result = await authService.authenticate('user', 'password');
    expect(result).toBe(true);
  });

  it('should reject authentication with invalid credentials', async () => {
    const authService = new AuthService();
    const result = await authService.authenticate('user', 'wrongPassword');
    expect(result).toBe(false);
  });
});