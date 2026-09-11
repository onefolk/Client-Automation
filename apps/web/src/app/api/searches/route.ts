import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { memoryStore } from '@/lib/store';
import { SearchSession } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const rawText = await req.text();
    let body: any = {};
    if (rawText && rawText.trim().length > 0) {
      try {
        body = JSON.parse(rawText);
      } catch (e) {
        console.warn('Failed to parse JSON directly', e);
      }
    }
    const {
      query = 'Japanese restaurants',
      filters = {},
      providers = ['OpenStreetMap', 'Reddit', 'Threads', 'Live Web Search'],
    } = body;

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
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}

export async function GET() {
  const list = Array.from(memoryStore.searches.values()).reverse();
  return NextResponse.json(list);
}
