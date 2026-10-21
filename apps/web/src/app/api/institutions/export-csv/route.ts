import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { exportWorkbookCsvs } from '@/lib/spreadsheet';

export async function GET(req: NextRequest) {
  try {
    const db = getDatabase();
    const { searchParams } = new URL(req.url);
    const tab = (searchParams.get('tab') || 'leads').toLowerCase();

    const workbook = exportWorkbookCsvs(db);

    if (tab === 'all') {
      return NextResponse.json({ success: true, workbook });
    }

    let csvContent = workbook.leadsCsv;
    let filename = 'onefolk_institutions_leads.csv';

    if (tab === 'evidence') {
      csvContent = workbook.evidenceCsv;
      filename = 'onefolk_evidence.csv';
    } else if (tab === 'outreach') {
      csvContent = workbook.outreachCsv;
      filename = 'onefolk_outreach.csv';
    } else if (tab === 'suppression') {
      csvContent = workbook.suppressionCsv;
      filename = 'onefolk_suppression.csv';
    } else if (tab === 'settings') {
      csvContent = workbook.settingsCsv;
      filename = 'onefolk_settings.csv';
    }

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
