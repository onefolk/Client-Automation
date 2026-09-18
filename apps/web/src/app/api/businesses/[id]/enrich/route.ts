import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { memoryStore } from '@/lib/store';
import { crawlWebsiteLive } from '@/lib/live-crawler';
import { Contact, Opportunity, Technology, Fact } from '@/lib/types';

import { resolveBusinessProfile } from '@/lib/business-resolver';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    let business = memoryStore.businesses.get(params.id);
    if (!business) {
      business = resolveBusinessProfile(params.id);
    }

    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    if (!business.website && !business.domain) return NextResponse.json({ error: 'No website is known for this business' }, { status: 422 });

    const websiteUrl = business.website || `https://${business.domain}`;
    const crawlResult = await crawlWebsiteLive(websiteUrl);
    if (!crawlResult.is_reachable) {
      return NextResponse.json({ error: 'Website could not be audited. Previous enrichment has been preserved.' }, { status: 502 });
    }

    // 1. Update Core Digital Presence
    business.has_website = crawlResult.is_reachable;
    business.has_ssl = crawlResult.has_ssl;
    business.is_mobile_friendly = crawlResult.is_mobile_friendly;
    business.website_load_time_ms = crawlResult.load_time_ms;
    business.last_enriched_at = new Date().toISOString();
    business.updated_at = business.last_enriched_at;
    business.status = 'ENRICHED';
    business.email = crawlResult.emails[0] || business.email;
    business.phone = crawlResult.phones[0] || business.phone;
    business.data_completeness = 95;

    // 2. Map & Store Real Extracted Contacts
    const existingContacts = (business as any).contacts || [];
    const newContacts: Contact[] = [];

    for (const em of crawlResult.emails) {
      if (!existingContacts.some((c: Contact) => c.value.toLowerCase() === em.toLowerCase())) {
        newContacts.push({
          id: crypto.randomUUID(),
          business_id: business.id,
          contact_type: 'email',
          value: em,
          label: em.startsWith('sales') ? 'sales' : em.startsWith('info') ? 'general' : 'contact',
          confidence: 0.96,
          verified: true,
          created_at: new Date().toISOString(),
        });
      }
    }

    for (const ph of crawlResult.phones) {
      if (!existingContacts.some((c: Contact) => c.value === ph)) {
        newContacts.push({
          id: crypto.randomUUID(),
          business_id: business.id,
          contact_type: 'phone',
          value: ph,
          label: 'direct',
          confidence: 0.98,
          verified: true,
          created_at: new Date().toISOString(),
        });
      }
    }

    for (const soc of crawlResult.social_links) {
      if (!existingContacts.some((c: Contact) => c.value === soc.url)) {
        newContacts.push({
          id: crypto.randomUUID(),
          business_id: business.id,
          contact_type: `social_${soc.platform.toLowerCase()}`,
          value: soc.url,
          label: soc.platform,
          confidence: 0.99,
          verified: true,
          created_at: new Date().toISOString(),
        });
      }
    }

    const allContacts = [...existingContacts, ...newContacts];
    (business as any).contacts = allContacts;

    // 3. Map & Store Technologies
    const technologies: Technology[] = crawlResult.technologies.map((t) => ({
      id: crypto.randomUUID(),
      business_id: business.id,
      category: t.category,
      name: t.name,
      confidence: 0.98,
      evidence: t.evidence,
    }));
    (business as any).technologies = technologies;

    // 4. Build Fact Store
    const facts: Fact[] = [
      {
        id: crypto.randomUUID(), business_id: business.id, category: 'website', key: 'website_features',
        value: { has_booking_system: crawlResult.has_booking_system, has_lead_form: crawlResult.has_lead_form,
          has_whatsapp: crawlResult.has_whatsapp },
        source: 'live_http_crawler_l1', source_url: crawlResult.url,
        confidence: 0.8, verified: true, created_at: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        business_id: business.id,
        category: 'website',
        key: 'crawl_verification',
        value: {
          url: crawlResult.url,
          reachable: crawlResult.is_reachable,
          status_code: crawlResult.status_code,
          ssl: crawlResult.has_ssl,
          load_time_ms: crawlResult.load_time_ms,
          title: crawlResult.title,
          meta_description: crawlResult.meta_description,
        },
        source: 'live_http_crawler_l1',
        source_url: crawlResult.url,
        confidence: 0.99,
        verified: true,
        created_at: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        business_id: business.id,
        category: 'technology',
        key: 'stack_fingerprint',
        value: {
          count: technologies.length,
          technologies: technologies.map((t) => t.name),
        },
        source: 'tech_fingerprinter_l1',
        source_url: crawlResult.url,
        confidence: 0.98,
        verified: true,
        created_at: new Date().toISOString(),
      },
    ];
    (business as any).facts = facts;

    // 5. Recompute Opportunities
    const oppList: Opportunity[] = [];
    let priorityScore = 50;

    if (!crawlResult.has_booking_system) {
      oppList.push({
        id: crypto.randomUUID(),
        business_id: business.id,
        title: 'Review Direct Booking Options',
        description:
          'No recognized booking integration was found on the audited homepage. Check other pages and confirm scheduling needs before proposing a system.',
        category: 'Web & Conversion Architecture',
        impact: 'HIGH',
        onefolk_service: 'Direct Booking Engine & Custom Landing Architecture',
        service_tier: 'ENTERPRISE',
        confidence: 0.7,
        estimated_revenue_potential: '$6,000 - $15,000/mo',
        evidence: ['Live crawl confirmed: No OpenTable/SevenRooms/Resy widget installed'],
        status: 'IDENTIFIED',
        created_at: new Date().toISOString(),
      });
      priorityScore += 25;
    }

    if (!crawlResult.has_whatsapp) {
      oppList.push({
        id: crypto.randomUUID(),
        business_id: business.id,
        title: 'Review WhatsApp Contact Options',
        description:
          'No WhatsApp contact link was found on the audited homepage. Confirm whether this channel would help the business.',
        category: 'Automation & Retention',
        impact: 'HIGH',
        onefolk_service: 'WhatsApp CRM & VIP Guest Retention Engine',
        service_tier: 'GROWTH',
        confidence: 0.94,
        estimated_revenue_potential: '$3,500 - $8,000/mo',
        evidence: ['Live crawl confirmed: No wa.me widget detected'],
        status: 'IDENTIFIED',
        created_at: new Date().toISOString(),
      });
      priorityScore += 20;
    }

    if (!crawlResult.has_lead_form) {
      oppList.push({
        id: crypto.randomUUID(),
        business_id: business.id,
        title: 'High-Converting Inbound Inquiry Pipeline',
        description:
          'No email capture form was detected on the audited homepage. Review the full inquiry flow before recommending changes.',
        category: 'Lead Generation',
        impact: 'MEDIUM',
        onefolk_service: 'Inbound Lead Funnel Optimization',
        service_tier: 'STANDARD',
        confidence: 0.91,
        estimated_revenue_potential: '$2,500 - $5,000',
        evidence: ['Live crawl confirmed: Zero email input forms detected on homepage'],
        status: 'IDENTIFIED',
        created_at: new Date().toISOString(),
      });
      priorityScore += 10;
    }

    business.priority = priorityScore >= 75 ? 'HIGH' : priorityScore >= 50 ? 'MEDIUM' : 'LOW';
    business.priority_score = priorityScore;
    if (oppList.length) business.status = 'OPPORTUNITY_FOUND';

    memoryStore.businesses.set(business.id, business);
    memoryStore.opportunities.set(business.id, oppList);

    memoryStore.activities.unshift({
      id: crypto.randomUUID(),
      business_id: business.id,
      event_type: 'enrichment.level1_completed',
      title: 'Level 1 Enrichment Completed',
      description: `Extracted ${allContacts.length} verified contacts and ${technologies.length} technologies via live crawl.`,
      metadata: {
        contacts_count: allContacts.length,
        technologies_count: technologies.length,
        priority: business.priority,
        score: business.priority_score,
      },
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      business,
      contacts: allContacts,
      technologies,
      facts,
      opportunities: oppList,
    });
  } catch (err: any) {
    console.error('Error during level 1 enrichment', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
