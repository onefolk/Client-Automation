import { NextRequest, NextResponse } from 'next/server';
import { resolveBusinessProfile } from '@/lib/business-resolver';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const profile = resolveBusinessProfile(params.id);
    if (!profile) return NextResponse.json({ error: 'Business not found. Please run discovery again.' }, { status: 404 });
    return NextResponse.json(profile);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
