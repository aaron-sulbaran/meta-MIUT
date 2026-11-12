import { afterEach, describe, expect, it } from "vitest";
import { loadSeedEvents, loadSeedStudent } from "@/lib/events/seed";
import type { EventStore } from "@/lib/events/store";
import { compileCandidates } from "@/lib/muse/candidates";
import { eventSignal, learnFromEvent } from "@/lib/muse/learn";
import { getInterestMemory, resetInterestMemory } from "@/lib/muse/memory";

const now = new Date("2026-11-12T16:00:00.000Z");
const events = loadSeedEvents(now);
const byId = (id: string) => events.find((event) => event.id === id)!;
const store = { getEvent: async (id: string) => events.find((event) => event.id === id) ?? null } as EventStore;
const student = loadSeedStudent();
const likelyIds = () => compileCandidates(student, getInterestMemory(undefined, now), events, now).map((c) => c.eventId);

describe("learning from events", () => {
  afterEach(() => resetInterestMemory());

  it("going to events outweighs skipped videos on the same topic", async () => {
    expect(likelyIds()).not.toContain("evt-yoga-tower");
    for (let i = 0; i < 2; i += 1) {
      await learnFromEvent({ userId: "sample-student", eventId: "evt-yoga-tower", kind: "attended", now }, { store });
    }
    const yoga = getInterestMemory(undefined, now).topics.find((topic) => topic.topic === "yoga");
    expect(yoga?.evidence).toContain("went to 2 events");
    expect(likelyIds()).toContain("evt-yoga-tower");
  });

  it("an RSVP teaches the organizer as well as the topic", async () => {
    const result = await learnFromEvent({ userId: "new-user", eventId: "evt-film-union", kind: "rsvp", now }, { store });
    expect(result.data?.topics.map((topic) => topic.topic)).toEqual(["film"]);
    expect(result.data?.creators[0]?.handle).toBe(byId("evt-film-union").organizer.handle);
  });

  it("a dismissal counts against the event's topics but not against free food", () => {
    const signal = eventSignal(byId("evt-acm-pizza-gdc"), "dismissed", now);
    expect(signal.topics).toContain("coding");
    expect(signal.topics).not.toContain("free food");
  });

  it("refuses an unknown event", async () => {
    const result = await learnFromEvent({ userId: "x", eventId: "nope", kind: "interested", now }, { store });
    expect(result.error).toBe("Event not found");
  });
});
