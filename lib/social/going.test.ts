import { beforeEach, describe, expect, it } from "vitest";
import type { CampusEvent } from "@/lib/events/schema";
import { loadSeedEvents } from "@/lib/events/seed";
import { ACCEPT_AFTER_MS, COMPANY_LIMIT, friendsGoingLine, resetSocial, sayHello, setGoing, sharedLine, whoIsGoing } from "@/lib/social/going";
import { FRIENDS } from "@/lib/social/fixtures/people";

const viewer = "sample-student";
const interests = ["rock climbing", "free food", "hackathons", "film"];
const events: CampusEvent[] = loadSeedEvents(new Date("2026-11-12T18:00:00Z"));

function eventWith(test: (who: ReturnType<typeof whoIsGoing>) => boolean): CampusEvent {
  const found = events.find((event) => test(whoIsGoing(event, viewer, interests)));
  if (!found) throw new Error("no seed event fits");
  return found;
}

describe("going together", () => {
  beforeEach(() => resetSocial());

  it("lists only friends as friends, with their handle", () => {
    const event = eventWith((who) => who.friends.length > 0);
    const who = whoIsGoing(event, viewer, interests);
    for (const friend of who.friends) {
      expect(FRIENDS[viewer]).toContain(friend.id);
      expect(friend.instagram).toBeDefined();
    }
  });

  it("shows strangers only when open to company, ranked by shared interests, without handles", () => {
    const event = eventWith((who) => who.openToCompany.length > 1);
    const { openToCompany } = whoIsGoing(event, viewer, interests);
    for (const person of openToCompany) {
      expect(FRIENDS[viewer]).not.toContain(person.id);
      expect(person.instagram).toBeUndefined();
    }
    const counts = openToCompany.map((person) => person.shared.length);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it("is stable across calls", () => {
    const event = events[0]!;
    expect(whoIsGoing(event, viewer, interests)).toEqual(whoIsGoing(event, viewer, interests));
  });

  it("records the viewer going and open to company, and never lists the viewer", () => {
    const event = events[0]!;
    setGoing(event, viewer, { going: true, open: true, note: "anyone?" });
    const who = whoIsGoing(event, viewer, interests);
    expect(who.viewer).toEqual({ going: true, open: true, note: "anyone?" });
    expect([...who.friends, ...who.openToCompany].some((person) => person.id === viewer)).toBe(false);
    setGoing(event, viewer, { going: false });
    expect(whoIsGoing(event, viewer, interests).viewer.going).toBe(false);
  });

  it("drops the note when not open to company", () => {
    const event = events[0]!;
    setGoing(event, viewer, { going: true, open: false, note: "hidden" });
    expect(whoIsGoing(event, viewer, interests).viewer).toEqual({ going: true, open: false });
  });

  it("swaps handles once a hello to someone open is accepted, once", () => {
    const event = eventWith((who) => who.openToCompany.length > 0);
    const target = whoIsGoing(event, viewer, interests).openToCompany[0]!;
    const sent = 1_000_000;
    expect(sayHello(event, viewer, target.id, sent).error).toBeNull();
    expect(sayHello(event, viewer, target.id, sent + 1000).error).toBeNull();
    const pending = whoIsGoing(event, viewer, interests, sent + 1000).openToCompany.find((person) => person.id === target.id);
    expect(pending).toMatchObject({ hello: "pending" });
    expect(pending!.instagram).toBeUndefined();
    const after = whoIsGoing(event, viewer, interests, sent + ACCEPT_AFTER_MS).openToCompany.filter((person) => person.id === target.id);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ hello: "accepted" });
    expect(after[0]!.instagram).toBeDefined();
  });

  it("refuses a hello to someone not open to company", () => {
    expect(sayHello(events[0]!, viewer, "nobody").error).not.toBeNull();
  });

  it("keeps state per viewer", () => {
    const event = events[0]!;
    setGoing(event, viewer, { going: true });
    expect(whoIsGoing(event, "someone-else", interests).viewer.going).toBe(false);
  });

  it("shows at most the top 5 open to company, each sharing an interest", () => {
    for (const event of events) {
      const { openToCompany } = whoIsGoing(event, viewer, interests);
      expect(openToCompany.length).toBeLessThanOrEqual(COMPANY_LIMIT);
      for (const person of openToCompany) expect(person.shared.length).toBeGreaterThan(0);
    }
  });

  it("counts friends going", () => {
    expect(friendsGoingLine([])).toBeNull();
    expect(friendsGoingLine([{ name: "Maya" }])).toBe("1 friend going");
    expect(friendsGoingLine([{ name: "Maya" }, { name: "Leo" }, { name: "Sam" }])).toBe("3 friends going");
  });

  it("says what they share", () => {
    expect(sharedLine(["film"])).toBe("You both like film");
    expect(sharedLine(["hackathons", "film"])).toBe("You both like hackathons and film");
    expect(sharedLine(["a", "b", "c"])).toBe("You both like a, b and c");
  });
});
