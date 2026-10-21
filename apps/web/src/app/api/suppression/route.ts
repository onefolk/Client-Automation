import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

export async function GET() {
  try {
    const db = getDatabase();
    const list = db.getSuppressionList();
    return NextResponse.json({ success: true, total: list.length, data: list });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || !body.type || !body.value) {
      return NextResponse.json({ success: false, error: 'Type and value are required' }, { status: 400 });
    }

    const db = getDatabase();
    const entry = db.addSuppression({
      type: body.type,
      value: body.value,
      reason: body.reason || 'Manual suppression',
      source: body.source || 'user',
    });

    return NextResponse.json({ success: true, data: entry });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
