// app/app/api/incidents/route.ts
import { NextResponse } from 'next/server';
import { getOpenIncidents, getResolvedIncidents, getAllIncidents } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';

    let incidents;
    if (filter === 'open') incidents = getOpenIncidents();
    else if (filter === 'resolved') incidents = getResolvedIncidents(20);
    else incidents = getAllIncidents(30);

    return NextResponse.json({ incidents, count: incidents.length });
  } catch {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });
  }
}
