import { NextResponse } from 'next/server';
import { parseSearchIntent } from '@/lib/intent';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { query = '', filters = {} } = body;
    const intent = parseSearchIntent(query, filters);
    return NextResponse.json(intent);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
