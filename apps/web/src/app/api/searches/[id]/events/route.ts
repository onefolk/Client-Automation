import { NextRequest } from 'next/server';
import { memoryStore, subscribeSystemEvents } from '@/lib/store';
import { SystemEvent } from '@/lib/types';
import { runDiscoveryPipelineStream } from '@/lib/discovery-engine';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const searchId = params.id;
  const { searchParams } = new URL(req.url);
  const queryParam = searchParams.get('query');
  const cityParam = searchParams.get('city');
  const industryParam = searchParams.get('industry');
  const countryParam = searchParams.get('country');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const sendEvent = (event: SystemEvent) => {
        if (isClosed) return;
        try {
          const json = JSON.stringify(event);
          const sseChunk = `event: ${event.type}\ndata: ${json}\n\n`;
          controller.enqueue(encoder.encode(sseChunk));
        } catch (e) {
          console.error('Error enqueuing SSE chunk', e);
        }
      };

      // Send initial connection comment
      controller.enqueue(encoder.encode(': sse connected\n\n'));

      // Subscribe to any external events if running in background
      const unsubscribe = subscribeSystemEvents(searchId, (event: SystemEvent) => {
        sendEvent(event);
      });

      req.signal.addEventListener('abort', () => {
        isClosed = true;
        unsubscribe();
      });

      // Find the search parameters
      const session = memoryStore.searches.get(searchId);
      const query = queryParam || session?.query || 'ecommerce brands with poor SEO in Dubai';
      const filters = {
        city: cityParam || session?.filters?.city,
        industry: industryParam || session?.filters?.industry,
        country: countryParam || session?.filters?.country,
      };

      try {
        // Run discovery directly within the open SSE stream for guaranteed fast execution
        await runDiscoveryPipelineStream(searchId, query, filters, (event) => {
          sendEvent(event);
        });

        // Close after a brief grace period once completed
        setTimeout(() => {
          if (!isClosed) {
            try {
              controller.close();
              isClosed = true;
            } catch (_) {}
          }
        }, 800);
      } catch (err: any) {
        console.error('Error running discovery stream:', err);
        sendEvent({
          type: 'search.failed',
          data: {
            search_id: searchId,
            error: err.message || 'Discovery pipeline failed',
          },
        });
        if (!isClosed) {
          try {
            controller.close();
            isClosed = true;
          } catch (_) {}
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
