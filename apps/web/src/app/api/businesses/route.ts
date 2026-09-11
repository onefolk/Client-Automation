import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/store';
import { resolveOrSynthesizeBusinessProfile } from '@/lib/business-resolver';

const SEED_IDS = [
  'nomad-luxe-apparel-dubai',
  'desert-bloom-organics-dubai',
  'oasis-gourmet-living-dubai',
  'al-safa-aesthetics-wellness-dubai',
  'prestige-palms-luxury-real-estate-dubai',
  'horizon-international-academy-dubai',
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
