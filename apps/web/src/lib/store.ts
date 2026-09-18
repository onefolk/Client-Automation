import { Business, BusinessProfile, Opportunity, ActivityEvent, SearchSession, SystemEvent } from './types';

// Global In-Memory Store for Web Runtime
interface AppMemoryState {
  searches: Map<string, SearchSession>;
  businesses: Map<string, Business>;
  opportunities: Map<string, Opportunity[]>;
  activities: ActivityEvent[];
  eventSubscribers: Map<string, Array<(event: SystemEvent) => void>>;
  searchEvents: Map<string, SystemEvent[]>;
  activeSearches: Map<string, Promise<void>>;
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
    searchEvents: new Map(),
    activeSearches: new Map(),
  };
}

export const memoryStore = global.__ONEFOLK_STORE__;
// Preserve the store across development hot reloads from older versions.
memoryStore.searchEvents ??= new Map();
memoryStore.activeSearches ??= new Map();

export function emitSystemEvent(searchId: string, event: SystemEvent) {
  const events = memoryStore.searchEvents.get(searchId) || [];
  events.push(event);
  memoryStore.searchEvents.set(searchId, events.slice(-1000));
  const subs = memoryStore.eventSubscribers.get(searchId);
  if (subs) {
    subs.slice().forEach((cb) => cb(event));
  }
}

export function subscribeSystemEvents(searchId: string, cb: (event: SystemEvent) => void) {
  const current = memoryStore.eventSubscribers.get(searchId) || [];
  memoryStore.eventSubscribers.set(searchId, [...current, cb]);

  return () => {
    const list = memoryStore.eventSubscribers.get(searchId) || [];
    const remaining = list.filter((fn) => fn !== cb);
    if (remaining.length) memoryStore.eventSubscribers.set(searchId, remaining);
    else memoryStore.eventSubscribers.delete(searchId);
  };
}
