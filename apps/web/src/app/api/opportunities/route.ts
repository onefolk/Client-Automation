import { NextResponse } from 'next/server';
import { memoryStore } from '@/lib/store';
import { Opportunity } from '@/lib/types';
import { resolveOrSynthesizeBusinessProfile } from '@/lib/business-resolver';

const SEED_IDS = [
  'nomad-luxe-apparel-dubai',
  'desert-bloom-organics-dubai',
  'oasis-gourmet-living-dubai',
  'al-safa-aesthetics-wellness-dubai',
  'prestige-palms-luxury-real-estate-dubai',
  'horizon-international-academy-dubai',
];

export async function GET() {
  if (memoryStore.opportunities.size === 0) {
    for (const seedId of SEED_IDS) {
      resolveOrSynthesizeBusinessProfile(seedId);
    }
  }

  const allOpps: Opportunity[] = [];
  memoryStore.opportunities.forEach((opps) => {
    allOpps.push(...opps);
  });

  return NextResponse.json(allOpps);
}
