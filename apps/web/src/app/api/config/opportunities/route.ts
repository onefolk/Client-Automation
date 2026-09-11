import { NextResponse } from 'next/server';
import { DEFAULT_OPPORTUNITIES } from '@/lib/intent';

export async function GET() {
  return NextResponse.json(DEFAULT_OPPORTUNITIES);
}
