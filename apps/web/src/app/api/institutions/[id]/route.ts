import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { applyManualCorrection } from '@/lib/institutional-engine';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDatabase();
    const profile = db.getFullProfile(params.id);
    if (!profile) {
      return NextResponse.json({ success: false, error: 'Institution not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: profile });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const db = getDatabase();
    const notes = body.notes || '';
    const changedBy = body.changed_by || 'user';

    const allowedFields = [
      'name',
      'campus_name',
      'parent_organization',
      'website_url',
      'city',
      'state',
      'country',
      'location',
      'qualification_status',
      'qualification_reason',
      'is_shortlisted',
      'shortlist_reason',
      'website_state',
    ];

    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    const updatedProfile = applyManualCorrection(params.id, updates, notes, changedBy, db);
    return NextResponse.json({ success: true, data: updatedProfile });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDatabase();
    db.deleteInstitution(params.id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
