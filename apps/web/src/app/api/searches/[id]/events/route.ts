import { NextRequest } from 'next/server';
import { subscribeSystemEvents } from '@/lib/store';
import { SystemEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const searchId = params.id;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection comment
      controller.enqueue(encoder.encode(': sse connected\n\n'));

      const unsubscribe = subscribeSystemEvents(searchId, (event: SystemEvent) => {
        try {
          const json = JSON.stringify(event);
          const sseChunk = `event: ${event.type}\ndata: ${json}\n\n`;
          controller.enqueue(encoder.encode(sseChunk));

          if (event.type === 'search.completed' || event.type === 'search.failed') {
            setTimeout(() => {
              try {
                controller.close();
              } catch (_) {}
            }, 1000);
          }
        } catch (e) {
          console.error('Error writing to SSE controller', e);
        }
      });

      req.signal.addEventListener('abort', () => {
        unsubscribe();
      });
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
