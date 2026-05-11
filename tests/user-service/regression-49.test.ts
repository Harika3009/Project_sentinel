import { UserService } from '../src/userService';

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService();
  });

  it('should correctly handle user data without TYPE_MISMATCH error', async () => {
    const userData = {
      id: '1',
      name: 'John Doe',
      email: 'john.doe@example.com'
    };

    try {
      await userService.processUserData(userData);
      expect(true).toBe(true); // Test passed if no error is thrown
    } catch (error) {
      fail(`Expected no error, but got: ${error}`);
    }
  });
});