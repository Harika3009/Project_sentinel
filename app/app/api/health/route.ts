// app/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { getServices, getSystemStats } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const services = getServices();
    const stats = getSystemStats();
    return NextResponse.json({ services, stats, timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });
  }
}
