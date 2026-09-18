import { NextResponse } from 'next/server';
import { memoryStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(memoryStore.activities);
}
