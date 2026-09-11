'use client';

import { useEffect, useRef } from 'react';
import { SystemEvent } from './types';

const API_BASE_URL = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || '');

export function useSearchSSE(
  searchId: string | null,
  onEvent: (event: SystemEvent) => void,
  searchParams?: { query?: string; city?: string; industry?: string; country?: string }
) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);

  // Keep latest callback ref without triggering effect re-execution
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  // Stable search parameters snapshot
  const query = searchParams?.query;
  const city = searchParams?.city;
  const industry = searchParams?.industry;
  const country = searchParams?.country;

  useEffect(() => {
    if (!searchId) return;

    // Close any previous instance
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const urlObj = new URL(`${API_BASE_URL}/api/searches/${searchId}/events`, window.location.origin);
    if (query) urlObj.searchParams.set('query', query);
    if (city) urlObj.searchParams.set('city', city);
    if (industry) urlObj.searchParams.set('industry', industry);
    if (country) urlObj.searchParams.set('country', country);

    const es = new EventSource(urlObj.toString());
    eventSourceRef.current = es;

    const eventNames = [
      'search.started',
      'intent.parsed',
      'validation.completed',
      'provider.started',
      'provider.progress',
      'business.discovered',
      'business.updated',
      'enrichment.started',
      'enrichment.progress',
      'enrichment.completed',
      'opportunity.detected',
      'search.completed',
      'search.failed',
    ];

    eventNames.forEach((name) => {
      es.addEventListener(name, (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          onEventRef.current?.(parsed);

          // Close EventSource cleanly when terminal event received
          if (name === 'search.completed' || name === 'search.failed') {
            es.close();
            if (eventSourceRef.current === es) {
              eventSourceRef.current = null;
            }
          }
        } catch (err) {
          console.error('Error parsing SSE event', err);
        }
      });
    });

    es.onerror = () => {
      // Clean up on disconnect / stream end
      es.close();
      if (eventSourceRef.current === es) {
        eventSourceRef.current = null;
      }
    };

    return () => {
      es.close();
      if (eventSourceRef.current === es) {
        eventSourceRef.current = null;
      }
    };
  }, [searchId]); // ONLY re-run when a new search ID is explicitly started!

  return {
    close: () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    },
  };
}
