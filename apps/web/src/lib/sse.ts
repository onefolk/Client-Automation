'use client';

import { useEffect, useRef } from 'react';
import { SystemEvent } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function useSearchSSE(
  searchId: string | null,
  onEvent: (event: SystemEvent) => void
) {
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!searchId) return;

    const url = `${API_BASE_URL}/api/searches/${searchId}/events`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    const eventNames = [
      'search.started',
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
      console.warn('SSE connection closed or re-connecting...', err);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [searchId, onEvent]);

  return {
    close: () => eventSourceRef.current?.close(),
  };
}
