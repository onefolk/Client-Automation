import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { importInstitutionsFromCsv } from '@/lib/spreadsheet';

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    if (!text || !text.trim()) {
      return NextResponse.json({ success: false, error: 'Empty CSV payload' }, { status: 400 });
    }

    const db = getDatabase();
    const result = importInstitutionsFromCsv(text, db);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
