import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { memoryStore, emitSystemEvent } from '@/lib/store';
import { Business, Opportunity, SearchSession, SystemEvent } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const rawText = await req.text();
    let body: any = {};
    if (rawText && rawText.trim().length > 0) {
      try {
        body = JSON.parse(rawText);
      } catch (e) {
        console.warn('Failed to parse JSON directly, using fallback', e);
      }
    }
    const { query = 'Japanese restaurants', filters = {}, providers = ['mock_universal_discovery'] } = body;

    const searchId = crypto.randomUUID();
    const now = new Date().toISOString();

    const session: SearchSession = {
      id: searchId,
      query,
      filters,
      providers_selected: providers,
      started_at: now,
      status: 'RUNNING',
      total_discovered: 0,
      total_saved: 0,
      total_enriched: 0,
      errors: [],
      created_at: now,
      updated_at: now,
    };

    memoryStore.searches.set(searchId, session);

    // Run background discovery & streaming pipeline asynchronously
    setTimeout(async () => {
      emitSystemEvent(searchId, {
        type: 'search.started',
        data: { search_id: searchId, query, started_at: now },
      });

      const city = filters.city || filters.location || 'Dubai';
      const industry = filters.industry || 'Restaurant';

      // 1. Search Planner Multi-Query Expansion
      const queryVariations = [
        query,
        `${query} in ${city}`,
        `best ${query} ${city}`,
        `top rated ${query} ${city}`,
      ];

      for (const variation of queryVariations) {
        emitSystemEvent(searchId, {
          type: 'provider.started',
          data: {
            search_id: searchId,
            provider_id: 'mock_universal_discovery',
            query_variation: variation,
          },
        });
        await new Promise((r) => setTimeout(r, 400));
      }

      // Mock Discovered dataset
      const mockTemplates = [
        {
          name: 'Sakura Artisanal Dining',
          domain: 'sakuradining-uae.com',
          phone: '+971 4 398 1245',
          email: 'reservations@sakuradining-uae.com',
          address: 'Downtown Boulevard, Tower 2',
          rating: 4.6,
          reviews: 324,
        },
        {
          name: 'Origami Japanese Kitchen',
          domain: 'origamidxb.ae',
          phone: '+971 4 551 8890',
          email: 'contact@origamidxb.ae',
          address: 'Jumeirah Beach Road, Villa 14',
          rating: 4.3,
          reviews: 189,
        },
        {
          name: 'Kura Sushi Lounge',
          domain: 'kura-sushi.me',
          phone: '+971 4 229 4411',
          email: 'info@kura-sushi.me',
          address: 'Dubai Marina Mall, Promenade Level',
          rating: 4.8,
          reviews: 512,
        },
        {
          name: 'Nobu Inspired Grill LLC',
          domain: 'nobugrill-dubai.com',
          phone: '+971 4 426 2626',
          email: 'events@nobugrill-dubai.com',
          address: 'Palm Jumeirah, Crescent Road',
          rating: 4.7,
          reviews: 890,
        },
        {
          name: 'Tokyo Robata Bar',
          domain: 'tokyorobata.ae',
          phone: '+971 4 330 9944',
          email: 'manager@tokyorobata.ae',
          address: 'DIFC, Gate Village Building 5',
          rating: 4.1,
          reviews: 142,
        },
        {
          name: 'Zen Garden Teppanyaki',
          domain: 'zengarden-uae.com',
          phone: '+971 4 702 3311',
          email: 'hello@zengarden-uae.com',
          address: 'Business Bay, Marasi Drive',
          rating: 3.9,
          reviews: 98,
        },
        {
          name: 'Bespoke Bistro & Cafe',
          domain: 'bespokebistrodxb.com',
          phone: '+971 4 883 1200',
          email: 'info@bespokebistrodxb.com',
          address: 'City Walk, Al Safa',
          rating: 4.4,
          reviews: 260,
        },
      ];

      let totalSaved = 0;

      for (let i = 0; i < mockTemplates.length; i++) {
        const item = mockTemplates[i];
        const bizId = crypto.randomUUID();
        const bizCreatedAt = new Date().toISOString();

        // Evaluate priority & opportunities
        let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
        let priorityScore = 88;
        const oppList: Opportunity[] = [];

        if (item.reviews > 200) {
          oppList.push({
            id: crypto.randomUUID(),
            business_id: bizId,
            title: 'VIP Loyalty & Automated Lead Capture Engine',
            description:
              'High customer review volume indicates active footfall. Opportunity to capture first-party diner data and automate repeat dining campaigns.',
            category: 'Automation & Retention',
            impact: 'HIGH',
            onefolk_service: 'WhatsApp CRM & VIP Guest Retention Engine',
            service_tier: 'GROWTH',
            confidence: 0.92,
            estimated_revenue_potential: '$3,500 - $8,000/mo',
            evidence: [`${item.reviews} verified reviews`, `Rating of ${item.rating}`],
            status: 'IDENTIFIED',
            created_at: bizCreatedAt,
          });
        }

        oppList.push({
          id: crypto.randomUUID(),
          business_id: bizId,
          title: 'Direct Reservation Funnel & Aggregator Fee Bypass',
          description:
            'Implement direct table booking without paying 15-20% third-party portal commission fees.',
          category: 'Web & Conversion',
          impact: 'HIGH',
          onefolk_service: 'Direct Booking Engine & Custom Landing Architecture',
          service_tier: 'ENTERPRISE',
          confidence: 0.95,
          estimated_revenue_potential: '$6,000 - $14,000',
          evidence: ['Third-party aggregator dependent'],
          status: 'IDENTIFIED',
          created_at: bizCreatedAt,
        });

        const business: Business = {
          id: bizId,
          name: item.name,
          normalized_name: item.name.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim(),
          slug: item.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          industry,
          address: item.address,
          city,
          country: filters.country || 'UAE',
          phone: item.phone,
          normalized_phone: item.phone.replace(/[^0-9+]/g, ''),
          email: item.email,
          website: `https://${item.domain}`,
          domain: item.domain,
          rating: item.rating,
          review_count: item.reviews,
          has_website: true,
          has_ssl: true,
          is_mobile_friendly: true,
          status: 'OPPORTUNITY_FOUND',
          priority,
          priority_score: priorityScore,
          confidence: 0.96,
          data_completeness: 85,
          discovered_at: bizCreatedAt,
          created_at: bizCreatedAt,
          updated_at: bizCreatedAt,
        };

        memoryStore.businesses.set(bizId, business);
        memoryStore.opportunities.set(bizId, oppList);
        memoryStore.activities.unshift({
          id: crypto.randomUUID(),
          business_id: bizId,
          search_id: searchId,
          event_type: 'business.discovered',
          title: 'Client Discovered & Verified',
          description: `Discovered ${business.name} in ${city} with ${oppList.length} high-impact opportunities.`,
          metadata: { priority, score: priorityScore },
          created_at: bizCreatedAt,
        });

        totalSaved++;

        emitSystemEvent(searchId, {
          type: 'business.discovered',
          data: {
            search_id: searchId,
            business,
            is_new: true,
          },
        });

        for (const opp of oppList) {
          emitSystemEvent(searchId, {
            type: 'opportunity.detected',
            data: {
              search_id: searchId,
              business_id: bizId,
              opportunity: opp,
            },
          });
        }

        await new Promise((r) => setTimeout(r, 450));
      }

      session.status = 'COMPLETED';
      session.total_discovered = totalSaved;
      session.total_saved = totalSaved;
      session.total_enriched = totalSaved;
      session.completed_at = new Date().toISOString();
      session.duration_ms = 3200;

      emitSystemEvent(searchId, {
        type: 'search.completed',
        data: {
          search_id: searchId,
          total_discovered: totalSaved,
          total_saved: totalSaved,
          total_enriched: totalSaved,
          duration_ms: 3200,
        },
      });
    }, 100);

    return NextResponse.json({
      search_id: searchId,
      query,
      status: 'PENDING',
      created_at: now,
    });
  } catch (err: any) {
    console.error('CRITICAL ERROR IN POST /api/searches:', err);
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}

export async function GET() {
  const list = Array.from(memoryStore.searches.values()).reverse();
  return NextResponse.json(list);
}
