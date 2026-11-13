import { beforeEach, describe, expect, it } from "vitest";
import type { CampusEvent } from "@/lib/events/schema";
import { loadSeedEvents } from "@/lib/events/seed";
import { friendsGoingLine, resetSocial, sayHello, setGoing, whoIsGoing } from "@/lib/social/going";
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

  it("swaps handles after a hello to someone open, once", () => {
    const event = eventWith((who) => who.openToCompany.length > 0);
    const target = whoIsGoing(event, viewer, interests).openToCompany[0]!;
    expect(sayHello(event, viewer, target.id).error).toBeNull();
    expect(sayHello(event, viewer, target.id).error).toBeNull();
    const after = whoIsGoing(event, viewer, interests).openToCompany.filter((person) => person.id === target.id);
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

  it("writes the friends line", () => {
    expect(friendsGoingLine([])).toBeNull();
    expect(friendsGoingLine([{ name: "Maya" }])).toBe("Maya is going");
    expect(friendsGoingLine([{ name: "Maya" }, { name: "Leo" }])).toBe("Maya, Leo are going");
    expect(friendsGoingLine([{ name: "Maya" }, { name: "Leo" }, { name: "Sam" }])).toBe("Maya, Leo + 1 friend going");
  });
});
