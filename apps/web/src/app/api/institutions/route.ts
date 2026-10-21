import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const db = getDatabase();
    const { searchParams } = new URL(req.url);

    const is_shortlisted_param = searchParams.get('is_shortlisted');
    const is_shortlisted = is_shortlisted_param === 'true' ? true : is_shortlisted_param === 'false' ? false : undefined;
    const qualification_status = searchParams.get('qualification_status') || undefined;
    const research_status = searchParams.get('research_status') || undefined;
    const search = searchParams.get('search') || undefined;

    const list = db.getInstitutions({
      is_shortlisted,
      qualification_status,
      research_status,
      search,
    });

    return NextResponse.json({ success: true, total: list.length, data: list });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || !body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ success: false, error: 'Institution name is required' }, { status: 400 });
    }

    const db = getDatabase();
    const institution = db.upsertInstitution({
      name: body.name.trim(),
      campus_name: body.campus_name?.trim(),
      parent_organization: body.parent_organization?.trim(),
      website_url: body.website_url?.trim(),
      city: body.city?.trim(),
      state: body.state?.trim(),
      country: body.country?.trim(),
      location: body.location?.trim(),
      source_id: body.source_id?.trim(),
      notes: body.notes?.trim(),
    });

    return NextResponse.json({ success: true, data: institution });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
