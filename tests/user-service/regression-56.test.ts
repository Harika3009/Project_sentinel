import { getUserServiceInstance } from '../src/helpers';

describe('User Service Config Validation', () => {
  it('should load config with valid port number and necessary dependencies', async () => {
    const userService = await getUserServiceInstance();
    expect(userService.port).toBeGreaterThan(0);
    expect(userService.dependencies).toContain('someDependency');
  });
});