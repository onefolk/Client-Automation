import { Business, BusinessProfile, Opportunity, ActivityEvent, SearchSession, SystemEvent } from './types';

// Global In-Memory Store for Web Runtime
interface AppMemoryState {
  searches: Map<string, SearchSession>;
  businesses: Map<string, Business>;
  opportunities: Map<string, Opportunity[]>;
  activities: ActivityEvent[];
  eventSubscribers: Map<string, Array<(event: SystemEvent) => void>>;
}

declare global {
  var __ONEFOLK_STORE__: AppMemoryState | undefined;
}

if (!global.__ONEFOLK_STORE__) {
  global.__ONEFOLK_STORE__ = {
    searches: new Map(),
    businesses: new Map(),
    opportunities: new Map(),
    activities: [],
    eventSubscribers: new Map(),
  };
}

export const memoryStore = global.__ONEFOLK_STORE__;

export function emitSystemEvent(searchId: string, event: SystemEvent) {
  const subs = memoryStore.eventSubscribers.get(searchId);
  if (subs) {
    subs.forEach((cb) => cb(event));
  }
}

export function subscribeSystemEvents(searchId: string, cb: (event: SystemEvent) => void) {
  const current = memoryStore.eventSubscribers.get(searchId) || [];
  memoryStore.eventSubscribers.set(searchId, [...current, cb]);

  return () => {
    const list = memoryStore.eventSubscribers.get(searchId) || [];
    memoryStore.eventSubscribers.set(
      searchId,
      list.filter((fn) => fn !== cb)
    );
  };
}
