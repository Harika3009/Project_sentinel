import { getUserById } from '../src/userService';

describe('User Service', () => {
  it('should return user details without syntax errors', async () => {
    const userId = '12345';
    const expectedUser = {
      id: '12345',
      name: 'John Doe',
      email: 'john.doe@example.com'
    };

    const result = await getUserById(userId);

    expect(result).toEqual(expectedUser);
  });
});