import { NextResponse } from 'next/server';
import { memoryStore } from '@/lib/store';
import { resolveOrSynthesizeBusinessProfile } from '@/lib/business-resolver';

const SEED_IDS = [
  'nomad-luxe-apparel-dubai',
  'desert-bloom-organics-dubai',
  'oasis-gourmet-living-dubai',
];

export async function GET() {
  if (memoryStore.activities.length === 0) {
    for (const seedId of SEED_IDS) {
      resolveOrSynthesizeBusinessProfile(seedId);
    }
  }

  return NextResponse.json(memoryStore.activities);
}
