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

  useEffect(() => {
    if (!searchId) return;

    const urlObj = new URL(`${API_BASE_URL}/api/searches/${searchId}/events`, window.location.origin);
    if (searchParams?.query) urlObj.searchParams.set('query', searchParams.query);
    if (searchParams?.city) urlObj.searchParams.set('city', searchParams.city);
    if (searchParams?.industry) urlObj.searchParams.set('industry', searchParams.industry);
    if (searchParams?.country) urlObj.searchParams.set('country', searchParams.country);

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
          onEvent(parsed);
        } catch (err) {
          console.error('Error parsing SSE event', err);
        }
      });
    });

    es.onerror = (err) => {
      console.warn('SSE connection closed or completed');
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [searchId, onEvent, searchParams?.query, searchParams?.city, searchParams?.industry, searchParams?.country]);

  return {
    close: () => eventSourceRef.current?.close(),
  };
}
