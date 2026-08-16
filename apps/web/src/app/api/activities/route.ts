import { NextResponse } from 'next/server';
import { memoryStore } from '@/lib/store';

export async function GET() {
  return NextResponse.json(memoryStore.activities);
}
