import { NextRequest, NextResponse } from 'next/server';
import { resolveOrSynthesizeBusinessProfile } from '@/lib/business-resolver';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const profile = resolveOrSynthesizeBusinessProfile(params.id);
    return NextResponse.json(profile);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
