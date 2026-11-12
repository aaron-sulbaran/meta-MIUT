import { EventSchema, type CampusEvent } from "@/lib/events/schema";
import { loadSeedEvents } from "@/lib/events/seed";

// The store interface every caller uses. Swap the in-memory implementation
// for a real database later without touching callers.
export type EventStore = {
  listEvents(): Promise<CampusEvent[]>;
  getEvent(id: string): Promise<CampusEvent | null>;
  upsertEvent(event: CampusEvent): Promise<{ data: CampusEvent; error: null } | { data: null; error: string }>;
};

export function createMemoryStore(initialEvents: CampusEvent[]): EventStore {
  const eventsById = new Map(initialEvents.map((event) => [event.id, event]));
  return {
    async listEvents() {
      return [...eventsById.values()];
    },
    async getEvent(id) {
      return eventsById.get(id) ?? null;
    },
    async upsertEvent(event) {
      const result = EventSchema.safeParse(event);
      if (!result.success) return { data: null, error: result.error.message };
      eventsById.set(result.data.id, result.data);
      return { data: result.data, error: null };
    },
  };
}

// One store per server process, seeded at first use. It resets on restart
// and is not shared across serverless instances.
let processStore: EventStore | null = null;

export function getEventStore(): EventStore {
  processStore ??= createMemoryStore(loadSeedEvents(new Date()));
  return processStore;
}
