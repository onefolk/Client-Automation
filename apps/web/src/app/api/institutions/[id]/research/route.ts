import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { runInstitutionalResearch } from '@/lib/institutional-engine';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDatabase();
    const outcome = await runInstitutionalResearch(params.id, db);
    const profile = db.getFullProfile(params.id);
    return NextResponse.json({ success: true, outcome, profile });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
