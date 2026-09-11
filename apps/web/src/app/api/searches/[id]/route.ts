import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/store';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const search = memoryStore.searches.get(params.id);
  if (!search) {
    return NextResponse.json({ error: 'Search session not found' }, { status: 404 });
  }
  return NextResponse.json(search);
}
