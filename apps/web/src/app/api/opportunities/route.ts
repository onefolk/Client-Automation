import { NextResponse } from 'next/server';
import { memoryStore } from '@/lib/store';
import { Opportunity } from '@/lib/types';

export async function GET() {
  const allOpps: Opportunity[] = [];
  memoryStore.opportunities.forEach((opps) => {
    allOpps.push(...opps);
  });

  return NextResponse.json(allOpps);
}
