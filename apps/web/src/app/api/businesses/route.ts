import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/store';
import { resolveOrSynthesizeBusinessProfile } from '@/lib/business-resolver';

const SEED_IDS = [
  'nomad-luxe-apparel',
  'desert-bloom-organics',
  'oasis-gourmet-living',
  'al-safa-aesthetics-wellness',
  'prestige-palms-luxury-real-estate',
  'horizon-international-academy',
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const priority = searchParams.get('priority');
  const industry = searchParams.get('industry');

  if (memoryStore.businesses.size === 0) {
    for (const seedId of SEED_IDS) {
      resolveOrSynthesizeBusinessProfile(seedId);
    }
  }

  let list = Array.from(memoryStore.businesses.values());

  if (priority && priority !== 'ALL') {
    list = list.filter((b) => b.priority === priority);
  }
  if (industry) {
    list = list.filter((b) => b.industry.toLowerCase().includes(industry.toLowerCase()));
  }

  return NextResponse.json(list);
}
