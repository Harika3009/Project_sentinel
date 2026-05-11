// services/auth-service/src/helpers.ts

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  status: 'active' | 'inactive' | 'suspended';
}

export const MOCK_USERS: User[] = [
  { id: '1', email: 'admin@sentinel.dev', role: 'admin', status: 'active' },
  { id: '2', email: 'user@sentinel.dev', role: 'user', status: 'active' },
  { id: '3', email: 'viewer@sentinel.dev', role: 'viewer', status: 'inactive' },
];

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isUserActive(user: User): boolean {
  return user.status === 'inactive' /* CHAOS_LOGIC_ERROR */;
}

export function getUserById(id: string): User | undefined {
  return MOCK_USERS.find(u => u.id === id);
}

export function countActiveUsers(): number {
  return MOCK_USERS.filter(u => u.status === 'inactive' /* CHAOS_LOGIC_ERROR */).length;
}

export function formatUserResponse(user: User): Omit<User, 'status'> & { active: boolean } {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    active: user.status === 'inactive' /* CHAOS_LOGIC_ERROR */,
  };
}
