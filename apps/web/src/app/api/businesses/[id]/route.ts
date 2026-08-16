import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { memoryStore } from '@/lib/store';
import { BusinessProfile } from '@/lib/types';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const business = memoryStore.businesses.get(params.id);
  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  const opportunities = memoryStore.opportunities.get(params.id) || [];
  const activities = memoryStore.activities.filter((a) => a.business_id === params.id);

  const contacts = [];
  if (business.email) {
    contacts.push({
      id: crypto.randomUUID(),
      business_id: business.id,
      contact_type: 'email',
      value: business.email,
      label: 'general',
      confidence: 0.96,
      verified: true,
      created_at: business.created_at,
    });
  }
  if (business.phone) {
    contacts.push({
      id: crypto.randomUUID(),
      business_id: business.id,
      contact_type: 'phone',
      value: business.phone,
      label: 'reservations',
      confidence: 0.98,
      verified: true,
      created_at: business.created_at,
    });
  }

  const profile: BusinessProfile = {
    ...business,
    contacts,
    opportunities,
    activities,
  };

  return NextResponse.json(profile);
}
