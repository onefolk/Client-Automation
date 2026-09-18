import { NextRequest } from 'next/server';
import { memoryStore, emitSystemEvent, subscribeSystemEvents } from '@/lib/store';
import { SystemEvent } from '@/lib/types';
import { runDiscoveryPipelineStream } from '@/lib/discovery-engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const searchId = params.id;
  let session = memoryStore.searches.get(searchId);
  if (!session) {
    // A serverless stream may land on a different instance than the create request.
    const query = req.nextUrl.searchParams.get('query')?.trim();
    if (!query) return Response.json({ error: 'Search session not found. Start a new search.' }, { status: 404 });
    const now = new Date().toISOString();
    const filters = Object.fromEntries(['city', 'industry', 'country'].map((key) => [key, req.nextUrl.searchParams.get(key) || undefined]));
    session = { id: searchId, query, filters, providers_selected: ['live_public_registry'], started_at: now,
      status: 'PENDING', total_discovered: 0, total_saved: 0, total_enriched: 0, errors: [], created_at: now, updated_at: now };
    memoryStore.searches.set(searchId, session);
  }
  const search = session;
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let unsubscribe = () => {};
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      const finish = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(heartbeat);
        req.signal.removeEventListener('abort', finish);
        try { controller.close(); } catch { /* The consumer may already have cancelled. */ }
      };
      cleanup = finish;
      const send = (event: SystemEvent) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)); }
        catch { finish(); return; }
        if (event.type === 'search.completed' || event.type === 'search.failed') finish();
      };
      if (req.signal.aborted) { finish(); return; }
      req.signal.addEventListener('abort', finish, { once: true });
      controller.enqueue(encoder.encode(': connected\n\n'));
      unsubscribe = subscribeSystemEvents(searchId, send);
      heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(': heartbeat\n\n')); } catch { finish(); }
      }, 10000);
      for (const event of memoryStore.searchEvents.get(searchId) || []) send(event);
      if (closed) return;
      if (!memoryStore.activeSearches.has(searchId)) {
        // Register the shared promise before executing the pipeline.
        const run = Promise.resolve().then(() => runDiscoveryPipelineStream(searchId, search.query, search.filters,
          (event) => emitSystemEvent(searchId, event)))
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : 'Discovery failed';
            search.status = 'FAILED';
            search.errors.push(message);
            search.updated_at = search.completed_at = new Date().toISOString();
            emitSystemEvent(searchId, { type: 'search.failed', data: { search_id: searchId, error: message } });
          }).finally(() => { memoryStore.activeSearches.delete(searchId); });
        memoryStore.activeSearches.set(searchId, run);
      }
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
}
