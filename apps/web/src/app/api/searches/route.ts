import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { memoryStore } from '@/lib/store';
import { SearchSession } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const rawText = await req.text();
    let body: any = {};
    if (rawText && rawText.trim().length > 0) {
      try {
        body = JSON.parse(rawText);
      } catch (e) {
        return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
      }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
    }
    const {
      query,
      filters = {},
      providers = ['live_public_registry'],
    } = body;
    if (!body || typeof query !== 'string' || !query.trim() || query.length > 2000 ||
        !filters || typeof filters !== 'object' || Array.isArray(filters) ||
        !Array.isArray(providers) || providers.some((value) => typeof value !== 'string') ||
        ['industry', 'city', 'country', 'location'].some((key) => filters[key] !== undefined && typeof filters[key] !== 'string')) {
      return NextResponse.json({ error: 'Provide a nonempty query, valid filters and a providers array' }, { status: 400 });
    }

    const searchId = crypto.randomUUID();
    const now = new Date().toISOString();

    const session: SearchSession = {
      id: searchId,
      query,
      filters,
      providers_selected: providers,
      started_at: now,
      status: 'PENDING',
      total_discovered: 0,
      total_saved: 0,
      total_enriched: 0,
      errors: [],
      created_at: now,
      updated_at: now,
    };

    memoryStore.searches.set(searchId, session);

    return NextResponse.json({
      search_id: searchId,
      query,
      status: 'PENDING',
      created_at: now,
    });
  } catch (err: any) {
    console.error('CRITICAL ERROR IN POST /api/searches:', err);
    return NextResponse.json({ error: 'Unable to create search' }, { status: 500 });
  }
}

export async function GET() {
  const list = Array.from(memoryStore.searches.values()).reverse();
  return NextResponse.json(list);
}
