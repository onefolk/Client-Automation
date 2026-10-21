import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDatabase();
    db.removeSuppression(params.id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
