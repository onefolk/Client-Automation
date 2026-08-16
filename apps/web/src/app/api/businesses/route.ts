import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/store';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const priority = searchParams.get('priority');
  const industry = searchParams.get('industry');

  let list = Array.from(memoryStore.businesses.values());

  if (priority && priority !== 'ALL') {
    list = list.filter((b) => b.priority === priority);
  }
  if (industry) {
    list = list.filter((b) => b.industry.toLowerCase().includes(industry.toLowerCase()));
  }

  return NextResponse.json(list);
}
