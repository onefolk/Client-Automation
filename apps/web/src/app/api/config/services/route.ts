import { NextResponse } from 'next/server';
import { DEFAULT_SERVICES } from '@/lib/intent';

export async function GET() {
  return NextResponse.json(DEFAULT_SERVICES);
}
