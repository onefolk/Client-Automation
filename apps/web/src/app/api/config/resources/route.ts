import { NextResponse } from 'next/server';
import { DEFAULT_RESOURCES } from '@/lib/intent';

export async function GET() {
  return NextResponse.json(DEFAULT_RESOURCES);
}
