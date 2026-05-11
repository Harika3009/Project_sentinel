// app/app/api/logs/route.ts
import { NextResponse } from 'next/server';
import { getAgentLogs } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const logs = getAgentLogs(100);
    return NextResponse.json({ logs });
  } catch {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });
  }
}
