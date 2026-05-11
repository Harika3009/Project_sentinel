// services/user-service/src/helpers.ts

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
  lastSeen: Date;
  plan: 'free' | 'pro' | 'enterprise';
}

export function sanitizeUsername(username: string): string {
  return username.toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

export function isRecentlyActive(lastSeen: Date, thresholdHours: number = 24): boolean {
  const diff = Date.now() - lastSeen.getTime();
  return diff < thresholdHours * 60 * 60 * 1000;
}

export function getUserPlanLabel(plan: UserProfile['plan']): string {
  const labels: Record<UserProfile['plan'], string> = {
    free: 'Free Tier',
    pro: 'Pro Plan',
    enterprise: 'Enterprise',
  };
  return labels[plan];
}

export function paginateArray<T>(arr: T[], page: number, limit: number): T[] {
  const start = (page - 1) * limit;
  return arr.slice(start, start + limit);
}
